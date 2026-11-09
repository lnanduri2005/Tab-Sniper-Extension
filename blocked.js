import { send, formatDuration } from "./lib/api.js";
import { parseBlockPageSearch } from "./lib/rules.js";
import { createMascot } from "./ui/mascot.js";
import { say, lateNightHour } from "./ui/voice.js";
import { ICONS } from "./ui/icons.js";
import { loadSoundSetting, play } from "./ui/sound.js";
import { el, $ } from "./ui/dom.js";

const { domain, category, url } = parseBlockPageSearch(location.search);
const TIER = {
    ban: { label: "Ban", icon: ICONS.ban },
    watched: { label: "Watched", icon: ICONS.eye },
    super: { label: "Super ban", icon: ICONS.lock }
};

// Late at night, sometimes swap the usual line for one about the hour (not during focus).
function blockLine(situation, vars) {
    const time = lateNightHour();
    return time && Math.random() < 0.5 ? say("block.late", { ...vars, time }) : say(situation, vars);
}

const mascot = createMascot({ mood: "smug", label: "Tab Sniper mascot blocking this site" });
$("mascot-slot").append(mascot.el);
mascot.on((evt) => evt === "poke" && play("poke"));

function tierChip(tier) {
    return el("span", { class: `tier ${tier}`, html: `${TIER[tier].icon}<span>${TIER[tier].label}</span>` });
}

function fact(text) {
    return el("span", { class: "fact", text });
}

function countdown(until, onDone) {
    const clock = $("clock");
    clock.hidden = false;
    const update = () => {
        const left = until - Date.now();
        if (left <= 0) {
            onDone();
            return;
        }
        clock.textContent = formatDuration(left);
    };
    update();
    setInterval(update, 1000);
}

// Leaving is the win, so it gets a proud moment before the tab goes.
let closing = false;
function celebrateAndClose() {
    if (closing) return;
    closing = true;
    mascot.setMood("proud");
    mascot.react("bounce");
    $("bubble").textContent = say("block.closed");
    play("win");
    setTimeout(closeTab, matchMedia("(prefers-reduced-motion: reduce)").matches ? 700 : 1100);
}

async function closeTab() {
    try {
        const tab = await chrome.tabs.getCurrent();
        await chrome.tabs.remove(tab.id);
    } catch {
        window.close();
    }
}

const goBack = () => location.replace(url || `https://${domain}`);

async function init() {
    document.title = `${domain} blocked · Tab Sniper`;
    $("domain").textContent = domain;
    loadSoundSetting().then(() => play("deny"));

    const attempt = await send("recordAttempt", { domain });
    const info = await send("getBlockInfo", { domain, category });
    if (info.ok && !info.stillBlocked) {
        goBack();
        return;
    }
    const n = attempt.attemptsToday || 1;
    const closeBtn = el("button", { class: "btn big", html: `${ICONS.x}<span>Close this tab</span>`, onclick: celebrateAndClose });
    $("facts").replaceChildren(tierChip(category in TIER ? category : "ban"), fact(`${n} ${n === 1 ? "try" : "tries"} today`));

    if (category === "super") {
        mascot.setMood(n >= 5 ? "angry" : "stern");
        mascot.react("shake");
        $("bubble").textContent = blockLine("block.super", { site: domain, n });
        renderPause(info, closeBtn);
    } else if (category === "watched") {
        mascot.setMood("smug");
        mascot.react("bounce");
        const c = info.cooldown;
        $("bubble").textContent = blockLine("block.watched", { site: domain, reason: c?.reason });
        if (c) {
            countdown(c.until, goBack);
            const trips = info.tripsToday ? `Trip #${info.tripsToday} today; the next one locks you out for ${info.nextCooldownMin} min. ` : "";
            $("detail").textContent = `${trips}Cooldowns can't be paused.`;
        }
        $("actions").replaceChildren(closeBtn);
    } else if (info.timer) {
        mascot.setMood("idle");
        mascot.react("nod");
        $("bubble").textContent = say("block.focus", { site: domain, left: formatDuration(info.timer.endTime - Date.now()) });
        countdown(info.timer.endTime, goBack);
        $("detail").textContent = "Focus session running. Bans lift when the timer ends.";
        $("actions").replaceChildren(closeBtn);
    } else {
        mascot.setMood("smug");
        mascot.react("bounce");
        $("bubble").textContent = blockLine("block.ban", { site: domain, n });
        $("detail").textContent = "Banned while I'm awake. Put me to sleep from the toolbar to visit.";
        $("actions").replaceChildren(closeBtn);
    }
}

function renderPause(info, closeBtn) {
    const waitMin = Math.round(info.pauseWaitSec / 60);
    if (!info.pauseOptions.length) {
        $("detail").textContent = `Today's pause allowance for ${domain} is used up. It resets at midnight.`;
        $("actions").replaceChildren(closeBtn);
        return;
    }
    $("detail").textContent = "";
    const buttons = info.pauseOptions.map((minutes) =>
        el("button", {
            class: "btn small ghost",
            html: `${ICONS.pause}<span>Pause ${minutes} min</span>`,
            onclick: () => {
                const params = new URLSearchParams({ d: domain, m: String(minutes) });
                location.href = `pause.html?${params}&u=${url}`;
            }
        })
    );
    // Pausing is still there, one step back: it doesn't compete with leaving.
    const options = el("div", { class: "pause-options", id: "pause-options", hidden: true }, [
        el("p", { class: "detail", text: `Pausing means a ${waitMin}-minute wait on a page you can't leave. ${info.pauseMinutesLeft} pause minutes left today.` }),
        el("div", { class: "actions" }, buttons)
    ]);
    const reveal = el("button", {
        class: "text-btn",
        "aria-expanded": "false",
        "aria-controls": "pause-options",
        text: "Pause instead...",
        onclick: () => {
            const open = options.hidden;
            options.hidden = !open;
            reveal.setAttribute("aria-expanded", String(open));
            if (open) {
                mascot.express("grudging", 2200);
                buttons[0]?.focus();
            }
        }
    });
    $("actions").replaceChildren(closeBtn);
    $("actions").after(el("div", { class: "pause-more" }, [reveal, options]));
}

init();
