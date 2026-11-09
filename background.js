// Tab Sniper service worker. Stateless: every event re-reads storage, so nothing breaks
// when Chrome puts the worker to sleep.
import { DEFAULT_SETTINGS, MINUTE_MS } from "./lib/defaults.js";
import { normalizeDomain } from "./lib/match.js";
import { decide, activeBlocks, bansActive, timerRunning, isPaused } from "./lib/policy.js";
import { buildRules, blockPageUrl } from "./lib/rules.js";
import { requestSettingChange, resolvePending } from "./lib/gating.js";
import {
    pauseMinutesLeft, allowedPauseOptions, startWait, beat, waitRemainingMs,
    canComplete, grantPause, prunePauses
} from "./lib/pause.js";
import { newRemoval, completeRemovalChallenge, removalStatus } from "./lib/removal.js";
import { migrate, ensureStatsShape } from "./lib/migrate.js";
import { dayKey, bumpDaily, readDaily } from "./lib/day.js";
import { lockChallenge, releaseChallenge } from "./challenges/index.js";

const BLOCK_PAGE = chrome.runtime.getURL("blocked.html");
const CONTEXT_MENU_ID = "tab-sniper-block-domain";
const ALARM_TICK = "tick";
const ALARM_SESSION_END = "session-end";
const ALARM_PAUSE_PREFIX = "pause-end:";

const SYNC_KEYS = ["enabled", "bans", "superBans", "settings", "pendingSettings", "removals", "challengeLocks", "presets"];
const LOCAL_KEYS = ["timer", "history", "stats", "lastResetWeek", "pauses", "pauseRequests", "pauseUsage", "attempts", "dueNotified"];
const RULE_KEYS = new Set(["enabled", "bans", "superBans", "settings", "timer", "pauses"]);

// ---------- state ----------

async function loadState() {
    const [s, l] = await Promise.all([chrome.storage.sync.get(SYNC_KEYS), chrome.storage.local.get(LOCAL_KEYS)]);
    return {
        enabled: !!s.enabled,
        bans: s.bans || [],
        superBans: s.superBans || [],
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
        dueNotified: l.dueNotified || {}
    };
}

async function runMigration() {
    const [sync, local] = await Promise.all([chrome.storage.sync.get(null), chrome.storage.local.get(null)]);
    const result = migrate(sync, local, Date.now());
    if (!result) return;
    await chrome.storage.sync.set(result.syncSet);
    await chrome.storage.sync.remove(result.syncRemove);
    await chrome.storage.local.set(result.localSet);
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

async function enforceOpenTabs(state, now) {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
        if (tab.url) applyDecision(tab.id, tab.url, decide(tab.url, state, now));
    }
}

async function checkNavigation(tabId, url, { closeOnly = false } = {}) {
    const decision = decide(url, await loadState(), Date.now());
    if (closeOnly && decision.action !== "close") return;
    applyDecision(tabId, url, decision);
}

// "close tab" bans have no DNR rule, so they're handled here.
chrome.webNavigation.onBeforeNavigate.addListener(({ frameId, tabId, url }) => {
    if (frameId === 0) ready.then(() => checkNavigation(tabId, url, { closeOnly: true }));
});
// Fallbacks for anything DNR misses (SPA route changes, rules not built yet).
chrome.webNavigation.onCommitted.addListener(({ frameId, tabId, url }) => {
    if (frameId === 0) ready.then(() => checkNavigation(tabId, url));
});
chrome.webNavigation.onHistoryStateUpdated.addListener(({ frameId, tabId, url }) => {
    if (frameId === 0) ready.then(() => checkNavigation(tabId, url));
});

function updateIcon(state, now) {
    const on = bansActive(state, now);
    chrome.action.setIcon({ path: on ? "icon_mischiveous.png" : "icon_sleep.png" });
}

// ---------- focus timer ----------

function getCurrentWeekKey(date = new Date()) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-${weekNo}`;
}

async function maybeResetWeekly(state) {
    const week = getCurrentWeekKey();
    if (state.lastResetWeek === week) return;
    const update = { lastResetWeek: week };
    if (state.lastResetWeek) {
        update.history = [];
        update.stats = ensureStatsShape({});
    }
    await chrome.storage.local.set(update);
}

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
        await chrome.storage.sync.set({ settings: resolved.settings, pendingSettings: resolved.pending });
    }

    const pruned = prunePauses(state.pauses, now);
    if (pruned.expired) await chrome.storage.local.set({ pauses: pruned.pauses });

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

    await maybeResetWeekly(state);
}

chrome.alarms.onAlarm.addListener((alarm) => {
    ready.then(async () => {
        if (alarm.name === ALARM_SESSION_END) {
            await endSession({ completed: true, reason: "alarm-expired" });
        } else if (alarm.name.startsWith(ALARM_PAUSE_PREFIX) || alarm.name === ALARM_TICK) {
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
    return purpose === "removal" ? `removal:${domain}` : "endEarly";
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
            bans: state.bans,
            presets: state.presets,
            settings: state.settings,
            pendingSettings: state.pendingSettings,
            history: state.history,
            stats: state.stats,
            superBans: state.superBans.map(({ domain, addedAt }) => ({
                domain,
                addedAt,
                pausedUntil: isPaused(state.pauses, domain, now) ? state.pauses[domain].until : null,
                pauseMinutesLeft: pauseMinutesLeft(state.pauseUsage, domain, day, state.settings.pauseCapMin),
                removal: state.removals[domain] || null,
                removalStatus: removalStatus(state.removals[domain], now),
                attemptsToday: readDaily(state.attempts, day, domain)
            }))
        };
    },

    async toggle({ enabled }) {
        const state = await loadState();
        if (!enabled && timerRunning(state.timer, Date.now())) {
            return { ok: false, error: "Can't turn off during a focus session" };
        }
        await chrome.storage.sync.set({ enabled: !!enabled });
        return { ok: true };
    },

    async addBan({ input }) {
        const domain = normalizeDomain(input);
        if (!domain) return { ok: false, error: "That doesn't look like a website" };
        const state = await loadState();
        if (!state.bans.includes(domain)) await chrome.storage.sync.set({ bans: [...state.bans, domain] });
        return { ok: true, domain };
    },

    async removeBan({ domain }) {
        const state = await loadState();
        if (bansActive(state, Date.now())) return { ok: false, error: "Turn Tab Sniper off to remove bans" };
        await chrome.storage.sync.set({ bans: state.bans.filter((d) => d !== domain) });
        return { ok: true };
    },

    async addSuperBan({ input }) {
        const domain = normalizeDomain(input);
        if (!domain) return { ok: false, error: "That doesn't look like a website" };
        const state = await loadState();
        if (superDomainOf(state, domain)) return { ok: true, domain };
        await chrome.storage.sync.set({ superBans: [...state.superBans, { domain, addedAt: Date.now() }] });
        return { ok: true, domain };
    },

    async requestRemoval({ domain }) {
        const state = await loadState();
        if (!superDomainOf(state, domain)) return { ok: false, error: "Not a super ban" };
        const removals = { ...state.removals };
        if (!removals[domain]) removals[domain] = newRemoval(Date.now());
        const { locks } = lockChallenge(state.challengeLocks, lockKey("removal", domain));
        await chrome.storage.sync.set({ removals, challengeLocks: locks });
        return { ok: true, url: chrome.runtime.getURL(`challenge.html?purpose=removal&d=${encodeURIComponent(domain)}`) };
    },

    async cancelRemoval({ domain }) {
        const state = await loadState();
        const removals = { ...state.removals };
        delete removals[domain];
        await chrome.storage.sync.set({ removals });
        return { ok: true };
    },

    async confirmRemoval({ domain }) {
        const state = await loadState();
        if (removalStatus(state.removals[domain], Date.now()) !== "due") {
            return { ok: false, error: "Cool-off hasn't finished yet" };
        }
        const removals = { ...state.removals };
        delete removals[domain];
        await chrome.storage.sync.set({ removals, superBans: state.superBans.filter((s) => s.domain !== domain) });
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
        } else {
            return { ok: false, error: "Unknown challenge" };
        }
        const key = lockKey(purpose, domain);
        const { locks, type } = lockChallenge(state.challengeLocks, key);
        if (locks !== state.challengeLocks) await chrome.storage.sync.set({ challengeLocks: locks });
        return { ok: true, type, mini: purpose === "endEarly" };
    },

    async challengeComplete({ purpose, domain }) {
        const state = await loadState();
        const now = Date.now();
        const challengeLocks = releaseChallenge(state.challengeLocks, lockKey(purpose, domain));
        if (purpose === "removal") {
            const removal = state.removals[domain];
            if (removalStatus(removal, now) !== "challenge") return { ok: false, error: "No challenge pending" };
            const done = completeRemovalChallenge(removal, now, state.settings.coolOffHours);
            await chrome.storage.sync.set({ removals: { ...state.removals, [domain]: done }, challengeLocks });
            return { ok: true, dueAt: done.dueAt };
        }
        if (purpose === "endEarly") {
            await chrome.storage.sync.set({ challengeLocks });
            await endSession({ completed: false, reason: "ended-early" });
            return { ok: true };
        }
        return { ok: false, error: "Unknown challenge" };
    },

    async startTimer({ minutes, source }) {
        if (!(parseInt(minutes, 10) >= 1)) return { ok: false, error: "Enter a valid time" };
        return startTimer(minutes, source || "popup");
    },

    async savePresets({ presets }) {
        await chrome.storage.sync.set({ presets });
        return { ok: true };
    },

    async updateSetting({ key, value }) {
        const state = await loadState();
        const r = requestSettingChange(state.settings, state.pendingSettings, key, value, Date.now());
        if (r.status === "invalid") return { ok: false, error: "Invalid setting" };
        await chrome.storage.sync.set({ settings: r.settings, pendingSettings: r.pending });
        return { ok: true, status: r.status, effectiveAt: r.effectiveAt };
    },

    async cancelPendingSetting({ key }) {
        const state = await loadState();
        await chrome.storage.sync.set({ pendingSettings: state.pendingSettings.filter((p) => p.key !== key) });
        return { ok: true };
    },

    async getBlockInfo({ domain, category }) {
        const state = await loadState();
        const now = Date.now();
        const day = dayKey();
        const minutesLeft = pauseMinutesLeft(state.pauseUsage, domain, day, state.settings.pauseCapMin);
        return {
            ok: true,
            category,
            stillBlocked: category === "super"
                ? !!superDomainOf(state, domain) && !isPaused(state.pauses, domain, now)
                : bansActive(state, now) && state.bans.includes(domain),
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

chrome.runtime.onInstalled.addListener(createContextMenu);

async function init() {
    await runMigration();
    chrome.alarms.create(ALARM_TICK, { periodInMinutes: 1 });
    await tick();
    await scheduleRebuild();
}

const ready = init().catch((e) => console.error("init failed", e));
