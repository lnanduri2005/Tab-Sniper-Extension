import { send, formatDuration, formatClock } from "./lib/api.js";
import { SETTING_LIMITS } from "./lib/defaults.js";
import { createRoamer } from "./ui/roam.js";
import { createTapper } from "./ui/status.js";
import { CHALLENGE_LABELS } from "./challenges/index.js";
import { confirmBox } from "./ui/confirm.js";
import { normalizeDomain } from "./lib/match.js";
import { say } from "./ui/voice.js";
import { ICONS } from "./ui/icons.js";
import { loadSoundSetting, setSoundEnabled, play } from "./ui/sound.js";
import { el, $ } from "./ui/dom.js";
import { tierChip, tierIcon, iconButton, TIER_NAMES } from "./ui/tiers.js";

let state = null;
let tab = "overview";
let selectedMinutes = 25;
let focusTick = null;
let watchChoice = null;

const roamer = createRoamer({ mood: "idle", size: 96, play, onTap: () => onTap() });
const mascot = roamer.mascot;
const onTap = createTapper({ mascot, getState: () => state, speak: (t) => roamer.say(t), play });

// Perches: one "home" spot per tab where it sits on top of something, plus peeks
// behind the window's edges for idle wandering. Action perches sit on each Sites column.
const PERCHES = [
    { id: "window-top", target: ".dash", mode: "sit", align: 0.88 },
    { id: "peek-top-left", target: ".dash", mode: "peek", side: "top", align: 0.16 },
    { id: "peek-top-mid", target: ".dash", mode: "peek", side: "top", align: 0.55 },
    { id: "peek-right", target: ".dash", mode: "peek", side: "right", align: 0.35, bubble: "right" },
    { id: "peek-right-low", target: ".dash", mode: "peek", side: "right", align: 0.8, bubble: "right" },
    { id: "overview", target: "#panel-overview .side h2", mode: "sit", align: 0.85, noWander: true },
    { id: "col-ban", target: "#head-ban", mode: "sit", align: 0.85, noWander: true },
    { id: "col-watched", target: "#head-watched", mode: "sit", align: 0.85, noWander: true },
    { id: "col-super", target: "#head-super", mode: "sit", align: 0.85, noWander: true },
    { id: "focus", target: "#panel-focus .side h2", mode: "sit", align: 0.85, noWander: true },
    { id: "stats", target: "#heat", mode: "sit", align: 0.96, noWander: true },
    { id: "settings", target: ".dash", mode: "sit", align: 0.78, noWander: true }
];
const TAB_HOME = { overview: "overview", sites: "col-super", focus: "focus", stats: "stats", settings: "settings" };

const tries = (n) => `${n} ${n === 1 ? "try" : "tries"}`;

// Speak (and optionally hop somewhere first).
function corner(text, mood, ms = 2400, perch = null) {
    if (perch) {
        roamer.goTo(perch, { mood, say: text });
        return;
    }
    if (text) roamer.say(text);
    if (mood) mascot.express(mood, ms);
}

function say$(id, text, isError = false) {
    $(id).textContent = text || "";
    if (isError) {
        mascot.express("grudging", 1600);
        mascot.react("shake");
    }
}

async function refresh() {
    const res = await send("getState");
    if (!res.ok) return;
    state = res;
    mascot.setMood(state.timer ? "idle" : state.bansActive ? "mischievous" : "sleep");
    roamer.setStill(!!state.settings.mascotStill);
    renderStatePill();
    renderOverview();
    renderStats();
    // Don't redraw a region while someone is editing a field inside it (Watched limits,
    // focus timer, settings). The add forms live outside these regions, so lists always update.
    const editingIn = (id) => {
        const active = document.activeElement;
        return !!active?.matches?.("input, select") && !!active.closest(`#${id}`);
    };
    if (editingIn("watch-list")) renderSiteLists({ skipWatched: true });
    else renderSites();
    if (!editingIn("focus-box")) renderFocus();
    if (!editingIn("settings")) renderSettings();
}

// ---------- awake / asleep, in plain words, with its own button ----------

async function toggleAwake() {
    const turningOn = !state.bansActive;
    const r = await send("toggle", { enabled: turningOn });
    if (!r.ok) return corner(r.error, "grudging");
    if (turningOn) {
        corner("Awake. Try me.", "happy");
        mascot.react("bounce");
        play("happy");
    } else {
        corner("Napping. Super bans and Watched sites still count.", "grudging");
    }
}

function napButton(label = "Nap") {
    return el("button", { class: "btn small cream", html: `${ICONS.moon}<span>${label}</span>`, onclick: toggleAwake });
}

function renderStatePill() {
    const pill = $("state-pill");
    if (state.timer) {
        pill.replaceChildren(el("span", { class: "state", html: `${ICONS.lock} Focus session: bans locked on` }));
    } else if (state.bansActive) {
        pill.replaceChildren(el("span", { class: "state", text: "Awake: bans on" }), napButton());
    } else {
        pill.replaceChildren(
            el("span", { class: "state", text: "Asleep: bans off" }),
            el("button", { class: "btn small", html: `${ICONS.sun}<span>Wake up</span>`, onclick: toggleAwake })
        );
    }
}

// ---------- overview ----------

function todayRows() {
    const now = Date.now();
    const rows = [];
    for (const s of state.superBans) {
        if (s.pausedUntil) rows.push({ tier: "super", domain: s.domain, meta: "paused", when: formatDuration(s.pausedUntil - now) });
    }
    for (const w of state.watched) {
        if (w.cooldown) {
            rows.push({ tier: "watched", domain: w.domain, meta: `cooldown: ${w.cooldown.reason}`, when: formatDuration(w.cooldown.until - now), hot: true });
            continue;
        }
        const top = [...w.usage].sort((a, b) => b.used / b.limit - a.used / a.limit)[0];
        if (top && top.used >= 1) {
            rows.push({ tier: "watched", domain: w.domain, meta: top.kind === "streak" ? "short-form streak" : top.kind === "swipes" ? "swipes" : "this visit", when: top.kind === "swipes" ? `${top.used}/${top.limit}` : `${Math.floor(top.used)}/${top.limit} min` });
        }
    }
    const attempts = Object.entries(state.attemptsToday || {}).sort((a, b) => b[1] - a[1]);
    for (const [domain, n] of attempts) {
        if (rows.some((r) => r.domain === domain)) continue;
        const tier = state.superBans.some((s) => s.domain === domain) ? "super" : state.watched.some((w) => w.domain === domain) ? "watched" : "ban";
        rows.push({ tier, domain, meta: "blocked", when: tries(n) });
    }
    return rows;
}

function row(r) {
    return el("li", { class: "row" }, [
        tierIcon(r.tier),
        el("div", { class: "grow" }, [el("div", { class: "name", text: r.domain }), el("div", { class: "meta", text: `${TIER_NAMES[r.tier]} · ${r.meta}` })]),
        r.when ? el("span", { class: `when ${r.hot ? "hot" : ""}`, text: r.when }) : null,
        r.action || null
    ]);
}

function renderOverview() {
    const rows = todayRows();
    $("today").replaceChildren(
        ...(rows.length ? rows.map(row) : [el("li", { class: "empty", text: "Nothing yet today. Keep it that way." })])
    );

    const s = state.stats;
    const changeText = s.change == null ? "" : s.change < 0 ? `, down ${-s.change}% from last week` : s.change > 0 ? `, up ${s.change}% from last week` : ", same as last week";
    $("week").replaceChildren(
        el("li", {}, [el("strong", { text: tries(s.thisWeek) }), ` at blocked sites${changeText}.`]),
        el("li", {}, [el("strong", { text: String(s.tripsThisWeek) }), ` Watched ${s.tripsThisWeek === 1 ? "cutoff" : "cutoffs"}.`]),
        el("li", {}, [el("strong", { text: `${s.pausesThisWeek} min` }), " of super-ban pauses."]),
        el("li", {}, [el("strong", { text: `${s.focusThisWeek} min` }), " of finished focus sessions."])
    );

    const pending = state.superBans.filter((b) => b.removalStatus !== "none");
    $("pending-box").hidden = !pending.length;
    $("pending").replaceChildren(...pending.map((b) => superRow(b)));
}

// ---------- sites ----------

function colHead(id, tier, title, count) {
    $(id).replaceChildren(tierIcon(tier), el("h2", { text: title }), el("span", { class: "count", text: count }));
}

function superStatus(b) {
    const now = Date.now();
    if (b.removalStatus === "cooling") return { meta: `removable in ${formatDuration(b.removal.dueAt - now)}`, hot: true };
    if (b.removalStatus === "due") return { meta: "removal ready to confirm", hot: true };
    if (b.removalStatus === "challenge") return { meta: "removal: challenge not done" };
    if (b.pausedUntil) return { meta: `paused ${formatDuration(b.pausedUntil - now)}` };
    return { meta: `${tries(b.attemptsToday)} today · ${b.pauseMinutesLeft} pause min left` };
}

function superRow(b) {
    const { meta, hot } = superStatus(b);
    const btn = (label, cls, fn) => el("button", { class: `btn small ${cls}`, text: label, onclick: fn });
    const actions = [];
    if (b.removalStatus === "none") {
        actions.push(btn("Request removal", "ghost", async () => {
            const r = await send("requestRemoval", { domain: b.domain });
            if (r.ok) {
                corner("Oh? Let's see you earn it.", "smug", 2400, "col-super");
                chrome.tabs.create({ url: r.url });
            } else say$("super-message", r.error, true);
        }));
    }
    if (b.removalStatus === "challenge") {
        actions.push(btn("Do challenge", "", async () => {
            const r = await send("requestRemoval", { domain: b.domain });
            if (r.ok) chrome.tabs.create({ url: r.url });
        }));
    }
    if (b.removalStatus === "due") {
        actions.push(btn("Confirm removal", "danger", async () => {
            mascot.express("nervous", 4000);
            const ok = await confirmBox({
                title: `Remove the super ban on ${b.domain}?`,
                confirmLabel: "Remove",
                tone: "danger"
            });
            if (!ok) return corner("Good call.", "happy");
            const r = await send("confirmRemoval", { domain: b.domain });
            if (!r.ok) return say$("super-message", r.error, true);
            corner("Fine. It's gone. I'll miss guarding it.", "grudging", 3000);
        }));
    }
    if (b.removalStatus !== "none") {
        actions.push(btn("Cancel removal", "ghost", async () => {
            await send("cancelRemoval", { domain: b.domain });
            corner("Good call.", "happy");
            play("happy");
        }));
    }
    return el("li", { class: "row" }, [
        el("div", { class: "grow" }, [el("div", { class: "name", text: b.domain }), el("div", { class: `meta ${hot ? "hot" : ""}`, text: meta })]),
        el("div", { class: "actions" }, actions)
    ]);
}

const WATCH_FIELDS = [
    { key: "visitLimitMin", label: "min per visit" },
    { key: "streakLimitMin", label: "min short-form" },
    { key: "swipeLimit", label: "swipes" }
];

function watchMeta(w) {
    if (w.cooldown) return `Cooldown, ${formatDuration(w.cooldown.until - Date.now())} left (${w.cooldown.reason}). Locked until it ends.`;
    const names = { visit: "visit", streak: "short-form", swipes: "swipes" };
    const parts = w.usage.map((m) => `${names[m.kind]} ${Math.floor(m.used)}/${m.limit}`);
    return `${w.label || "custom"} · ${parts.join(" · ")}${w.tripsToday ? ` · ${w.tripsToday} cutoffs today` : ""}`;
}

function watchRow(w) {
    const cooling = !!w.cooldown;
    const limits = WATCH_FIELDS.filter((f) => f.key in w).map((f) => {
        const input = el("input", { class: "field", type: "number", value: String(w[f.key]), "aria-label": `${w.domain} ${f.label}` });
        input.disabled = cooling;
        input.addEventListener("change", async () => {
            const r = await send("updateWatched", { domain: w.domain, field: f.key, value: input.value });
            say$("watch-message", r.ok ? `${w.domain}: ${r.value} ${f.label}.` : r.error, !r.ok);
            if (r.ok) mascot.react("nod");
        });
        return el("label", {}, [input, f.label]);
    });
    return el("li", { class: "row" }, [
        el("div", { class: "grow" }, [el("div", { class: "name", text: w.domain }), el("div", { class: `meta ${cooling ? "hot" : ""}`, text: watchMeta(w) })]),
        iconButton("x", `Stop watching ${w.domain}`, async () => {
            const r = await send("removeWatched", { domain: w.domain });
            if (!r.ok) return say$("watch-message", r.error, true);
            mascot.express("grudging", 1400);
        }, { disabled: cooling, title: cooling ? "Locked until the cooldown ends" : null }),
        el("div", { class: "limits" }, limits)
    ]);
}

function renderSites() {
    renderSiteLists();
}

function renderSiteLists({ skipWatched = false } = {}) {
    colHead("head-super", "super", "Super bans", state.superBans.length);
    colHead("head-watched", "watched", "Watched", state.watched.length);
    colHead("head-ban", "ban", "Bans", state.bans.length);
    const lock = $("ban-lock");
    lock.hidden = !state.bansActive || !state.bans.length;
    if (!lock.hidden) {
        lock.replaceChildren(
            el("span", { html: ICONS.lock }),
            el("span", { class: "text", text: state.timer ? "Locked during your focus session." : "Bans can only be removed while I'm napping." }),
            state.timer ? null : napButton()
        );
    }

    $("super-list").replaceChildren(...(state.superBans.length ? state.superBans.map(superRow) : [el("li", { class: "empty", text: "No super bans yet." })]));
    if (!skipWatched) {
        $("watch-list").replaceChildren(...(state.watched.length ? state.watched.map(watchRow) : [el("li", { class: "empty", text: "Nothing watched yet. YouTube and Instagram are good places to start." })]));
    }
    $("ban-list").replaceChildren(
        ...(state.bans.length
            ? state.bans.map((d) =>
                el("li", { class: "row" }, [
                    el("div", { class: "grow name", text: d }),
                    iconButton("x", `Remove ${d}`, async () => {
                        const r = await send("removeBan", { domain: d });
                        if (!r.ok) return say$("ban-message", r.error, true);
                        mascot.express("grudging", 1400);
                    }, { disabled: state.bansActive, title: state.bansActive ? "Nap first to remove bans" : null })
                ]))
            : [el("li", { class: "empty", text: "No bans yet." })])
    );

    const select = $("watch-profile");
    const taken = new Set(state.watched.map((w) => w.domain));
    select.replaceChildren(
        ...state.profiles.filter((p) => !taken.has(p.domain)).map((p) => el("option", { value: p.key, text: p.label })),
        el("option", { value: "", text: "Custom domain..." })
    );
    if (watchChoice !== null && [...select.options].some((o) => o.value === watchChoice)) select.value = watchChoice;
    else select.selectedIndex = 0;
    $("watch-input").hidden = select.value !== "";
}

$("watch-profile").addEventListener("change", () => {
    watchChoice = $("watch-profile").value;
    $("watch-input").hidden = watchChoice !== "";
});

$("watch-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const profile = $("watch-profile").value;
    const r = await send("addWatched", profile ? { profile } : { input: $("watch-input").value });
    if (!r.ok) return say$("watch-message", r.error, true);
    $("watch-input").value = "";
    say$("watch-message", `Watching ${r.domain}.`);
    corner(`I'll keep an eye on ${r.domain}.`, "mischievous", 2400, "col-watched");
    play("happy");
});

$("ban-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const r = await send("addBan", { input: $("ban-input").value });
    if (!r.ok) return say$("ban-message", r.error, true);
    $("ban-input").value = "";
    say$("ban-message", "");
    corner(`${r.domain}. Noted.`, "smug", 2400, "col-ban");
    play("happy");
});

$("super-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("super-input").value.trim();
    if (!input) return;
    const domain = normalizeDomain(input) || input;
    roamer.goTo("col-super", { mood: "stern" });
    const ok = await confirmBox({
        title: `Super ban ${domain}?`,
        body: `It's blocked 24/7, even while I nap. Undoing it takes a random challenge and a ${state.settings.coolOffHours}h wait.`,
        confirmLabel: "Lock it",
        tone: "super",
        mascot: { mood: "stern", line: "You sure? I don't let these go easily." }
    });
    if (!ok) return;
    const r = await send("addSuperBan", { input });
    if (!r.ok) return say$("super-message", r.error, true);
    $("super-input").value = "";
    say$("super-message", `${r.domain} is locked.`);
    corner(`${r.domain} is in the vault now.`, "stern", 2600, "col-super");
    play("deny");
});

// ---------- focus ----------

function renderFocus() {
    clearInterval(focusTick);
    const box = $("focus-box");
    if (state.timer) {
        const clock = el("div", { class: "clock" });
        const update = () => {
            const left = state.timer.endTime - Date.now();
            clock.textContent = formatDuration(left);
            if (left <= 0) {
                clearInterval(focusTick);
                setTimeout(refresh, 1200);
            }
        };
        update();
        focusTick = setInterval(update, 1000);
        box.replaceChildren(
            el("h2", { text: "Focus session running" }),
            clock,
            el("p", { class: "muted small", text: "Bans stay on until it ends. Ending early takes a short challenge." }),
            el("button", { class: "btn ghost", html: `${ICONS.stop}<span>End early</span>`, onclick: () => chrome.tabs.create({ url: chrome.runtime.getURL("challenge.html?purpose=endEarly") }) })
        );
    } else {
        const options = [
            { minutes: 25, label: "25 min" },
            { minutes: 50, label: "50 min" },
            ...state.presets.map((p) => ({ minutes: p.minutes, label: `${p.name} · ${p.minutes}`, preset: p }))
        ];
        // Each preset chip is a radio plus a separate, keyboard-reachable delete button.
        const chips = el("div", { class: "chips", role: "radiogroup", "aria-label": "Focus length" }, options.map((o) => {
            const chip = el("button", {
                class: "chip",
                role: "radio",
                "aria-checked": String(o.minutes === selectedMinutes),
                onclick: () => {
                    selectedMinutes = o.minutes;
                    renderFocus();
                }
            }, [o.label]);
            if (!o.preset) return chip;
            const del = el("button", {
                class: "chip-del",
                "aria-label": `Delete preset ${o.preset.name}`,
                title: `Delete preset ${o.preset.name}`,
                html: ICONS.x,
                onclick: async () => {
                    await send("savePresets", { presets: state.presets.filter((p) => p.id !== o.preset.id) });
                }
            });
            return el("span", { class: "chip-wrap" }, [chip, del]);
        }));
        const custom = el("input", { class: "field", type: "number", min: "1", max: "240", value: String(selectedMinutes), "aria-label": "Custom minutes" });
        custom.addEventListener("change", () => {
            const n = parseInt(custom.value, 10);
            if (n >= 1 && n <= 240) {
                selectedMinutes = n;
                renderFocus();
            }
        });
        const name = el("input", { class: "field", placeholder: "Preset name", "aria-label": "Preset name" });
        box.replaceChildren(
            el("div", { class: "clock", text: `${String(selectedMinutes).padStart(2, "0")}:00` }),
            chips,
            el("div", { class: "chips" }, [custom, el("span", { class: "muted small", text: "min" })]),
            el("button", {
                class: "btn",
                html: `${ICONS.play}<span>Start ${selectedMinutes} min</span>`,
                onclick: async () => {
                    const r = await send("startTimer", { minutes: selectedMinutes, source: "dashboard" });
                    if (!r.ok) return corner(r.error, "grudging");
                    corner("Locked in. I've got the door.", "proud");
                    mascot.react("bounce");
                    play("happy");
                }
            }),
            el("form", {
                class: "chips",
                onsubmit: async (e) => {
                    e.preventDefault();
                    if (!name.value.trim()) return;
                    await send("savePresets", { presets: [...state.presets, { id: Date.now(), name: name.value.trim(), minutes: selectedMinutes }] });
                    mascot.react("nod");
                }
            }, [name, el("button", { class: "btn small ghost", type: "submit", text: `Save ${selectedMinutes} min preset` })])
        );
    }

    $("history").replaceChildren(
        ...(state.history.length
            ? state.history.slice(0, 12).map((h) => {
                const d = new Date(h.date);
                const status = h.completed ? "finished" : h.reason === "ended-early" ? "ended early" : state.timer?.sessionId === h.id ? "running" : "unfinished";
                return el("li", { class: "row" }, [
                    el("div", { class: "grow" }, [
                        el("div", { class: "name", text: `${h.duration} min` }),
                        el("div", { class: "meta", text: `${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` })
                    ]),
                    el("span", { class: `when ${h.completed ? "" : "hot"}`, text: status })
                ]);
            })
            : [el("li", { class: "empty", text: "No focus sessions yet." })])
    );
}

// ---------- stats ----------

function level(n, max) {
    if (!n) return 0;
    const r = n / Math.max(max, 1);
    return r > 0.75 ? 4 : r > 0.5 ? 3 : r > 0.25 ? 2 : 1;
}

function statsLine() {
    const s = state.stats;
    if (s.trend === "down") return say("stats.down", { pct: -s.change });
    if (s.trend === "up") return say("stats.up", { pct: s.change });
    return say(`stats.${s.trend}`);
}

function renderStats() {
    const s = state.stats;
    $("stats-lede").textContent = s.total30
        ? `${tries(s.total30)} at blocked sites in the last 30 days.`
        : "No attempts in the last 30 days. Your pattern shows up here as you go.";
    const max = Math.max(...s.series.map((d) => d.attempts), 1);
    $("heat").setAttribute("role", "list");
    $("heat").setAttribute("aria-label", `Attempts per day for the last 30 days, busiest day ${max}.`);
    $("heat").replaceChildren(
        ...s.series.map((d, i) => {
            const date = new Date(`${d.day}T12:00:00`);
            const label = `${date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}: ${tries(d.attempts)}${d.trips ? `, ${d.trips} cutoffs` : ""}`;
            return el("div", { class: `cell ${i === s.series.length - 1 ? "today" : ""}`, "data-level": String(level(d.attempts, max)), title: label, role: "listitem", "aria-label": label });
        })
    );
    $("heat-legend").replaceChildren(
        el("span", { text: "30 days ago" }),
        el("span", { class: "scale", "aria-hidden": "true" }, [
            el("span", { text: "Fewer" }),
            ...[0, 1, 2, 3, 4].map((lv) => el("span", { class: "cell", "data-level": String(lv) })),
            el("span", { text: "More" })
        ]),
        el("span", { text: "Today" })
    );

    $("top-sites").replaceChildren(
        ...(s.topSites.length
            ? s.topSites.map(([domain, n]) =>
                el("li", {}, [
                    el("span", { class: "name", text: domain }),
                    el("div", { class: "track" }, [el("div", { class: "fill", style: `width:${(n / s.topSites[0][1]) * 100}%` })]),
                    el("span", { class: "n", text: String(n) })
                ]))
            : [el("li", { class: "empty", text: "No temptations recorded yet." })])
    );
    const changeText = s.change == null ? "" : s.change < 0 ? ` (down ${-s.change}%)` : s.change > 0 ? ` (up ${s.change}%)` : "";
    $("stats-week").replaceChildren(
        el("li", {}, [el("strong", { text: tries(s.thisWeek) }), ` this week vs ${s.lastWeek} last week${changeText}.`]),
        el("li", {}, [el("strong", { text: String(s.tripsThisWeek) }), " Watched cutoffs."]),
        el("li", {}, [el("strong", { text: `${s.pausesThisWeek} min` }), " paused."]),
        el("li", {}, [el("strong", { text: `${s.focusThisWeek} min` }), " focused."])
    );
}

// ---------- settings ----------

const NUMERIC = [
    { key: "watchCooldownMin", label: "Watched cutoff cooldown", desc: "How long the first cutoff each day locks a Watched site. Each cutoff after that doubles it (up to 4h).", unit: "min", toInput: (v) => v, fromInput: Number },
    { key: "pauseWaitSec", label: "Pause wait", desc: "How long you wait on a page you can't leave before a super ban pauses.", unit: "min", toInput: (v) => v / 60, fromInput: (v) => Number(v) * 60 },
    { key: "pauseCapMin", label: "Daily pause allowance", desc: "Pause minutes per super-banned site per day.", unit: "min", toInput: (v) => v, fromInput: Number },
    { key: "coolOffHours", label: "Removal wait", desc: "How long after beating a removal challenge before you can remove a super ban.", unit: "hours", toInput: (v) => v, fromInput: Number }
];

// Feedback lands on the row you changed, not at the bottom of the list. Kept for a few
// seconds so the refresh that follows a save doesn't wipe it.
const rowMessages = {};
function rowStatus(key, text) {
    rowMessages[key] = { text, until: Date.now() + 4000 };
    const slot = document.querySelector(`.setting[data-key="${key}"] .row-status`);
    if (slot) slot.textContent = text;
    else say$("settings-message", text);
}

async function saveSetting(key, value) {
    const r = await send("updateSetting", { key, value });
    if (r.status === "locked") {
        corner("Nice try. Unlock first.", "smug", 2400, "settings");
        renderSettings();
        rowStatus(key, "That would make me easier on you. Unlock Settings first.");
        return;
    }
    if (!r.ok) return rowStatus(key, r.error);
    if (r.status === "applied") {
        rowStatus(key, "Saved.");
        mascot.react("nod");
    }
}

function settingRow({ key = null, label, desc, control, pending, hint = null }) {
    return el("li", { class: "setting", "data-key": key }, [
        el("div", { class: "text" }, [
            el("div", { class: "label", text: label }),
            el("div", { class: "desc", text: desc }),
            hint ? el("div", { class: "hint", html: `${ICONS.lock}<span>${hint}</span>` }) : null,
            pending,
            el("div", { class: "row-status", role: "status", text: key && rowMessages[key]?.until > Date.now() ? rowMessages[key].text : "" })
        ]),
        el("div", { class: "control" }, control)
    ]);
}

// ---------- settings gate ----------

let gateTick = null;
let gateChallengeOpen = false;

const unlocked = () => (state?.settingsUnlockedUntil || 0) > Date.now();

function renderGate() {
    clearInterval(gateTick);
    const gate = $("gate");
    if (gateChallengeOpen) return; // don't redraw over a challenge in progress
    if (unlocked()) {
        gate.className = "gate open";
        const left = el("strong");
        const tick = () => {
            const ms = state.settingsUnlockedUntil - Date.now();
            if (ms <= 0) {
                clearInterval(gateTick);
                refresh();
                return;
            }
            left.textContent = formatDuration(ms);
        };
        tick();
        gateTick = setInterval(tick, 1000);
        gate.replaceChildren(el("div", { class: "gate-head" }, [
            el("div", { class: "text" }, [
                el("div", { class: "label", html: `${ICONS.sun}<span>Unlocked</span>` }),
                el("div", { class: "desc" }, ["Locks again in ", left, ". Change what you came to change."])
            ])
        ]));
        return;
    }
    gate.className = "gate";
    gate.replaceChildren(el("div", { class: "gate-head" }, [
        el("div", { class: "text" }, [
            el("div", { class: "label", html: `${ICONS.lock}<span>Settings are locked</span>` }),
            el("div", { class: "desc", text: "Beat a quick challenge to make me easier on you. It stays unlocked for 15 minutes." })
        ]),
        el("button", { class: "btn small", text: "Unlock", onclick: startGateChallenge })
    ]));
}

async function startGateChallenge() {
    const res = await send("getChallenge", { purpose: "settings" });
    if (!res.ok) return say$("settings-message", res.error, true);
    gateChallengeOpen = true;
    const body = el("div", { class: "gate-body" });
    $("gate").replaceChildren(
        el("div", { class: "gate-head" }, [
            el("div", { class: "text" }, [
                el("div", { class: "label", html: `${ICONS.lock}<span>${CHALLENGE_LABELS[res.type]}</span>` }),
                el("div", { class: "desc", text: "A short one. Leaving this tab keeps the same challenge." })
            ]),
            el("button", { class: "btn small ghost", text: "Never mind", onclick: () => { gateChallengeOpen = false; renderGate(); } })
        ]),
        body
    );
    corner("Go on then.", "mischievous", 2400, "settings");
    const module = await import(`./challenges/${res.type}.js`);
    module.mount(body, {
        mini: true,
        onEvent: (type) => {
            if (type === "mistake") corner(say("challenge.mistake"), "smug");
        },
        onComplete: async () => {
            const done = await send("challengeComplete", { purpose: "settings" });
            gateChallengeOpen = false;
            if (!done.ok) return say$("settings-message", done.error, true);
            corner("Fine. 15 minutes. Make it count.", "grudging", 2600, "settings");
            play("win");
            await refresh();
        }
    });
}

// ---------- backup: export / import a file (no Chrome sync) ----------

function backupRow() {
    const picker = el("input", { type: "file", accept: "application/json,.json", hidden: true, "aria-label": "Choose a Tab Sniper backup file" });
    picker.addEventListener("change", async () => {
        const file = picker.files?.[0];
        picker.value = "";
        if (!file) return;
        let data;
        try {
            data = JSON.parse(await file.text());
        } catch {
            return say$("settings-message", "That file isn't valid JSON.", true);
        }
        const r = await send("importConfig", { data });
        if (!r.ok) return say$("settings-message", r.error, true);
        const s = r.summary;
        const added = [
            s.bans && `${s.bans} ban${s.bans === 1 ? "" : "s"}`,
            s.superBans && `${s.superBans} super ban${s.superBans === 1 ? "" : "s"}`,
            s.watched && `${s.watched} Watched site${s.watched === 1 ? "" : "s"}`,
            s.presets && `${s.presets} preset${s.presets === 1 ? "" : "s"}`,
            s.settings && `${s.settings} setting${s.settings === 1 ? "" : "s"}`
        ].filter(Boolean);
        const skipped = s.settingsSkipped ? ` Skipped ${s.settingsSkipped} easier setting${s.settingsSkipped === 1 ? "" : "s"}: unlock Settings and import again to apply ${s.settingsSkipped === 1 ? "it" : "them"}.` : "";
        say$("settings-message", `${added.length ? `Imported ${added.join(", ")}.` : "Nothing new in that file."}${skipped}`);
        corner(added.length ? "More to guard. Love that." : "Already had all of that.", added.length ? "happy" : "idle", 2400, "settings");
    });
    const exportBtn = el("button", {
        class: "btn small cream",
        text: "Export",
        onclick: async () => {
            const r = await send("exportConfig");
            if (!r.ok) return say$("settings-message", r.error, true);
            const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = el("a", { href: url, download: `tab-sniper-backup-${new Date().toISOString().slice(0, 10)}.json` });
            document.body.append(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            say$("settings-message", "Backup saved to your downloads.");
        }
    });
    const importBtn = el("button", { class: "btn small ghost", text: "Import", onclick: () => picker.click() });
    return settingRow({
        label: "Back up your setup",
        desc: "Save your bans, Watched sites, presets and settings to a file, or load one on another computer. Everything stays on this device unless you move the file yourself.",
        control: [exportBtn, importBtn, picker]
    });
}

function renderSettings() {
    renderGate();
    const open = unlocked();
    const rows = NUMERIC.map((def) => {
        const limits = SETTING_LIMITS[def.key];
        const input = el("input", {
            class: "field",
            type: "number",
            min: String(def.toInput(limits.min)),
            max: String(def.toInput(limits.max)),
            value: String(def.toInput(state.settings[def.key])),
            "aria-label": def.label
        });
        input.addEventListener("change", () => saveSetting(def.key, def.fromInput(input.value)));
        // While locked, the field still accepts stricter values; easier ones get refused and reset.
        return settingRow({
            key: def.key,
            label: def.label,
            desc: def.desc,
            hint: open ? null : "Stricter saves right away. Easier needs the unlock.",
            control: [input, el("span", { class: "muted small", text: def.unit })]
        });
    });

    const select = el("select", { class: "field", "aria-label": "When a banned site opens" }, [
        el("option", { value: "page", text: "Show my block page" }),
        el("option", { value: "close", text: "Close the tab" })
    ]);
    select.value = state.settings.blockAction;
    select.addEventListener("change", () => saveSetting("blockAction", select.value));
    rows.push(settingRow({ key: "blockAction", label: "When a banned site opens", desc: "Super bans and Watched cooldowns always show the block page.", control: [select] }));

    const on = !!state.settings.soundOn;
    const soundBtn = el("button", {
        class: "btn small",
        "aria-pressed": String(on),
        "aria-label": "Mascot sounds",
        html: `${ICONS.sound}<span>${on ? "Blips on" : "Quiet"}</span>`,
        onclick: async () => {
            const next = !on;
            await saveSetting("soundOn", next);
            setSoundEnabled(next);
            if (next) play("happy");
            else mascot.react("nod");
        }
    });
    rows.push(settingRow({ key: "soundOn", label: "Mascot sounds", desc: "Tiny blips when I react. Off by default.", control: [soundBtn] }));

    const still = !!state.settings.mascotStill;
    const stillBtn = el("button", {
        class: "btn small",
        "aria-pressed": String(!still),
        "aria-label": "Mascot wanders around",
        html: `<span>${still ? "Holds still" : "Wanders"}</span>`,
        onclick: async () => {
            await saveSetting("mascotStill", !still);
            roamer.setStill(!still);
            corner(still ? "Free to roam!" : "Fine. I'll sit here.", still ? "happy" : "grudging");
        }
    });
    rows.push(backupRow());
    rows.push(settingRow({ key: "mascotStill", label: "Wandering", desc: "Whether I hop around on my own when you're idle. I still move when you switch tabs.", control: [stillBtn] }));

    $("settings").replaceChildren(...rows);
}

$("replay-tour").addEventListener("click", () => chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") }));

// ---------- tabs ----------

const TABS = ["overview", "sites", "focus", "stats", "settings"];

function selectTab(name, focus = false) {
    tab = name;
    for (const t of TABS) {
        const on = t === name;
        $(`tab-${t}`).setAttribute("aria-selected", String(on));
        $(`tab-${t}`).tabIndex = on ? 0 : -1;
        $(`panel-${t}`).hidden = !on;
        if (on && focus) $(`tab-${t}`).focus();
    }
    if (location.hash !== `#${name}`) history.replaceState(null, "", `#${name}`);
    if (!state) return;
    const lines = {
        overview: [say("dash.hello"), null],
        stats: [statsLine(), state.stats.trend === "up" ? "smug" : state.stats.trend === "down" ? "surprised" : null],
        settings: ["Careful. I remember everything.", "smug"]
    };
    const [text, mood] = lines[name] || [null, null];
    // wait a frame so the newly shown panel has its layout before measuring perches
    // Narrow screens stack everything into one column, so a perch above a heading would sit on
    // the row before it. Home on the window's top edge instead (Sites: the first column).
    const narrow = innerWidth < 960;
    const home = !narrow ? TAB_HOME[name] : name === "sites" ? "col-ban" : name === "stats" ? "stats" : "window-top";
    requestAnimationFrame(() => roamer.goTo(home, { say: text, mood }));
}

TABS.forEach((t) => $(`tab-${t}`).addEventListener("click", () => selectTab(t)));
document.querySelector(".tabs").addEventListener("keydown", (e) => {
    const i = TABS.indexOf(tab);
    if (e.key === "ArrowRight") selectTab(TABS[(i + 1) % TABS.length], true);
    if (e.key === "ArrowLeft") selectTab(TABS[(i + TABS.length - 1) % TABS.length], true);
});

const NOISY_KEYS = new Set(["watch", "activeFocus"]);
chrome.storage.onChanged.addListener((changes) => {
    if (Object.keys(changes).every((k) => NOISY_KEYS.has(k))) return;
    refresh();
});

loadSoundSetting();
await refresh();
const initial = location.hash.slice(1);
roamer.setPerches(PERCHES);
selectTab(TABS.includes(initial) ? initial : "overview");
setInterval(refresh, 30000);
