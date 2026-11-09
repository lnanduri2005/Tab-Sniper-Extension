import { send, formatDuration } from "./lib/api.js";
import { splitTrailingUrl } from "./lib/rules.js";

const { params, url } = splitTrailingUrl(location.search);
const domain = params.get("d") || "";
const minutes = Number(params.get("m"));
const target = url || `https://${domain}`;

const $ = (id) => document.getElementById(id);
let finishing = false;

async function start() {
    $("title").textContent = `Pausing ${domain} for ${minutes} min`;
    $("detail").textContent = "When this hits zero the site unlocks, then relocks automatically.";
    const res = await send("pauseStart", { domain, minutes });
    if (!res.ok) {
        $("message").textContent = res.error;
        $("message").classList.add("error");
        $("countdown").textContent = "--:--";
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
    $("message").textContent = res.reset ? "You left the tab, so the countdown restarted." : "";
    $("countdown").textContent = formatDuration(res.remainingMs);
    if (res.remainingMs === 0) {
        finishing = true;
        const done = await send("pauseComplete", { domain });
        if (done.ok) {
            location.replace(target);
        } else {
            finishing = false;
            $("message").textContent = done.error;
        }
    }
}

$("cancel").addEventListener("click", async () => {
    await send("pauseCancel", { domain });
    history.length > 1 ? history.back() : window.close();
});

start();
