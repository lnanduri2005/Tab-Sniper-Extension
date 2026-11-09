import { send, formatClock } from "./lib/api.js";
import { CHALLENGE_LABELS } from "./challenges/index.js";
import { createRoamer } from "./ui/roam.js";
import { say } from "./ui/voice.js";
import { loadSoundSetting, play } from "./ui/sound.js";
import { el, $ } from "./ui/dom.js";

const params = new URLSearchParams(location.search);
const purpose = params.get("purpose");
const domain = params.get("d") || "";

// The referee hops around the task window: leans in on mistakes, edges closer (and gets
// nervous) as you near the finish. It never sits on the task itself.
const roamer = createRoamer({ mood: "mischievous", size: 104, play, onTap: () => roamer.mascot.poke() });
const mascot = roamer.mascot;
roamer.setPerches([
    { id: "top-right", target: ".task", mode: "sit", align: 0.86 },
    { id: "top-left", target: ".task", mode: "sit", align: 0.3 },
    { id: "top-mid", target: ".task", mode: "sit", align: 0.6 },
    { id: "peek-right", target: ".task", mode: "peek", side: "right", align: 0.45, bubble: "right" },
    { id: "peek-left", target: ".task", mode: "peek", side: "left", align: 0.6, bubble: "left" }
]);
roamer.setStill(true);

let nervous = false;
const LEAN_IN = ["top-left", "top-mid", "top-right", "peek-right", "peek-left"];

function speak(key, vars) {
    roamer.say(say(key, vars));
}

function showResult(text, { error = false, dashboard = false } = {}) {
    const box = el("div", { class: "result" }, [
        el("p", { class: error ? "message error" : "", text }),
        dashboard ? el("button", { class: "btn", text: "Open dashboard", onclick: () => chrome.runtime.openOptionsPage() }) : null
    ]);
    $("challenge-root").replaceChildren(box);
}

function onEvent(type, value) {
    if (type === "mistake") {
        const options = LEAN_IN.filter((p) => p !== roamer.perchId);
        roamer.goTo(options[Math.floor(Math.random() * options.length)], { mood: "smug", say: say("challenge.mistake") });
        play("oops");
    } else if (type === "progress") {
        if (value >= 0.7 && !nervous) {
            nervous = true;
            mascot.setMood("nervous");
            roamer.goTo("top-mid", { say: say("challenge.close") });
        } else {
            mascot.react("nod");
        }
        play("tick");
    }
}

async function init() {
    loadSoundSetting();
    const res = await send("getChallenge", { purpose, domain });
    if (!res.ok) {
        roamer.goTo("top-right", { instant: true, mood: "grudging" });
        $("task-label").textContent = "Nothing to do";
        showResult(res.error, { error: true, dashboard: true });
        return;
    }

    const label = CHALLENGE_LABELS[res.type];
    $("task-label").textContent = label;
    if (purpose === "removal") {
        $("title").textContent = `Remove super ban: ${domain}`;
        $("lead").textContent = "Finish it to start the cool-off. Closing this page keeps the same challenge.";
    } else {
        $("title").textContent = "End focus early";
        $("lead").textContent = "A short one. Finish it to end your session (logged as ended early).";
    }
    roamer.goTo("top-right", { instant: true, say: say("challenge.start") });

    await mountChallenge(res.type, res.mini);
}

async function mountChallenge(type, mini) {
    $("task-label").textContent = CHALLENGE_LABELS[type];
    const module = await import(`./challenges/${type}.js`);
    module.mount($("challenge-root"), { mini, onComplete, onEvent });
    if (type === "cannon") {
        // Some people can't aim precisely. One swap to typing, never back, never again.
        const swap = el("button", {
            class: "text-btn",
            text: "Can't aim? Switch to typing instead (one time only)",
            onclick: async () => {
                const r = await send("swapChallenge", { purpose, domain });
                if (!r.ok) return;
                roamer.say("Fine. Typing it is. No more swaps.");
                await mountChallenge(r.type, mini);
            }
        });
        $("challenge-root").append(el("div", { class: "swap-row" }, [swap]));
    }
}

async function onComplete() {
    const res = await send("challengeComplete", { purpose, domain });
    if (!res.ok) {
        showResult(res.error, { error: true, dashboard: true });
        return;
    }
    mascot.setMood("grudging");
    mascot.react("squash");
    play("win");
    if (purpose === "removal") {
        const hours = Math.round((res.dueAt - Date.now()) / 3600000);
        speak("challenge.done.removal", { hours });
        showResult(`Done. You can remove ${domain} after ${formatClock(res.dueAt)}, with one last confirm in the dashboard. You can cancel before then.`, { dashboard: true });
    } else {
        speak("challenge.done.endEarly");
        showResult("Session ended. Your bans are back to normal.");
    }
}

$("back").addEventListener("click", () => chrome.runtime.openOptionsPage());

init();
