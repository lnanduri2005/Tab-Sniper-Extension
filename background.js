// Tab Sniper service worker. Stateless: every event re-reads storage, so nothing breaks
// when Chrome puts the worker to sleep.
import { DEFAULT_SETTINGS, MINUTE_MS, SETTINGS_UNLOCK_MS } from "./lib/defaults.js";
import { normalizeDomain } from "./lib/match.js";
import { decide, activeBlocks, bansActive, timerRunning, isPaused } from "./lib/policy.js";
import { buildRules, blockPageUrl } from "./lib/rules.js";
import { requestSettingChange, resolvePending } from "./lib/gating.js";
import {
    pauseMinutesLeft, allowedPauseOptions, startWait, beat, waitRemainingMs,
    canComplete, grantPause, prunePauses
} from "./lib/pause.js";
import { newRemoval, completeRemovalChallenge, removalStatus } from "./lib/removal.js";
import { migrate, ensureStatsShape, SCHEMA_VERSION } from "./lib/migrate.js";
import { dayKey, bumpDaily, readDaily } from "./lib/day.js";
import { lockChallenge, releaseChallenge, swapChallenge } from "./challenges/index.js";
import { PROFILES, newWatchedEntry, clampWatchField, findWatched } from "./lib/profiles.js";
import { accrue, recordNav, evaluate, measure, emptyEntry, VISIT_GAP_MS } from "./lib/detector.js";
import { startCooldown, inCooldown, nextCooldownMinutes, pruneCooldowns } from "./lib/cooldown.js";
import { siteMascot } from "./lib/sitemascot.js";
import { statusFacts } from "./ui/status.js";
import { buildBackup, applyBackup } from "./lib/backup.js";
import { logEvent, pruneLog, summarize, trend } from "./lib/stats.js";

const BLOCK_PAGE = chrome.runtime.getURL("blocked.html");
const CONTEXT_MENU_ID = "tab-sniper-block-domain";
const ALARM_TICK = "tick";
const ALARM_SESSION_END = "session-end";
const ALARM_PAUSE_PREFIX = "pause-end:";
const ALARM_COOLDOWN_PREFIX = "cooldown-end:";
const IDLE_SEC = 120;
const CUTOFF_MS = 1600; // the mascot's on-page cutoff moment before the block page

// All storage is chrome.storage.local. CONFIG_KEYS are what the user set up; LOCAL_KEYS are runtime.
const CONFIG_KEYS = ["enabled", "bans", "superBans", "watched", "settings", "pendingSettings", "removals", "challengeLocks", "presets"];
const LOCAL_KEYS = [
    "timer", "history", "stats", "lastResetWeek", "pauses", "pauseRequests", "pauseUsage", "attempts", "dueNotified",
    "watch", "activeFocus", "cooldowns", "trips", "statsLog", "settingsUnlockedUntil"
];
const RULE_KEYS = new Set(["enabled", "bans", "superBans", "watched", "settings", "timer", "pauses", "cooldowns"]);

// ---------- state ----------

async function loadState() {
    const l = await chrome.storage.local.get([...CONFIG_KEYS, ...LOCAL_KEYS]);
    const s = l;
    return {
        enabled: !!s.enabled,
        bans: s.bans || [],
        superBans: s.superBans || [],
        watched: s.watched || [],
        settings: { ...DEFAULT_SETTINGS, ...(s.settings || {}) },
        pendingSettings: s.pendingSettings || [],
        removals: s.removals || {},
        challengeLocks: s.challengeLocks || {},
        presets: s.presets || [],
        timer: l.timer || null,
        history: l.history || [],
        stats: ensureStatsShape(l.stats),
        lastResetWeek: l.lastResetWeek || null,
        pauses: l.pauses || {},
        pauseRequests: l.pauseRequests || {},
        pauseUsage: l.pauseUsage || {},
        attempts: l.attempts || {},
        dueNotified: l.dueNotified || {},
        watch: l.watch || {},
        activeFocus: l.activeFocus || null,
        cooldowns: l.cooldowns || {},
        trips: l.trips || {},
        statsLog: l.statsLog || {},
        settingsUnlockedUntil: l.settingsUnlockedUntil || 0
    };
}

// One-time move to local-only storage: read whatever older versions left in Chrome sync,
// copy it here, then clear this extension's sync area. Nothing reads or writes sync after this.
async function runMigration() {
    const local = await chrome.storage.local.get(null);
    if ((local.schemaVersion || 0) >= SCHEMA_VERSION) return;
    let sync = {};
    try {
        sync = await chrome.storage.sync.get(null);
    } catch {
        sync = {};
    }
    const result = migrate(sync, local, Date.now());
    if (!result) return;
    await chrome.storage.local.set(result.localSet);
    if (result.clearSync) await chrome.storage.sync.clear().catch(() => {});
}

// ---------- blocking ----------

let rulesChain = Promise.resolve();
function scheduleRebuild() {
    rulesChain = rulesChain.then(rebuildRules).catch((e) => console.error("rebuildRules", e));
    return rulesChain;
}

async function rebuildRules() {
    const state = await loadState();
    const now = Date.now();
    const rules = buildRules(activeBlocks(state, now), BLOCK_PAGE);
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existing.map((r) => r.id),
        addRules: rules
    });
    await enforceOpenTabs(state, now);
    updateIcon(state, now);
}

function applyDecision(tabId, url, decision) {
    if (decision.action === "close") {
        chrome.tabs.remove(tabId).catch(() => {});
    } else if (decision.action === "block") {
        chrome.tabs.update(tabId, { url: blockPageUrl(BLOCK_PAGE, decision, url) }).catch(() => {});
    }
}

// Tabs playing the mascot's cutoff moment; their redirect waits until it finishes.
const pendingCutoffs = new Map(); // tabId -> until (ms)
const inCutoff = (tabId) => (pendingCutoffs.get(tabId) || 0) > Date.now();

async function enforceOpenTabs(state, now) {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
        if (tab.url && !inCutoff(tab.id)) applyDecision(tab.id, tab.url, decide(tab.url, state, now));
    }
}

async function checkNavigation(tabId, url, { closeOnly = false } = {}) {
    if (inCutoff(tabId)) return;
    const decision = decide(url, await loadState(), Date.now());
    if (closeOnly && decision.action !== "close") return;
    applyDecision(tabId, url, decision);
}

// "close tab" bans have no DNR rule, so they're handled here.
chrome.webNavigation.onBeforeNavigate.addListener(({ frameId, tabId, url }) => {
    if (frameId === 0) ready.then(() => checkNavigation(tabId, url, { closeOnly: true }));
});
// Fallbacks for anything DNR misses (SPA route changes, rules not built yet),
// plus swipe counting for Watched sites.
function onNavigated({ frameId, tabId, url }) {
    if (frameId !== 0) return;
    ready.then(() => {
        checkNavigation(tabId, url);
        queueWatch(() => watchStep({ tabId, url }));
    });
}
chrome.webNavigation.onCommitted.addListener(onNavigated);
chrome.webNavigation.onHistoryStateUpdated.addListener(onNavigated);

function updateIcon(state, now) {
    const on = bansActive(state, now);
    chrome.action.setIcon({ path: on ? "icon_mischiveous.png" : "icon_sleep.png" });
}

// ---------- 30-day stats log ----------
// Serialized so concurrent events never drop a count.

let statsChain = Promise.resolve();
function bumpStat(field, key, amount = 1) {
    statsChain = statsChain
        .then(async () => {
            const { statsLog } = await chrome.storage.local.get("statsLog");
            await chrome.storage.local.set({ statsLog: logEvent(statsLog, dayKey(), field, key, amount) });
        })
        .catch((e) => console.error("stats", e));
    return statsChain;
}

// ---------- watched sites ----------
// Every step credits the time since the last step to whatever Watched site was focused
// (and the user wasn't idle), counts swipes from URL changes, then warns or trips.

let watchChain = Promise.resolve();
function queueWatch(fn) {
    watchChain = watchChain.then(fn).catch((e) => console.error("watch", e));
    return watchChain;
}

async function currentFocus() {
    try {
        const win = await chrome.windows.getLastFocused();
        if (!win?.focused) return null;
        const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
        if (!tab?.url) return null;
        if ((await chrome.idle.queryState(IDLE_SEC)) !== "active") return null;
        return { tabId: tab.id, url: tab.url };
    } catch {
        return null;
    }
}

function liveEntry(entry, now) {
    return entry && now - entry.lastAt <= VISIT_GAP_MS ? entry : null;
}

async function watchStep(nav = null) {
    const state = await loadState();
    const now = Date.now();
    const watch = { ...state.watch };
    const touched = new Map(); // domain -> { watched, tabId }

    const prev = state.activeFocus;
    if (prev) {
        const w = findWatched(state.watched, prev.url);
        if (w && !inCooldown(state.cooldowns, w.domain, now)) {
            watch[w.domain] = accrue(watch[w.domain], w, prev.url, prev.since, now);
            touched.set(w.domain, { w, tabId: prev.tabId });
        }
    }
    if (nav) {
        const w = findWatched(state.watched, nav.url);
        if (w && !inCooldown(state.cooldowns, w.domain, now)) {
            watch[w.domain] = recordNav(watch[w.domain], w, nav.url, now);
            touched.set(w.domain, { w, tabId: nav.tabId });
        }
    }

    let { cooldowns, trips } = state;
    const toasts = [];
    const cutoffs = [];
    for (const { w, tabId } of touched.values()) {
        const result = evaluate(watch[w.domain], w, now);
        watch[w.domain] = result.entry;
        if (result.trip) {
            ({ cooldowns, trips } = startCooldown(cooldowns, trips, w.domain, result.trip.text, now, dayKey(), state.settings.watchCooldownMin));
            watch[w.domain] = emptyEntry();
            bumpStat("trips", w.domain);
            chrome.alarms.create(`${ALARM_COOLDOWN_PREFIX}${w.domain}`, { when: cooldowns[w.domain].until });
            if (tabId != null) {
                pendingCutoffs.set(tabId, now + CUTOFF_MS + 400); // before the write that triggers enforcement
                cutoffs.push({ tabId });
            }
        } else if (result.warn) {
            toasts.push({ tabId, text: `${result.warn.text}. Easy there, I cut you off at the limit.` });
        }
    }

    const focus = await currentFocus();
    const update = { watch, activeFocus: focus ? { ...focus, since: now } : null };
    if (cooldowns !== state.cooldowns) Object.assign(update, { cooldowns, trips });
    await chrome.storage.local.set(update);

    const fontUrl = chrome.runtime.getURL("fonts/mplus-rounded-1c-800.woff2");
    for (const { tabId, text } of toasts) {
        chrome.scripting.executeScript({ target: { tabId }, func: siteMascot, args: ["peek", text, fontUrl] }).catch(() => {});
    }
    for (const { tabId } of cutoffs) {
        chrome.scripting.executeScript({ target: { tabId }, func: siteMascot, args: ["cutoff", "That's enough.", fontUrl] }).catch(() => {});
        setTimeout(async () => {
            pendingCutoffs.delete(tabId);
            try {
                const tab = await chrome.tabs.get(tabId);
                if (tab.url) applyDecision(tabId, tab.url, decide(tab.url, await loadState(), Date.now()));
            } catch {
                /* tab closed */
            }
        }, CUTOFF_MS);
    }
}

function kickWatch() {
    ready.then(() => queueWatch(() => watchStep()));
}
chrome.tabs.onActivated.addListener(kickWatch);
chrome.windows.onFocusChanged.addListener(kickWatch);
chrome.idle.onStateChanged.addListener(kickWatch);
chrome.idle.setDetectionInterval(IDLE_SEC);

// ---------- focus timer ----------

async function startTimer(minutes, source) {
    const state = await loadState();
    if (timerRunning(state.timer, Date.now())) return { ok: false, error: "A focus session is already running" };
    const duration = Math.max(1, parseInt(minutes, 10));
    const startTime = Date.now();
    const timer = {
        active: true,
        startTime,
        endTime: startTime + duration * MINUTE_MS,
        durationMinutes: duration,
        sessionId: `session-${startTime}`
    };
    const session = { id: timer.sessionId, date: new Date(startTime).toISOString(), duration, completed: false, source, blockedSnapshot: state.bans };
    await chrome.storage.local.set({ timer, history: [session, ...state.history].slice(0, 200) });
    chrome.alarms.create(ALARM_SESSION_END, { when: timer.endTime });
    notify("Focus session started", `Focus mode on for ${duration} ${duration === 1 ? "minute" : "minutes"}. You can do it!`);
    return { ok: true, timer };
}

async function endSession({ completed, reason }) {
    const state = await loadState();
    const timer = state.timer;
    if (!timer?.active) return false;

    const history = [...state.history];
    const stats = ensureStatsShape(state.stats);
    const index = history.findIndex((h) => h.id === timer.sessionId);
    if (index !== -1) {
        const session = { ...history[index], completed, reason, completedAt: new Date().toISOString() };
        history[index] = session;
        if (completed) {
            const day = new Date().getDay();
            stats.dailyMinutes[day] += session.duration || 0;
            for (const site of session.blockedSnapshot || []) {
                stats.blockedSites[site] = (stats.blockedSites[site] || 0) + 1;
            }
        }
    }
    await chrome.storage.local.set({ timer: null, history, stats });
    chrome.alarms.clear(ALARM_SESSION_END);
    if (completed) {
        bumpStat("focusMin", null, timer.durationMinutes);
        notify("Focus session complete!", `You finished your ${timer.durationMinutes} minute session.`);
    }
    return true;
}

// ---------- periodic housekeeping ----------

async function tick() {
    const state = await loadState();
    const now = Date.now();

    if (state.timer?.active && state.timer.endTime <= now) {
        await endSession({ completed: true, reason: "timer-expired" });
    }

    const resolved = resolvePending(state.settings, state.pendingSettings, now);
    if (resolved.changed) {
        await chrome.storage.local.set({ settings: resolved.settings, pendingSettings: resolved.pending });
    }

    const pruned = prunePauses(state.pauses, now);
    if (pruned.expired) await chrome.storage.local.set({ pauses: pruned.pauses });

    const cooled = pruneCooldowns(state.cooldowns, now);
    if (cooled.expired) await chrome.storage.local.set({ cooldowns: cooled.cooldowns });

    const dueNotified = { ...state.dueNotified };
    let notifiedChanged = false;
    for (const [domain, removal] of Object.entries(state.removals)) {
        if (removalStatus(removal, now) === "due" && dueNotified[domain] !== removal.dueAt) {
            notify("Super ban removal ready", `You can now confirm removing ${domain} in the Tab Sniper dashboard.`);
            dueNotified[domain] = removal.dueAt;
            notifiedChanged = true;
        }
    }
    if (notifiedChanged) await chrome.storage.local.set({ dueNotified });

    const { statsLog } = await chrome.storage.local.get("statsLog");
    const prunedLog = pruneLog(statsLog);
    if (Object.keys(prunedLog).length !== Object.keys(statsLog || {}).length) await chrome.storage.local.set({ statsLog: prunedLog });

    await queueWatch(() => watchStep());
}

chrome.alarms.onAlarm.addListener((alarm) => {
    ready.then(async () => {
        if (alarm.name === ALARM_SESSION_END) {
            await endSession({ completed: true, reason: "alarm-expired" });
        } else if (
            alarm.name === ALARM_TICK ||
            alarm.name.startsWith(ALARM_PAUSE_PREFIX) ||
            alarm.name.startsWith(ALARM_COOLDOWN_PREFIX)
        ) {
            await tick();
        }
    });
});

// ---------- message handlers ----------

function notify(title, message) {
    chrome.notifications.create({ type: "basic", iconUrl: "icon_mischiveous.png", title, message, priority: 2 });
}

function superDomainOf(state, domain) {
    return state.superBans.find((s) => s.domain === domain);
}

function lockKey(purpose, domain) {
    if (purpose === "removal") return `removal:${domain}`;
    return purpose === "settings" ? "settings" : "endEarly";
}

const handlers = {
    async getState() {
        const state = await loadState();
        const now = Date.now();
        const day = dayKey();
        return {
            ok: true,
            now,
            enabled: state.enabled,
            bansActive: bansActive(state, now),
            timer: timerRunning(state.timer, now) ? state.timer : null,
            attemptsToday: state.attempts?.day === day ? state.attempts.byKey : {},
            bans: state.bans,
            presets: state.presets,
            settings: state.settings,
            pendingSettings: state.pendingSettings,
            settingsUnlockedUntil: state.settingsUnlockedUntil > now ? state.settingsUnlockedUntil : 0,
            history: state.history,
            superBans: state.superBans.map(({ domain, addedAt }) => ({
                domain,
                addedAt,
                pausedUntil: isPaused(state.pauses, domain, now) ? state.pauses[domain].until : null,
                pauseMinutesLeft: pauseMinutesLeft(state.pauseUsage, domain, day, state.settings.pauseCapMin),
                removal: state.removals[domain] || null,
                removalStatus: removalStatus(state.removals[domain], now),
                attemptsToday: readDaily(state.attempts, day, domain)
            })),
            watched: state.watched.map((w) => ({
                ...w,
                label: PROFILES[w.profile]?.label || null,
                noun: PROFILES[w.profile]?.noun || null,
                cooldown: inCooldown(state.cooldowns, w.domain, now) ? state.cooldowns[w.domain] : null,
                usage: measure(liveEntry(state.watch[w.domain], now), w, now),
                tripsToday: readDaily(state.trips, day, w.domain)
            })),
            profiles: Object.entries(PROFILES).map(([key, p]) => ({ key, label: p.label, domain: p.domain })),
            stats: (() => {
                const summary = summarize(state.statsLog);
                return { ...summary, trend: trend(summary) };
            })()
        };
    },

    async addWatched({ profile, input }) {
        const state = await loadState();
        let entry;
        if (profile) {
            if (!PROFILES[profile]) return { ok: false, error: "Unknown profile" };
            entry = newWatchedEntry({ profile });
        } else {
            const domain = normalizeDomain(input);
            if (!domain) return { ok: false, error: "That doesn't look like a website" };
            const match = Object.entries(PROFILES).find(([, p]) => p.domain === domain);
            entry = newWatchedEntry(match ? { profile: match[0] } : { domain });
        }
        if (state.watched.some((w) => w.domain === entry.domain)) return { ok: true, domain: entry.domain };
        await chrome.storage.local.set({ watched: [...state.watched, entry] });
        return { ok: true, domain: entry.domain };
    },

    async removeWatched({ domain }) {
        const state = await loadState();
        if (inCooldown(state.cooldowns, domain, Date.now())) return { ok: false, error: "Can't remove a site during its cooldown" };
        await chrome.storage.local.set({ watched: state.watched.filter((w) => w.domain !== domain) });
        return { ok: true };
    },

    async updateWatched({ domain, field, value }) {
        const state = await loadState();
        if (inCooldown(state.cooldowns, domain, Date.now())) return { ok: false, error: "Can't change limits during a cooldown" };
        const entry = state.watched.find((w) => w.domain === domain);
        if (!entry || !(field in entry) || field === "domain" || field === "profile") return { ok: false, error: "Invalid field" };
        const clamped = clampWatchField(field, value);
        if (clamped === null) return { ok: false, error: "Invalid value" };
        await chrome.storage.local.set({
            watched: state.watched.map((w) => (w.domain === domain ? { ...w, [field]: clamped } : w))
        });
        return { ok: true, value: clamped };
    },

    async exportConfig() {
        return { ok: true, data: buildBackup(await loadState()) };
    },

    async importConfig({ data }) {
        const state = await loadState();
        const now = Date.now();
        const r = applyBackup(state, data, now, { unlocked: state.settingsUnlockedUntil > now });
        if (!r.ok) return r;
        await chrome.storage.local.set(r.next);
        return { ok: true, summary: r.summary };
    },

    async statusFacts() {
        const res = await handlers.getState();
        return { ok: true, ...statusFacts(res, Date.now()) };
    },

    async toggle({ enabled }) {
        const state = await loadState();
        if (!enabled && timerRunning(state.timer, Date.now())) {
            return { ok: false, error: "Can't turn off during a focus session" };
        }
        await chrome.storage.local.set({ enabled: !!enabled });
        return { ok: true };
    },

    async addBan({ input }) {
        const domain = normalizeDomain(input);
        if (!domain) return { ok: false, error: "That doesn't look like a website" };
        const state = await loadState();
        if (!state.bans.includes(domain)) await chrome.storage.local.set({ bans: [...state.bans, domain] });
        return { ok: true, domain };
    },

    async removeBan({ domain }) {
        const state = await loadState();
        if (bansActive(state, Date.now())) return { ok: false, error: "Bans can only be removed while I'm napping. Nap first." };
        await chrome.storage.local.set({ bans: state.bans.filter((d) => d !== domain) });
        return { ok: true };
    },

    async addSuperBan({ input }) {
        const domain = normalizeDomain(input);
        if (!domain) return { ok: false, error: "That doesn't look like a website" };
        const state = await loadState();
        if (superDomainOf(state, domain)) return { ok: true, domain };
        await chrome.storage.local.set({ superBans: [...state.superBans, { domain, addedAt: Date.now() }] });
        return { ok: true, domain };
    },

    async requestRemoval({ domain }) {
        const state = await loadState();
        if (!superDomainOf(state, domain)) return { ok: false, error: "Not a super ban" };
        const removals = { ...state.removals };
        if (!removals[domain]) removals[domain] = newRemoval(Date.now());
        const { locks } = lockChallenge(state.challengeLocks, lockKey("removal", domain));
        await chrome.storage.local.set({ removals, challengeLocks: locks });
        return { ok: true, url: chrome.runtime.getURL(`challenge.html?purpose=removal&d=${encodeURIComponent(domain)}`) };
    },

    async cancelRemoval({ domain }) {
        const state = await loadState();
        const removals = { ...state.removals };
        delete removals[domain];
        await chrome.storage.local.set({ removals });
        return { ok: true };
    },

    async confirmRemoval({ domain }) {
        const state = await loadState();
        if (removalStatus(state.removals[domain], Date.now()) !== "due") {
            return { ok: false, error: "Cool-off hasn't finished yet" };
        }
        const removals = { ...state.removals };
        delete removals[domain];
        await chrome.storage.local.set({ removals, superBans: state.superBans.filter((s) => s.domain !== domain) });
        return { ok: true };
    },

    async getChallenge({ purpose, domain }) {
        const state = await loadState();
        const now = Date.now();
        if (purpose === "removal") {
            const status = removalStatus(state.removals[domain], now);
            if (status !== "challenge") return { ok: false, error: status === "none" ? "No removal requested" : "Challenge already done" };
        } else if (purpose === "endEarly") {
            if (!timerRunning(state.timer, now)) return { ok: false, error: "No focus session running" };
        } else if (purpose !== "settings") {
            return { ok: false, error: "Unknown challenge" };
        }
        const key = lockKey(purpose, domain);
        const { locks, type } = lockChallenge(state.challengeLocks, key);
        if (locks !== state.challengeLocks) await chrome.storage.local.set({ challengeLocks: locks });
        return { ok: true, type, mini: purpose === "endEarly" || purpose === "settings" };
    },

    async swapChallenge({ purpose, domain }) {
        const state = await loadState();
        const r = swapChallenge(state.challengeLocks, lockKey(purpose, domain));
        if (!r) return { ok: false, error: "This challenge can't be swapped." };
        await chrome.storage.local.set({ challengeLocks: r.locks });
        return { ok: true, type: r.type };
    },

    async challengeComplete({ purpose, domain }) {
        const state = await loadState();
        const now = Date.now();
        const challengeLocks = releaseChallenge(state.challengeLocks, lockKey(purpose, domain));
        if (purpose === "removal") {
            const removal = state.removals[domain];
            if (removalStatus(removal, now) !== "challenge") return { ok: false, error: "No challenge pending" };
            const done = completeRemovalChallenge(removal, now, state.settings.coolOffHours);
            await chrome.storage.local.set({ removals: { ...state.removals, [domain]: done }, challengeLocks });
            return { ok: true, dueAt: done.dueAt };
        }
        if (purpose === "endEarly") {
            await chrome.storage.local.set({ challengeLocks });
            await endSession({ completed: false, reason: "ended-early" });
            return { ok: true };
        }
        if (purpose === "settings") {
            const until = now + SETTINGS_UNLOCK_MS;
            await chrome.storage.local.set({ challengeLocks });
            await chrome.storage.local.set({ settingsUnlockedUntil: until });
            return { ok: true, until };
        }
        return { ok: false, error: "Unknown challenge" };
    },

    async startTimer({ minutes, source }) {
        if (!(parseInt(minutes, 10) >= 1)) return { ok: false, error: "Enter a valid time" };
        return startTimer(minutes, source || "popup");
    },

    async savePresets({ presets }) {
        await chrome.storage.local.set({ presets });
        return { ok: true };
    },

    async updateSetting({ key, value }) {
        const state = await loadState();
        const now = Date.now();
        const r = requestSettingChange(state.settings, state.pendingSettings, key, value, now, { unlocked: state.settingsUnlockedUntil > now });
        if (r.status === "invalid") return { ok: false, error: "Invalid setting" };
        if (r.status === "locked") return { ok: false, status: "locked", error: "Settings are locked. Beat the quick challenge first." };
        await chrome.storage.local.set({ settings: r.settings, pendingSettings: r.pending });
        return { ok: true, status: r.status };
    },

    async cancelPendingSetting({ key }) {
        const state = await loadState();
        await chrome.storage.local.set({ pendingSettings: state.pendingSettings.filter((p) => p.key !== key) });
        return { ok: true };
    },

    async getBlockInfo({ domain, category }) {
        const state = await loadState();
        const now = Date.now();
        const day = dayKey();
        const minutesLeft = pauseMinutesLeft(state.pauseUsage, domain, day, state.settings.pauseCapMin);
        const stillBlocked = {
            super: () => !!superDomainOf(state, domain) && !isPaused(state.pauses, domain, now),
            watched: () => inCooldown(state.cooldowns, domain, now),
            ban: () => bansActive(state, now) && state.bans.includes(domain)
        }[category]?.() ?? false;
        return {
            ok: true,
            category,
            stillBlocked,
            cooldown: state.cooldowns[domain] || null,
            tripsToday: readDaily(state.trips, day, domain),
            nextCooldownMin: nextCooldownMinutes(state.trips, domain, day, state.settings.watchCooldownMin),
            attemptsToday: readDaily(state.attempts, day, domain),
            pauseMinutesLeft: minutesLeft,
            pauseOptions: allowedPauseOptions(minutesLeft),
            pauseWaitSec: state.settings.pauseWaitSec,
            timer: timerRunning(state.timer, now) ? state.timer : null,
            now
        };
    },

    async recordAttempt({ domain }) {
        const state = await loadState();
        const attempts = bumpDaily(state.attempts, dayKey(), domain);
        await chrome.storage.local.set({ attempts });
        bumpStat("attempts", domain);
        return { ok: true, attemptsToday: attempts.byKey[domain] };
    },

    async pauseStart({ domain, minutes }) {
        const state = await loadState();
        const now = Date.now();
        if (!superDomainOf(state, domain)) return { ok: false, error: "Not a super ban" };
        const left = pauseMinutesLeft(state.pauseUsage, domain, dayKey(), state.settings.pauseCapMin);
        if (!allowedPauseOptions(left).includes(Number(minutes))) return { ok: false, error: "Daily pause limit reached" };
        const pauseRequests = { ...state.pauseRequests, [domain]: startWait(now, Number(minutes)) };
        await chrome.storage.local.set({ pauseRequests });
        return { ok: true, remainingMs: state.settings.pauseWaitSec * 1000 };
    },

    async pauseBeat({ domain, hidden }) {
        const state = await loadState();
        const now = Date.now();
        const request = state.pauseRequests[domain];
        if (!request) return { ok: false, error: "No pause in progress" };
        const next = beat(request, now, { hidden });
        await chrome.storage.local.set({ pauseRequests: { ...state.pauseRequests, [domain]: next } });
        return { ok: true, reset: next.reset, remainingMs: waitRemainingMs(next, now, state.settings.pauseWaitSec) };
    },

    async pauseComplete({ domain }) {
        const state = await loadState();
        const now = Date.now();
        const request = state.pauseRequests[domain];
        if (!canComplete(request, now, state.settings.pauseWaitSec)) return { ok: false, error: "Countdown not finished" };
        const day = dayKey();
        const left = pauseMinutesLeft(state.pauseUsage, domain, day, state.settings.pauseCapMin);
        if (request.minutes > left) return { ok: false, error: "Daily pause limit reached" };
        const { pauses, usage } = grantPause(state.pauses, state.pauseUsage, domain, request.minutes, now, day);
        bumpStat("pauses", domain, request.minutes);
        const pauseRequests = { ...state.pauseRequests };
        delete pauseRequests[domain];
        await chrome.storage.local.set({ pauses, pauseUsage: usage, pauseRequests });
        chrome.alarms.create(`${ALARM_PAUSE_PREFIX}${domain}`, { when: pauses[domain].until });
        return { ok: true, until: pauses[domain].until };
    },

    async pauseCancel({ domain }) {
        const state = await loadState();
        const pauseRequests = { ...state.pauseRequests };
        delete pauseRequests[domain];
        await chrome.storage.local.set({ pauseRequests });
        return { ok: true };
    }
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    const handler = handlers[msg?.action];
    if (!handler) return false;
    ready
        .then(() => handler(msg, sender))
        .then(sendResponse, (err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
});

chrome.storage.onChanged.addListener((changes) => {
    if (Object.keys(changes).some((key) => RULE_KEYS.has(key))) ready.then(scheduleRebuild);
});

// ---------- context menu ----------

function createContextMenu() {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: CONTEXT_MENU_ID,
            title: "Ban this site in Tab Sniper",
            contexts: ["page", "action"]
        });
    });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== CONTEXT_MENU_ID || !tab?.url) return;
    ready.then(async () => {
        const result = await handlers.addBan({ input: tab.url });
        if (result.ok) notify("Site banned", `${result.domain} added to your bans.`);
    });
});

// ---------- startup ----------

chrome.runtime.onInstalled.addListener((details) => {
    createContextMenu();
    if (details.reason === "install") chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
});

async function init() {
    await runMigration();
    chrome.alarms.create(ALARM_TICK, { periodInMinutes: 0.5 });
    await tick();
    await scheduleRebuild();
}

const ready = init().catch((e) => console.error("init failed", e));
