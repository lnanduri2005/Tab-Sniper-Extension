import { send, formatDuration } from "./lib/api.js";

const $ = (id) => document.getElementById(id);
let state = null;
let countdown = null;

function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
        if (k === "class") node.className = v;
        else if (k === "text") node.textContent = v;
        else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v);
    }
    node.append(...[].concat(children).filter((c) => c != null));
    return node;
}

function flashMessage(id, text, ms = 2500) {
    $(id).textContent = text;
    if (ms) setTimeout(() => { if ($(id).textContent === text) $(id).textContent = ""; }, ms);
}

async function refresh() {
    const res = await send("getState");
    if (!res.ok) return;
    state = res;
    renderHeader();
    renderTimer();
    renderPresets();
    renderBans();
    renderSuperBans();
    renderWatched();
    renderHistory();
    renderStats();
}

function renderHeader() {
    $("toggle-switch").checked = state.bansActive;
    $("toggle-switch").disabled = !!state.timer;
    $("status-text").textContent = state.bansActive ? "ON" : "OFF";
    $("app-logo").src = state.bansActive ? "icon_mischiveous.png" : "icon_sleep.png";
}

function renderTimer() {
    clearInterval(countdown);
    const running = !!state.timer;
    $("start-timer-btn").hidden = running;
    $("save-focus-btn").hidden = running;
    $("timer-input-group").hidden = running;
    $("end-early-btn").hidden = !running;
    if (!running) {
        const minutes = parseInt($("timer-minutes").value, 10) || 0;
        $("timer-display").textContent = `${String(minutes).padStart(2, "0")}:00`;
        return;
    }
    const tick = () => {
        const left = state.timer.endTime - Date.now();
        $("timer-display").textContent = formatDuration(left);
        if (left <= 0) {
            clearInterval(countdown);
            setTimeout(refresh, 1500);
        }
    };
    tick();
    countdown = setInterval(tick, 1000);
}

async function startFocus(minutes, source) {
    const res = await send("startTimer", { minutes, source });
    if (!res.ok) flashMessage("timer-message", res.error || "Failed to start");
    else flashMessage("timer-message", "Focus mode activated!");
    refresh();
}

function renderPresets() {
    const list = $("preset-list");
    list.replaceChildren();
    if (!state.presets.length) {
        list.append(el("div", { class: "empty-state", text: "No presets saved yet" }));
        return;
    }
    for (const preset of state.presets) {
        list.append(
            el("div", { class: "preset-item" }, [
                el("div", { class: "preset-header" }, [
                    el("div", {}, [
                        el("div", { class: "preset-name", text: preset.name }),
                        el("div", { class: "preset-duration", text: `${preset.minutes} minutes` })
                    ])
                ]),
                el("div", { class: "preset-actions" }, [
                    el("button", {
                        class: "btn-small",
                        text: "Start",
                        onclick: () => startFocus(preset.minutes, `preset:${preset.name}`)
                    }),
                    el("button", {
                        class: "btn-small danger",
                        text: "Delete",
                        onclick: async () => {
                            await send("savePresets", { presets: state.presets.filter((p) => p.id !== preset.id) });
                            refresh();
                        }
                    })
                ])
            ])
        );
    }
}

function renderBans() {
    const list = $("url-list");
    list.replaceChildren();
    if (!state.bans.length) {
        list.append(el("div", { class: "empty-state", text: "No sites banned yet" }));
        return;
    }
    for (const domain of state.bans) {
        const btn = el("button", {
            class: "btn-small danger",
            text: "Remove",
            onclick: async () => {
                const r = await send("removeBan", { domain });
                if (!r.ok) flashMessage("sites-message", r.error);
            }
        });
        btn.disabled = state.bansActive;
        list.append(
            el("li", { class: "list-item" }, [
                el("span", { class: "list-item-text", text: domain }),
                el("div", { class: "list-item-actions" }, [btn])
            ])
        );
    }
}

function superLabel(s) {
    const now = Date.now();
    if (s.removalStatus === "cooling") return `removable in ${formatDuration(s.removal.dueAt - now)}`;
    if (s.removalStatus === "due") return "removal ready";
    if (s.removalStatus === "challenge") return "challenge pending";
    if (s.pausedUntil) return `paused ${formatDuration(s.pausedUntil - now)}`;
    return "active";
}

function renderSuperBans() {
    const list = $("super-list");
    list.replaceChildren();
    if (!state.superBans.length) {
        list.append(el("div", { class: "empty-state", text: "No super bans yet" }));
        return;
    }
    for (const s of state.superBans) {
        list.append(
            el("li", { class: "list-item" }, [
                el("span", { class: "list-item-text", text: s.domain }),
                el("div", { class: "list-item-actions" }, [
                    el("span", { style: "font-size: 12px; color: var(--text-secondary);", text: superLabel(s) }),
                    el("button", { class: "btn-small", text: "Manage", onclick: () => chrome.runtime.openOptionsPage() })
                ])
            ])
        );
    }
}

function watchLabel(w) {
    if (w.cooldown) return `cooldown ${formatDuration(w.cooldown.until - Date.now())}`;
    const top = [...w.usage].sort((a, b) => b.used / b.limit - a.used / a.limit)[0];
    if (!top || top.used < 1) return "watching";
    return top.kind === "swipes" ? `${top.used}/${top.limit} swipes` : `${Math.floor(top.used)}/${top.limit} min`;
}

function renderWatched() {
    const list = $("watch-list");
    list.replaceChildren();
    if (!state.watched.length) {
        list.append(el("div", { class: "empty-state", text: "No watched sites yet" }));
        return;
    }
    for (const w of state.watched) {
        list.append(
            el("li", { class: "list-item" }, [
                el("span", { class: "list-item-text", text: w.domain }),
                el("span", { style: "font-size: 12px; color: var(--text-secondary);", text: watchLabel(w) })
            ])
        );
    }
}

function renderHistory() {
    const list = $("history-list");
    list.replaceChildren();
    if (!state.history.length) {
        list.append(el("div", { class: "empty-state", text: "No focus sessions yet" }));
        return;
    }
    for (const session of state.history.slice(0, 20)) {
        const date = new Date(session.date);
        const status = session.completed ? "Completed" : session.reason === "ended-early" ? "Ended early" : "Incomplete";
        list.append(
            el("div", { class: "list-item" }, [
                el("div", {}, [
                    el("div", { class: "list-item-text", text: `${session.duration} minutes` }),
                    el("div", {
                        style: "font-size: 11px; color: var(--text-secondary); margin-top: 2px;",
                        text: `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                    })
                ]),
                el("div", { style: `font-size: 12px; color: ${session.completed ? "var(--primary)" : "#c58aa8"};`, text: status })
            ])
        );
    }
}

function renderStats() {
    const completed = state.history.filter((h) => h.completed);
    $("total-sessions").textContent = completed.length;
    $("total-minutes").textContent = completed.reduce((sum, h) => sum + (h.duration || 0), 0);

    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const max = Math.max(...state.stats.dailyMinutes, 1);
    $("weekly-chart").replaceChildren(
        ...state.stats.dailyMinutes.map((minutes, i) =>
            el("div", { class: "bar-item" }, [
                el("div", { class: "bar-label", text: days[i] }),
                el("div", { class: "bar-track" }, [
                    el("div", { class: "bar-fill", style: `width:${(minutes / max) * 100}%` }, [
                        el("span", { class: "bar-value", text: `${minutes}m` })
                    ])
                ])
            ])
        )
    );

    const entries = Object.entries(state.stats.blockedSites || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
    $("blocked-stats").replaceChildren(
        ...(entries.length
            ? entries.map(([site, count]) =>
                el("div", { class: "blocked-site-item" }, [
                    el("span", { class: "site-name", text: site }),
                    el("span", { class: "site-count", text: String(count) })
                ]))
            : [el("div", { class: "empty-state", text: "No data yet" })])
    );
}

// ---------- events ----------

document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
        tab.classList.add("active");
        $(`${tab.dataset.tab}-tab`).classList.add("active");
    });
});

$("toggle-switch").addEventListener("change", async () => {
    const res = await send("toggle", { enabled: $("toggle-switch").checked });
    if (!res.ok) flashMessage("timer-message", res.error);
    refresh();
});

$("dashboard-btn").addEventListener("click", () => chrome.runtime.openOptionsPage());
$("watch-manage-btn").addEventListener("click", () => chrome.runtime.openOptionsPage());

$("start-timer-btn").addEventListener("click", () => {
    const minutes = parseInt($("timer-minutes").value, 10);
    if (!(minutes >= 1)) return flashMessage("timer-message", "Enter a valid time");
    startFocus(minutes, "popup");
});

$("timer-minutes").addEventListener("input", () => state && renderTimer());

$("save-focus-btn").addEventListener("click", async () => {
    const minutes = parseInt($("timer-minutes").value, 10);
    if (!(minutes >= 1)) return;
    const name = (prompt("Name this preset:") || "").trim();
    if (!name) return;
    await send("savePresets", { presets: [...state.presets, { id: Date.now(), name, minutes }] });
    flashMessage("timer-message", `Saved "${name}"`);
    refresh();
});

$("end-early-btn").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("challenge.html?purpose=endEarly") });
});

async function addBan() {
    const r = await send("addBan", { input: $("url-input").value });
    if (r.ok) $("url-input").value = "";
    else flashMessage("sites-message", r.error);
}

async function addSuperBan() {
    const input = $("super-input").value;
    if (!input.trim()) return;
    const ok = confirm(
        "Super bans block the site 24/7, even when Tab Sniper is off.\n\n" +
        `Removing it later takes a random challenge plus a ${state?.settings.coolOffHours ?? 12}h cool-off. Continue?`
    );
    if (!ok) return;
    const r = await send("addSuperBan", { input });
    if (r.ok) $("super-input").value = "";
    else flashMessage("sites-message", r.error);
}

$("add-url-btn").addEventListener("click", addBan);
$("url-input").addEventListener("keydown", (e) => e.key === "Enter" && addBan());
$("add-super-btn").addEventListener("click", addSuperBan);
$("super-input").addEventListener("keydown", (e) => e.key === "Enter" && addSuperBan());

const NOISY_KEYS = new Set(["watch", "activeFocus"]);
chrome.storage.onChanged.addListener((changes) => {
    if (Object.keys(changes).every((k) => NOISY_KEYS.has(k))) return;
    refresh();
});
refresh();
