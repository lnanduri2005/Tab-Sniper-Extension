import { send, formatDuration, formatClock } from "./lib/api.js";
import { SETTING_LIMITS } from "./lib/defaults.js";
import { createRoamer } from "./ui/roam.js";
import { createTapper } from "./ui/status.js";
import { say } from "./ui/voice.js";
import { ICONS } from "./ui/icons.js";
import { loadSoundSetting, setSoundEnabled, play } from "./ui/sound.js";
import { el, $ } from "./ui/dom.js";
import { tierChip, tierIcon, iconButton, TIER_NAMES } from "./ui/tiers.js";

let state = null;
let tab = "overview";
let selectedMinutes = 25;
let pendingSuper = null;
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
    { id: "settings", target: "#settings", mode: "sit", align: 0.94, noWander: true }
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
        actions.push(btn("Confirm removal", "danger", async (e) => {
            const target = e.currentTarget;
            if (!target.dataset.armed) {
                target.dataset.armed = "1";
                target.textContent = "Really remove?";
                corner("Last chance to change your mind.", "nervous", 3000);
                setTimeout(() => {
                    delete target.dataset.armed;
                    target.textContent = "Confirm removal";
                }, 4000);
                return;
            }
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
        el("div", { class: "grow" }, [el("div", { class: "name", text: b.domain }), el("div", { class: `meta ${hot ? "when hot" : ""}`, text: meta })]),
        el("div", { class: "actions" }, actions)
    ]);
}

const WATCH_FIELDS = [
    { key: "visitLimitMin", label: "min per visit" },
    { key: "streakLimitMin", label: "min short-form" },
    { key: "swipeLimit", label: "swipes" }
];

function watchMeta(w) {
    if (w.cooldown) return `cooldown ${formatDuration(w.cooldown.until - Date.now())}: ${w.cooldown.reason}`;
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
        el("div", { class: "grow" }, [el("div", { class: "name", text: w.domain }), el("div", { class: `meta ${cooling ? "when hot" : ""}`, text: watchMeta(w) })]),
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
                    }, { disabled: state.bansActive, title: state.bansActive ? "Put me to sleep first to remove bans" : null })
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
    if (pendingSuper !== input) {
        pendingSuper = input;
        $("super-add").textContent = "Confirm";
        say$("super-message", `Blocks it 24/7. Undoing takes a challenge plus a ${state.settings.coolOffHours}h cool-off. Press Confirm to lock it in.`);
        corner("You sure? This one's serious.", "surprised", 2400, "col-super");
        return;
    }
    pendingSuper = null;
    $("super-add").textContent = "Add";
    const r = await send("addSuperBan", { input });
    if (!r.ok) return say$("super-message", r.error, true);
    $("super-input").value = "";
    say$("super-message", `${r.domain} is locked.`);
    corner(`${r.domain} is in the vault now.`, "stern", 2600, "col-super");
    play("deny");
});
$("super-input").addEventListener("input", () => {
    pendingSuper = null;
    $("super-add").textContent = "Add";
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
            if (o.preset) {
                chip.append(el("span", {
                    class: "del",
                    role: "button",
                    "aria-label": `Delete preset ${o.preset.name}`,
                    html: ICONS.x,
                    onclick: async (e) => {
                        e.stopPropagation();
                        await send("savePresets", { presets: state.presets.filter((p) => p.id !== o.preset.id) });
                    }
                }));
            }
            return chip;
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
    $("heat").setAttribute("aria-label", `Attempts per day for the last 30 days, busiest day ${max}.`);
    $("heat").replaceChildren(
        ...s.series.map((d, i) => {
            const date = new Date(`${d.day}T12:00:00`);
            const label = `${date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}: ${tries(d.attempts)}${d.trips ? `, ${d.trips} cutoffs` : ""}`;
            return el("div", { class: `cell ${i === s.series.length - 1 ? "today" : ""}`, "data-level": String(level(d.attempts, max)), title: label });
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
    { key: "pauseWaitSec", label: "Pause wait", desc: "How long you wait on a page you can't leave before a super ban pauses.", unit: "min", toInput: (v) => v / 60, fromInput: (v) => Number(v) * 60 },
    { key: "pauseCapMin", label: "Daily pause allowance", desc: "Pause minutes per super-banned site per day.", unit: "min", toInput: (v) => v, fromInput: Number },
    { key: "coolOffHours", label: "Removal cool-off", desc: "Wait between finishing a removal challenge and confirming it.", unit: "hours", toInput: (v) => v, fromInput: Number }
];

async function saveSetting(key, value) {
    const r = await send("updateSetting", { key, value });
    if (!r.ok) return say$("settings-message", r.error, true);
    if (r.status === "pending") {
        say$("settings-message", `Easier setting scheduled for ${formatClock(r.effectiveAt)}.`);
        corner("Nice try. That kicks in later.", "smug", 2400, "settings");
    } else if (r.status === "applied") {
        say$("settings-message", "Saved.");
        mascot.react("nod");
    }
}

function settingRow({ label, desc, control, pending }) {
    return el("li", { class: "setting" }, [
        el("div", { class: "text" }, [el("div", { class: "label", text: label }), el("div", { class: "desc", text: desc }), pending]),
        el("div", { class: "control" }, control)
    ]);
}

function renderSettings() {
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
        const p = state.pendingSettings.find((x) => x.key === def.key);
        const pending = p
            ? el("div", { class: "pending" }, [
                `Changes to ${def.toInput(p.value)} ${def.unit} on ${formatClock(p.effectiveAt)}`,
                el("button", { class: "btn small ghost", text: "Cancel", onclick: () => send("cancelPendingSetting", { key: def.key }) })
            ])
            : null;
        return settingRow({ label: def.label, desc: def.desc, control: [input, el("span", { class: "muted small", text: def.unit })], pending });
    });

    const select = el("select", { class: "field", "aria-label": "When a banned site opens" }, [
        el("option", { value: "page", text: "Show my block page" }),
        el("option", { value: "close", text: "Close the tab" })
    ]);
    select.value = state.settings.blockAction;
    select.addEventListener("change", () => saveSetting("blockAction", select.value));
    rows.push(settingRow({ label: "When a banned site opens", desc: "Super bans and Watched cooldowns always show the block page.", control: [select] }));

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
    rows.push(settingRow({ label: "Mascot sounds", desc: "Tiny blips when I react. Off by default.", control: [soundBtn] }));

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
    rows.push(settingRow({ label: "Wandering", desc: "Whether I hop around on my own when you're idle. I still move when you switch tabs.", control: [stillBtn] }));

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
    // narrow screens stack the Sites columns, so home on the first one (it's in view)
    const home = name === "sites" && innerWidth < 960 ? "col-ban" : TAB_HOME[name];
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
