import { send, formatDuration } from "./lib/api.js";
import { splitTrailingUrl } from "./lib/rules.js";
import { createMascot } from "./ui/mascot.js";
import { say } from "./ui/voice.js";
import { loadSoundSetting, play } from "./ui/sound.js";
import { $ } from "./ui/dom.js";

const { params, url } = splitTrailingUrl(location.search);
const domain = params.get("d") || "";
const minutes = Number(params.get("m"));
const target = url || `https://${domain}`;

const mascot = createMascot({ mood: "bored", label: "Tab Sniper mascot waiting with you" });
$("mascot-slot").append(mascot.el);
mascot.on((evt) => evt === "poke" && play("poke"));

let finishing = false;
let lastLine = 0;

function speak(key, vars) {
    $("bubble").textContent = say(key, vars);
    lastLine = Date.now();
}

async function start() {
    loadSoundSetting();
    $("title").textContent = `Pausing ${domain} for ${minutes} min`;
    speak("pause.wait");
    const res = await send("pauseStart", { domain, minutes });
    if (!res.ok) {
        $("message").textContent = res.error;
        mascot.setMood("grudging");
        return;
    }
    $("countdown").textContent = formatDuration(res.remainingMs);
    setInterval(heartbeat, 1000);
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) send("pauseBeat", { domain, hidden: true });
    });
}

async function heartbeat() {
    if (finishing) return;
    const res = await send("pauseBeat", { domain, hidden: document.hidden });
    if (!res.ok) {
        $("message").textContent = res.error;
        return;
    }
    if (res.reset) {
        speak("pause.reset");
        mascot.express("smug", 2500);
        mascot.react("shake");
        play("oops");
    } else if (Date.now() - lastLine > 20000) {
        speak("pause.wait");
        mascot.react(Math.random() < 0.5 ? "tilt" : "nod");
    }
    $("countdown").textContent = formatDuration(res.remainingMs);
    if (res.remainingMs === 0) {
        finishing = true;
        const done = await send("pauseComplete", { domain });
        if (done.ok) {
            speak("pause.done", { minutes });
            mascot.setMood("grudging");
            play("tick");
            setTimeout(() => location.replace(target), 900);
        } else {
            finishing = false;
            $("message").textContent = done.error;
        }
    }
}

$("cancel").addEventListener("click", async () => {
    await send("pauseCancel", { domain });
    mascot.express("happy", 800);
    setTimeout(() => (history.length > 1 ? history.back() : window.close()), 500);
});

start();
