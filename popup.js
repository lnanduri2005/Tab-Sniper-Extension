import { send, formatDuration } from "./lib/api.js";
import { extractDomain, domainMatches } from "./lib/match.js";
import { createMascot } from "./ui/mascot.js";
import { say } from "./ui/voice.js";
import { ICONS } from "./ui/icons.js";
import { loadSoundSetting, play } from "./ui/sound.js";
import { el, $, flash } from "./ui/dom.js";
import { tierChip, tierIcon, iconButton, TIER_NAMES } from "./ui/tiers.js";

let state = null;
let hereDomain = null;
let tick = null;
let selectedMinutes = 25;
let lastLineKey = "";
let pendingSuper = null;

const mascot = createMascot({ variant: "face", mood: "sleep", idle: { boredMs: 25000, sleepMs: 60000 } });
$("face-slot").append(mascot.el);
mascot.on((evt) => evt === "poke" && play("poke"));
$("dashboard-btn").innerHTML = ICONS.gear;

// ---------- data ----------

async function refresh() {
    const res = await send("getState");
    if (!res.ok) return;
    state = res;
    render();
}

async function loadHere() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        hereDomain = tab?.url ? extractDomain(tab.url) : null;
    } catch {
        hereDomain = null;
    }
}

function tierOf(domain) {
    if (!domain) return null;
    if (state.superBans.some((s) => domainMatches(domain, s.domain))) return "super";
    if (state.watched.some((w) => domainMatches(domain, w.domain))) return "watched";
    if (state.bans.some((d) => domainMatches(domain, d))) return "ban";
    return null;
}

function baseMood() {
    if (state.timer) return "idle";
    return state.bansActive ? "mischievous" : "sleep";
}

// ---------- render ----------

function render() {
    mascot.setMood(baseMood());
    renderLine();
    renderWake();
    renderHere();
    renderToday();
    renderFocus();
    renderSites();
}

function renderLine(force = false) {
    const attempts = Object.entries(state.attemptsToday || {}).sort((a, b) => b[1] - a[1]);
    const total = attempts.reduce((sum, [, n]) => sum + n, 0);
    let key;
    let vars = {};
    if (state.timer) {
        key = "home.focus";
        vars = { left: formatDuration(state.timer.endTime - Date.now()) };
    } else if (!state.bans.length && !state.superBans.length && !state.watched.length) {
        key = "home.empty";
    } else if (!state.bansActive) {
        key = "home.off";
    } else if (total > 0) {
        key = "home.on";
        vars = { n: total, site: attempts[0][0] };
    } else {
        key = "home.calm";
    }
    const signature = `${key}:${total}:${!!state.timer}`;
    if (!force && signature === lastLineKey) return;
    lastLineKey = signature;
    $("line").textContent = say(key, vars);
}

function renderWake() {
    const btn = $("wake-btn");
    btn.disabled = !!state.timer;
    btn.classList.toggle("asleep", !state.bansActive);
    if (state.timer) btn.innerHTML = `${ICONS.lock}<span>Locked during focus</span>`;
    else if (state.bansActive) btn.innerHTML = `${ICONS.moon}<span>Nap time</span>`;
    else btn.innerHTML = `${ICONS.sun}<span>Wake up</span>`;
}

function renderHere() {
    const box = $("here");
    box.hidden = !hereDomain;
    if (!hereDomain) return;
    $("here-domain").textContent = hereDomain;
    const tier = tierOf(hereDomain);
    $("here-status").replaceChildren(tier ? tierChip(tier) : "");
    $("here-actions").hidden = !!tier;
}

function todayRows() {
    const now = Date.now();
    const rows = [];
    for (const s of state.superBans) {
        if (s.pausedUntil) rows.push({ tier: "super", domain: s.domain, meta: "paused", when: formatDuration(s.pausedUntil - now) });
        else if (s.removalStatus === "cooling") rows.push({ tier: "super", domain: s.domain, meta: "removable in", when: formatDuration(s.removal.dueAt - now) });
        else if (s.removalStatus === "due") rows.push({ tier: "super", domain: s.domain, meta: "removal ready", when: "" });
    }
    for (const w of state.watched) {
        if (w.cooldown) {
            rows.push({ tier: "watched", domain: w.domain, meta: "cooldown", when: formatDuration(w.cooldown.until - now), hot: true });
            continue;
        }
        const top = [...w.usage].sort((a, b) => b.used / b.limit - a.used / a.limit)[0];
        if (top && top.used >= 1) {
            const when = top.kind === "swipes" ? `${top.used}/${top.limit} swipes` : `${Math.floor(top.used)}/${top.limit} min`;
            rows.push({ tier: "watched", domain: w.domain, meta: top.kind === "streak" ? "short-form" : "this visit", when });
        }
    }
    const attempts = Object.entries(state.attemptsToday || {}).sort((a, b) => b[1] - a[1]);
    for (const [domain, n] of attempts) {
        if (rows.some((r) => r.domain === domain)) continue;
        rows.push({ tier: tierOf(domain) || "ban", domain, meta: "blocked", when: `${n} ${n === 1 ? "try" : "tries"}` });
    }
    return rows.slice(0, 6);
}

function renderToday() {
    const list = $("today");
    const rows = todayRows();
    if (!rows.length) {
        list.replaceChildren(el("li", { class: "empty", text: state.bansActive ? "Nothing yet. Keep it that way." : "Quiet. Super bans and Watched sites still count." }));
        return;
    }
    list.replaceChildren(
        ...rows.map((r) =>
            el("li", { class: "row" }, [
                tierIcon(r.tier),
                el("div", { class: "grow" }, [el("div", { class: "name", text: r.domain }), el("div", { class: "meta", text: `${TIER_NAMES[r.tier]} · ${r.meta}` })]),
                r.when ? el("span", { class: `when ${r.hot ? "hot" : ""}`, text: r.when }) : null
            ])
        )
    );
}

// ---------- focus ----------

function renderFocus() {
    clearInterval(tick);
    const running = !!state.timer;
    $("focus-setup").hidden = running;
    $("focus-running").hidden = !running;
    if (!running) {
        $("clock").textContent = `${String(selectedMinutes).padStart(2, "0")}:00`;
        $("strip-fill").style.transform = "scaleX(0)";
        renderChips();
        $("start-focus").innerHTML = `${ICONS.play}<span>Start ${selectedMinutes} min</span>`;
        return;
    }
    $("end-early").innerHTML = `${ICONS.stop}<span>End early</span>`;
    const update = () => {
        const { startTime, endTime } = state.timer;
        const left = endTime - Date.now();
        $("clock").textContent = formatDuration(left);
        $("strip-fill").style.transform = `scaleX(${Math.min(1, (Date.now() - startTime) / (endTime - startTime))})`;
        if (left <= 0) {
            clearInterval(tick);
            setTimeout(refresh, 1200);
        }
    };
    update();
    tick = setInterval(update, 1000);
}

function renderChips() {
    const options = [
        { minutes: 25, label: "25 min" },
        { minutes: 50, label: "50 min" },
        ...state.presets.map((p) => ({ minutes: p.minutes, label: `${p.name} · ${p.minutes}`, preset: p }))
    ];
    $("duration-chips").replaceChildren(
        ...options.map((o) => {
            const chip = el("button", {
                class: "chip",
                role: "radio",
                "aria-checked": String(o.minutes === selectedMinutes),
                text: o.label,
                title: o.preset ? "Right-click to delete this preset" : null,
                onclick: () => {
                    selectedMinutes = o.minutes;
                    $("custom-minutes").value = o.minutes;
                    renderFocus();
                }
            });
            if (o.preset) {
                chip.addEventListener("contextmenu", async (e) => {
                    e.preventDefault();
                    await send("savePresets", { presets: state.presets.filter((p) => p.id !== o.preset.id) });
                    refresh();
                });
            }
            return chip;
        })
    );
}

$("custom-minutes").addEventListener("input", () => {
    const n = parseInt($("custom-minutes").value, 10);
    if (n >= 1 && n <= 240) {
        selectedMinutes = n;
        renderFocus();
    }
});

$("start-focus").addEventListener("click", async () => {
    const res = await send("startTimer", { minutes: selectedMinutes, source: "popup" });
    if (!res.ok) {
        $("focus-message").textContent = res.error;
        mascot.express("grudging", 1500);
        return;
    }
    $("focus-message").textContent = "";
    mascot.express("proud", 1800);
    mascot.react("bounce");
    play("happy");
    await refresh();
    renderLine(true);
});

$("save-preset").addEventListener("click", async () => {
    const name = (prompt("Name this preset:", `${selectedMinutes} min`) || "").trim();
    if (!name) return;
    await send("savePresets", { presets: [...state.presets, { id: Date.now(), name, minutes: selectedMinutes }] });
    mascot.react("nod");
    refresh();
});

$("end-early").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("challenge.html?purpose=endEarly") });
});

// ---------- sites ----------

function siteRow(tier, domain, meta, action) {
    return el("li", { class: "row" }, [
        el("div", { class: "grow" }, [el("div", { class: "name", text: domain }), meta ? el("div", { class: "meta", text: meta }) : null]),
        action
    ]);
}

function renderSites() {
    const groups = [];
    const now = Date.now();

    const supers = state.superBans.map((s) => {
        const meta = s.pausedUntil ? `paused ${formatDuration(s.pausedUntil - now)}`
            : s.removalStatus === "cooling" ? `removable in ${formatDuration(s.removal.dueAt - now)}`
            : s.removalStatus === "due" ? "removal ready" : "locked 24/7";
        return siteRow("super", s.domain, meta, iconButton("arrow", `Manage ${s.domain}`, () => chrome.runtime.openOptionsPage()));
    });
    const watched = state.watched.map((w) =>
        siteRow("watched", w.domain, w.cooldown ? `cooldown ${formatDuration(w.cooldown.until - now)}` : w.label || "custom",
            iconButton("x", `Stop watching ${w.domain}`, async () => {
                const r = await send("removeWatched", { domain: w.domain });
                if (!r.ok) return sitesError(r.error);
                mascot.express("grudging", 1400);
            }, { disabled: !!w.cooldown, title: w.cooldown ? "Locked until the cooldown ends" : null }))
    );
    const bans = state.bans.map((d) =>
        siteRow("ban", d, null, iconButton("x", `Remove ${d}`, async () => {
            const r = await send("removeBan", { domain: d });
            if (!r.ok) return sitesError(r.error);
            mascot.express("grudging", 1400);
        }, { disabled: state.bansActive, title: state.bansActive ? "Nap first to remove bans" : null }))
    );

    const group = (title, tier, items, emptyText) =>
        el("section", { class: "group" }, [
            el("div", { class: "group-head" }, [tierIcon(tier), el("h2", { text: title }), el("span", { class: "count", text: items.length })]),
            items.length ? el("ul", { class: "rows" }, items) : el("p", { class: "empty", text: emptyText })
        ]);

    groups.push(group("Super bans", "super", supers, "Locked 24/7. Undo takes a challenge and a 12h wait."));
    groups.push(group("Watched", "watched", watched, "Allowed, but cut off when you doomscroll."));
    groups.push(group("Bans", "ban", bans, "Blocked while I'm awake."));
    $("site-groups").replaceChildren(...groups);
}

function sitesError(text) {
    $("sites-message").textContent = text;
    mascot.express("grudging", 1500);
    mascot.react("shake");
}

async function addSite(input, tier) {
    const action = { ban: "addBan", watched: "addWatched", super: "addSuperBan" }[tier];
    const res = await send(action, { input });
    if (!res.ok) return res;
    if (tier === "super") {
        mascot.express("stern", 2000);
        mascot.react("nod");
        play("deny");
    } else {
        mascot.express(tier === "watched" ? "mischievous" : "smug", 1800);
        mascot.react("bounce");
        play("happy");
    }
    return res;
}

const SUPER_WARNING = "Super bans block 24/7. Undoing one takes a random challenge plus a cool-off.";

$("add-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("add-input").value.trim();
    const tier = new FormData(e.target).get("tier");
    if (!input) return;
    if (tier === "super" && pendingSuper !== input) {
        pendingSuper = input;
        $("add-btn").textContent = "Confirm";
        $("sites-message").textContent = SUPER_WARNING;
        mascot.express("surprised", 1500);
        return;
    }
    pendingSuper = null;
    $("add-btn").textContent = "Add";
    const res = await addSite(input, tier);
    if (!res.ok) return sitesError(res.error);
    $("add-input").value = "";
    $("sites-message").textContent = `${res.domain} added.`;
});

$("add-form").addEventListener("change", () => {
    pendingSuper = null;
    $("add-btn").textContent = "Add";
});

$("here-actions").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-tier]");
    if (!btn || !hereDomain) return;
    const tier = btn.dataset.tier;
    if (tier === "super" && !btn.classList.contains("confirming")) {
        btn.classList.add("confirming");
        btn.textContent = "Tap again: 24/7";
        btn.title = SUPER_WARNING;
        mascot.express("surprised", 1500);
        setTimeout(() => {
            btn.classList.remove("confirming");
            btn.textContent = "Super ban";
        }, 4000);
        return;
    }
    const res = await addSite(hereDomain, tier);
    if (!res.ok) {
        flash(btn);
        mascot.express("grudging", 1500);
    }
});

// ---------- wake / nap, tabs ----------

$("wake-btn").addEventListener("click", async () => {
    const turningOn = !state.bansActive;
    const res = await send("toggle", { enabled: turningOn });
    if (!res.ok) {
        mascot.express("grudging", 1500);
        return;
    }
    if (turningOn) {
        mascot.express("happy", 1200);
        mascot.react("bounce");
        play("happy");
    } else {
        mascot.react("nod");
    }
    await refresh();
    renderLine(true);
});

const TABS = ["home", "focus", "sites"];
function selectTab(name, focus = false) {
    for (const t of TABS) {
        const tab = $(`tab-${t}`);
        const on = t === name;
        tab.setAttribute("aria-selected", String(on));
        tab.tabIndex = on ? 0 : -1;
        $(`panel-${t}`).hidden = !on;
        if (on && focus) tab.focus();
    }
    $("stage").classList.toggle("compact", name !== "home");
    try { sessionStorage.setItem("ts-tab", name); } catch { /* ignore */ }
}
TABS.forEach((t) => $(`tab-${t}`).addEventListener("click", () => selectTab(t)));
document.querySelector(".tabs").addEventListener("keydown", (e) => {
    const i = TABS.findIndex((t) => $(`tab-${t}`).getAttribute("aria-selected") === "true");
    if (e.key === "ArrowRight") selectTab(TABS[(i + 1) % TABS.length], true);
    if (e.key === "ArrowLeft") selectTab(TABS[(i + TABS.length - 1) % TABS.length], true);
});

$("dashboard-btn").addEventListener("click", () => chrome.runtime.openOptionsPage());
$("manage-btn").addEventListener("click", () => chrome.runtime.openOptionsPage());

const NOISY_KEYS = new Set(["watch", "activeFocus"]);
chrome.storage.onChanged.addListener((changes) => {
    if (Object.keys(changes).every((k) => NOISY_KEYS.has(k))) return;
    refresh();
});

let savedTab = "home";
try { savedTab = sessionStorage.getItem("ts-tab") || "home"; } catch { /* ignore */ }
selectTab(TABS.includes(savedTab) ? savedTab : "home");
loadSoundSetting();
await loadHere();
await refresh();
setInterval(() => state && (renderToday(), renderSites()), 15000);
