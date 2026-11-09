import { send } from "./lib/api.js";
import { createMascot } from "./ui/mascot.js";
import { ICONS } from "./ui/icons.js";
import { loadSoundSetting, play } from "./ui/sound.js";
import { el, $ } from "./ui/dom.js";
import { tierChip } from "./ui/tiers.js";

const STEPS = ["Hello", "Three kinds of block", "Pick your weak spots", "All set"];
let step = 0;
let picked = new Set(["youtube", "instagram", "tiktok"]);
let profiles = [];

function finish() {
    chrome.runtime.openOptionsPage();
    window.close();
}

function nav(backable, nextLabel, onNext) {
    return el("div", { class: "nav" }, [
        backable ? el("button", { class: "btn ghost", html: `${ICONS.back}<span>Back</span>`, onclick: () => go(step - 1) }) : null,
        el("button", { class: "btn", html: `<span>${nextLabel}</span>${ICONS.arrow}`, onclick: onNext })
    ]);
}

function stepHello() {
    const m = createMascot({ mood: "happy", label: "Tab Sniper mascot waving hello" });
    setTimeout(() => m.react("bounce"), 300);
    return el("div", { class: "step" }, [
        el("div", { class: "hello" }, [
            m.el,
            el("div", {}, [
                el("p", { class: "bubble side", text: "Hi! I'm Tab Sniper. I guard your tabs from doomscrolling." }),
                el("p", { class: "lede", text: "I won't lock you in a cage. I just make getting to the distracting stuff slower than the urge lasts. Most urges pass in a couple of minutes." })
            ])
        ]),
        nav(false, "Show me how", () => go(1))
    ]);
}

function tierCard(tier, mood, title, body, cost) {
    const m = createMascot({ mood, interactive: false, label: `${title} mascot` });
    return el("div", { class: `tier-card ${tier}` }, [m.el, tierChip(tier), el("h2", { text: title }), el("p", { text: body }), el("p", { class: "cost", text: cost })]);
}

function stepTiers() {
    return el("div", { class: "step" }, [
        el("h1", { text: "Three kinds of block" }),
        el("p", { class: "lede", text: "Heavier means harder to undo. Pick the right weight for each site." }),
        el("div", { class: "tiers" }, [
            tierCard("ban", "smug", "Ban", "Blocked while I'm awake or a focus session runs.", "Undo: put me to sleep."),
            tierCard("watched", "mischievous", "Watched", "Allowed, but I cut you off when you doomscroll: too long, too many Shorts or Reels.", "Undo: wait out a cooldown that doubles."),
            tierCard("super", "stern", "Super ban", "Blocked 24/7, even while I nap. For the sites that always win.", "Undo: random challenge plus a 12h wait.")
        ]),
        nav(true, "Next", () => go(2))
    ]);
}

function stepPicks() {
    const grid = el("div", { class: "picks" }, profiles.map((p) => {
        const input = el("input", { type: "checkbox", value: p.key, "aria-label": `Watch ${p.label}` });
        input.checked = picked.has(p.key);
        input.addEventListener("change", () => (input.checked ? picked.add(p.key) : picked.delete(p.key)));
        return el("label", { class: "pick" }, [input, el("span", { text: p.label })]);
    }));
    return el("div", { class: "step" }, [
        el("h1", { text: "Pick your weak spots" }),
        el("p", { class: "lede", text: "I'll watch these and step in when a quick check turns into a scroll hole. You can change limits, add bans, or super ban things later in the dashboard." }),
        grid,
        nav(true, picked.size ? "Watch these" : "Skip for now", async () => {
            for (const key of picked) await send("addWatched", { profile: key });
            go(3);
        })
    ]);
}

function stepDone() {
    const m = createMascot({ mood: "proud", label: "Tab Sniper mascot ready" });
    setTimeout(() => m.react("bounce"), 300);
    play("win");
    return el("div", { class: "step" }, [
        el("div", { class: "hello" }, [
            m.el,
            el("div", {}, [
                el("p", { class: "bubble side", text: "You're set. Wake me up whenever you want bans on." }),
                el("p", { class: "lede", text: "I live in your toolbar. Click me to wake up, start a focus session, or ban the tab you're on." })
            ])
        ]),
        el("div", { class: "nav" }, [
            el("button", { class: "btn ghost", text: "Open dashboard", onclick: finish }),
            el("button", {
                class: "btn",
                html: `${ICONS.sun}<span>Wake up and close</span>`,
                onclick: async () => {
                    await send("toggle", { enabled: true });
                    window.close();
                }
            })
        ])
    ]);
}

const RENDER = [stepHello, stepTiers, stepPicks, stepDone];

function go(i) {
    step = Math.max(0, Math.min(STEPS.length - 1, i));
    $("step-label").textContent = `${step + 1} of ${STEPS.length} · ${STEPS[step]}`;
    $("steps").replaceChildren(...STEPS.map((_, j) => el("span", { class: `dot ${j < step ? "done" : j === step ? "now" : ""}` })));
    $("screen").replaceChildren(RENDER[step]());
    $("skip").hidden = step === STEPS.length - 1;
}

$("skip").addEventListener("click", finish);

loadSoundSetting();
const res = await send("getState");
profiles = res.ok ? res.profiles.filter((p) => !res.watched.some((w) => w.domain === p.domain)) : [];
picked = new Set([...picked].filter((k) => profiles.some((p) => p.key === k)));
go(0);
