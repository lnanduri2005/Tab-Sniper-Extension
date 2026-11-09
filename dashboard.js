import { send, formatDuration, formatClock } from "./lib/api.js";
import { SETTING_LIMITS } from "./lib/defaults.js";

const $ = (id) => document.getElementById(id);
let state = null;

const SETTINGS = [
    { key: "pauseWaitSec", label: "Pause wait", unit: "min", toInput: (v) => v / 60, fromInput: (v) => Number(v) * 60, step: 1 },
    { key: "pauseCapMin", label: "Daily pause cap per site", unit: "min", toInput: (v) => v, fromInput: Number, step: 5 },
    { key: "coolOffHours", label: "Removal cool-off", unit: "hours", toInput: (v) => v, fromInput: Number, step: 1 }
];

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

function say(id, text, error = false) {
    $(id).textContent = text || "";
    $(id).classList.toggle("error", !!error);
}

async function refresh() {
    const res = await send("getState");
    if (!res.ok) return;
    state = res;
    renderSuperBans();
    renderBans();
    renderSettings();
}

function superStatus(s) {
    const now = Date.now();
    if (s.removalStatus === "cooling") return el("span", { class: "chip warn", text: `removable in ${formatDuration(s.removal.dueAt - now)}` });
    if (s.removalStatus === "due") return el("span", { class: "chip warn", text: "removal ready" });
    if (s.removalStatus === "challenge") return el("span", { class: "chip warn", text: "removal: challenge pending" });
    if (s.pausedUntil) return el("span", { class: "chip ok", text: `paused ${formatDuration(s.pausedUntil - now)}` });
    return el("span", { class: "chip", text: "active" });
}

function superActions(s) {
    const actions = [];
    const act = (label, action, cls = "btn small ghost") =>
        el("button", { class: cls, text: label, onclick: () => action() });

    if (s.removalStatus === "none") {
        actions.push(act("Request removal", async () => {
            const r = await send("requestRemoval", { domain: s.domain });
            if (r.ok) chrome.tabs.create({ url: r.url });
            else say("super-message", r.error, true);
        }));
    }
    if (s.removalStatus === "challenge") {
        actions.push(act("Do challenge", async () => {
            const r = await send("requestRemoval", { domain: s.domain });
            if (r.ok) chrome.tabs.create({ url: r.url });
        }, "btn small"));
    }
    if (s.removalStatus === "due") {
        actions.push(act("Confirm removal", async () => {
            if (!confirm(`Remove the super ban on ${s.domain}?`)) return;
            const r = await send("confirmRemoval", { domain: s.domain });
            if (!r.ok) say("super-message", r.error, true);
            refresh();
        }, "btn small danger"));
    }
    if (s.removalStatus !== "none") {
        actions.push(act("Cancel removal", async () => {
            await send("cancelRemoval", { domain: s.domain });
            refresh();
        }));
    }
    return actions;
}

function renderSuperBans() {
    const list = $("super-list");
    list.replaceChildren();
    if (!state.superBans.length) {
        list.append(el("li", { class: "muted", text: "No super bans yet." }));
        return;
    }
    for (const s of state.superBans) {
        const meta = el("div", { class: "muted", text: `${s.attemptsToday} attempts today · ${s.pauseMinutesLeft} pause min left` });
        list.append(
            el("li", {}, [
                el("div", {}, [el("div", { class: "name", text: s.domain }), meta]),
                superStatus(s),
                el("span", { class: "spacer" }),
                ...superActions(s)
            ])
        );
    }
}

function renderBans() {
    const list = $("ban-list");
    list.replaceChildren();
    if (!state.bans.length) {
        list.append(el("li", { class: "muted", text: "No bans yet." }));
        return;
    }
    for (const domain of state.bans) {
        const remove = el("button", {
            class: "btn small ghost",
            text: "Remove",
            onclick: async () => {
                const r = await send("removeBan", { domain });
                if (!r.ok) say("ban-message", r.error, true);
            }
        });
        if (state.bansActive) {
            remove.disabled = true;
            remove.title = "Turn Tab Sniper off to remove bans";
        }
        list.append(el("li", {}, [el("span", { class: "name", text: domain }), el("span", { class: "spacer" }), remove]));
    }
}

function renderSettings() {
    const list = $("settings-list");
    list.replaceChildren();

    for (const def of SETTINGS) {
        const limits = SETTING_LIMITS[def.key];
        const input = el("input", {
            type: "number",
            min: String(def.toInput(limits.min)),
            max: String(def.toInput(limits.max)),
            step: String(def.step),
            value: String(def.toInput(state.settings[def.key])),
            style: "width: 90px;",
            "aria-label": def.label
        });
        const save = el("button", {
            class: "btn small",
            text: "Save",
            onclick: () => saveSetting(def.key, def.fromInput(input.value))
        });
        const pending = state.pendingSettings.find((p) => p.key === def.key);
        const pendingNote = pending
            ? el("div", { class: "muted" }, [
                `Changing to ${def.toInput(pending.value)} ${def.unit} on ${formatClock(pending.effectiveAt)} `,
                el("button", {
                    class: "btn small ghost",
                    text: "Cancel",
                    onclick: async () => {
                        await send("cancelPendingSetting", { key: def.key });
                        refresh();
                    }
                })
            ])
            : null;
        list.append(
            el("li", {}, [
                el("div", { style: "flex:1;" }, [el("div", { class: "name", text: def.label }), pendingNote]),
                input,
                el("span", { class: "muted", text: def.unit }),
                save
            ])
        );
    }

    const select = el("select", { "aria-label": "When a banned site opens" }, [
        el("option", { value: "page", text: "Show block page" }),
        el("option", { value: "close", text: "Close the tab" })
    ]);
    select.value = state.settings.blockAction;
    select.addEventListener("change", () => saveSetting("blockAction", select.value));
    list.append(
        el("li", {}, [
            el("div", { style: "flex:1;" }, [
                el("div", { class: "name", text: "When a banned site opens" }),
                el("div", { class: "muted", text: "Super bans always show the block page." })
            ]),
            select
        ])
    );
}

async function saveSetting(key, value) {
    const r = await send("updateSetting", { key, value });
    if (!r.ok) say("settings-message", r.error, true);
    else if (r.status === "pending") say("settings-message", `Easier setting scheduled for ${formatClock(r.effectiveAt)}.`);
    else if (r.status === "applied") say("settings-message", "Saved.");
    else say("settings-message", "No change.");
    refresh();
}

$("super-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("super-input").value;
    if (!input.trim()) return;
    const ok = confirm(
        "Super bans block the site 24/7, even when Tab Sniper is off.\n\n" +
        `Removing it later takes a random challenge plus a ${state?.settings.coolOffHours ?? 12}h cool-off. Continue?`
    );
    if (!ok) return;
    const r = await send("addSuperBan", { input });
    if (r.ok) {
        $("super-input").value = "";
        say("super-message", `${r.domain} is now super banned.`);
    } else {
        say("super-message", r.error, true);
    }
});

$("ban-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const r = await send("addBan", { input: $("ban-input").value });
    if (r.ok) {
        $("ban-input").value = "";
        say("ban-message", "");
    } else {
        say("ban-message", r.error, true);
    }
});

chrome.storage.onChanged.addListener(() => refresh());
setInterval(refresh, 30000);
refresh();
