import { send, formatClock } from "./lib/api.js";
import { CHALLENGE_LABELS } from "./challenges/index.js";
import { createMascot } from "./ui/mascot.js";
import { say } from "./ui/voice.js";
import { loadSoundSetting, play } from "./ui/sound.js";
import { el, $ } from "./ui/dom.js";

const params = new URLSearchParams(location.search);
const purpose = params.get("purpose");
const domain = params.get("d") || "";

const mascot = createMascot({ mood: "mischievous", label: "Tab Sniper mascot refereeing" });
$("mascot-slot").append(mascot.el);
mascot.on((evt) => evt === "poke" && play("poke"));

let nervous = false;

function speak(key, vars) {
    $("bubble").textContent = say(key, vars);
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
        speak("challenge.mistake");
        mascot.express("smug", 1600);
        mascot.react("bounce");
        play("oops");
    } else if (type === "progress") {
        if (value >= 0.7 && !nervous) {
            nervous = true;
            mascot.setMood("nervous");
            speak("challenge.close");
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
        mascot.setMood("grudging");
        speak("challenge.start");
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
    speak("challenge.start");

    const module = await import(`./challenges/${res.type}.js`);
    module.mount($("challenge-root"), { mini: res.mini, onComplete, onEvent });
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

init();
