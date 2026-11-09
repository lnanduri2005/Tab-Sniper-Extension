import { send, formatDuration } from "./lib/api.js";
import { parseBlockPageSearch } from "./lib/rules.js";
import { createMascot } from "./ui/mascot.js";
import { say } from "./ui/voice.js";
import { ICONS } from "./ui/icons.js";
import { loadSoundSetting, play } from "./ui/sound.js";
import { el, $ } from "./ui/dom.js";

const { domain, category, url } = parseBlockPageSearch(location.search);
const TIER = {
    ban: { label: "Ban", icon: ICONS.ban },
    watched: { label: "Watched", icon: ICONS.eye },
    super: { label: "Super ban", icon: ICONS.lock }
};

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
    const closeBtn = el("button", { class: "btn ghost", html: `${ICONS.x}<span>Close this tab</span>`, onclick: closeTab });
    $("facts").replaceChildren(tierChip(category in TIER ? category : "ban"), fact(`${n} ${n === 1 ? "try" : "tries"} today`));

    if (category === "super") {
        mascot.setMood(n >= 5 ? "angry" : "stern");
        mascot.react("shake");
        $("bubble").textContent = say("block.super", { site: domain, n });
        renderPause(info, closeBtn);
    } else if (category === "watched") {
        mascot.setMood("smug");
        mascot.react("bounce");
        const c = info.cooldown;
        $("bubble").textContent = say("block.watched", { site: domain, reason: c?.reason });
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
        $("bubble").textContent = say("block.ban", { site: domain, n });
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
    $("detail").textContent = `Need it for a minute? Pausing means a ${waitMin}-minute wait on a page you can't leave. ${info.pauseMinutesLeft} pause minutes left today.`;
    const buttons = info.pauseOptions.map((minutes) =>
        el("button", {
            class: "btn small cream",
            html: `${ICONS.pause}<span>Pause ${minutes} min</span>`,
            onclick: () => {
                const params = new URLSearchParams({ d: domain, m: String(minutes) });
                location.href = `pause.html?${params}&u=${url}`;
            }
        })
    );
    $("actions").replaceChildren(closeBtn, ...buttons);
}

init();
