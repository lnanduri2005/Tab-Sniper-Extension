import { send } from "./lib/api.js";
import { createMascot } from "./ui/mascot.js";
import { createRoamer } from "./ui/roam.js";
import { ICONS } from "./ui/icons.js";
import { loadSoundSetting, play } from "./ui/sound.js";
import { el, $ } from "./ui/dom.js";
import { tierIcon } from "./ui/tiers.js";

const STEPS = ["Hello", "Three kinds of block", "Pick your weak spots", "All set"];
let step = 0;
let picked = new Set(["youtube", "instagram", "tiktok"]);
let profiles = [];
let tourTimers = [];

// The roaming guide: hidden on the hello/done steps (they have their own big mascot),
// hops between the tier cards and over the picks in between.
const roamer = createRoamer({ mood: "happy", size: 104, play, onTap: () => roamer.mascot.poke() });
roamer.setPerches([
    { id: "card-ban", target: ".tier-card.ban", mode: "sit", align: 0.78 },
    { id: "card-watched", target: ".tier-card.watched", mode: "sit", align: 0.78 },
    { id: "card-super", target: ".tier-card.super", mode: "sit", align: 0.78 },
    { id: "picks", target: ".picks", mode: "sit", align: 0.94 },
    { id: "window-top", target: ".tour-window", mode: "sit", align: 0.86 },
    { id: "peek-right", target: ".tour-window", mode: "peek", side: "right", align: 0.4, bubble: "right" }
]);
roamer.setStill(true);

function clearTour() {
    tourTimers.forEach(clearTimeout);
    tourTimers = [];
}

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

function tierCard(tier, title, body, cost) {
    return el("div", { class: `tier-card ${tier}` }, [el("h2", {}, [tierIcon(tier), title]), el("p", { text: body }), el("p", { class: "cost", text: cost })]);
}

// Walk the guide across the three cards, one mood and line per tier.
function tourTiers() {
    const stops = [
        ["card-ban", "smug", "Ban: easy on, easy off. I just have to be awake."],
        ["card-watched", "mischievous", "Watched: go ahead. I'll tap you on the shoulder."],
        ["card-super", "stern", "Super ban: no. Not even when I'm napping."]
    ];
    stops.forEach(([perch, mood, text], i) => {
        tourTimers.push(setTimeout(() => roamer.goTo(perch, { mood, say: text }), 350 + i * 3200));
    });
}

function stepTiers() {
    return el("div", { class: "step" }, [
        el("h1", { text: "Three kinds of block" }),
        el("p", { class: "lede", text: "Heavier means harder to undo. Pick the right weight for each site." }),
        el("div", { class: "tiers" }, [
            tierCard("ban", "Ban", "Blocked while I'm awake or a focus session runs.", "Undo: put me to sleep."),
            tierCard("watched", "Watched", "Allowed, but I cut you off when you doomscroll: too long, too many Shorts or Reels.", "Undo: wait out a cooldown that doubles."),
            tierCard("super", "Super ban", "Blocked 24/7, even while I nap. For the sites that always win.", "Undo: random challenge plus a 12h wait.")
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
    clearTour();
    step = Math.max(0, Math.min(STEPS.length - 1, i));
    $("step-label").textContent = `${step + 1} of ${STEPS.length} · ${STEPS[step]}`;
    $("steps").replaceChildren(...STEPS.map((_, j) => el("span", { class: `dot ${j < step ? "done" : j === step ? "now" : ""}` })));
    $("screen").replaceChildren(RENDER[step]());
    // Move focus to the new step's heading so keyboard and screen-reader users land on it.
    const heading = $("screen").querySelector("h1, .bubble");
    if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus({ preventScroll: true });
    }
    $("skip").hidden = step === STEPS.length - 1;

    if (step === 0 || step === STEPS.length - 1) {
        roamer.hide();
        return;
    }
    roamer.show();
    requestAnimationFrame(() => {
        if (step === 1) tourTiers();
        if (step === 2) roamer.goTo("picks", { mood: "mischievous", say: "Tick the ones that get you. No judgment. Some judgment." });
    });
}

$("skip").addEventListener("click", finish);

loadSoundSetting();
const res = await send("getState");
profiles = res.ok ? res.profiles.filter((p) => !res.watched.some((w) => w.domain === p.domain)) : [];
picked = new Set([...picked].filter((k) => profiles.some((p) => p.key === k)));
go(0);
