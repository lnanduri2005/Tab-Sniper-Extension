import { send, formatClock } from "./lib/api.js";
import { CHALLENGE_LABELS } from "./challenges/index.js";

const params = new URLSearchParams(location.search);
const purpose = params.get("purpose");
const domain = params.get("d") || "";
const $ = (id) => document.getElementById(id);

function showResult(text, { error = false, link = null } = {}) {
    $("challenge-root").hidden = true;
    const result = $("result");
    result.hidden = false;
    result.replaceChildren();
    const p = document.createElement("p");
    p.textContent = text;
    if (error) p.className = "error";
    result.append(p);
    if (link) {
        const btn = document.createElement("button");
        btn.className = "btn";
        btn.style.marginTop = "12px";
        btn.textContent = link.label;
        btn.addEventListener("click", link.onClick);
        result.append(btn);
    }
}

const openDashboard = { label: "Open dashboard", onClick: () => chrome.runtime.openOptionsPage() };

async function init() {
    const res = await send("getChallenge", { purpose, domain });
    if (!res.ok) {
        showResult(res.error, { error: true, link: openDashboard });
        return;
    }

    const label = CHALLENGE_LABELS[res.type];
    if (purpose === "removal") {
        $("title").textContent = `Remove super ban: ${domain}`;
        $("lead").textContent = `${label}. Finish it to start the cool-off. Closing this page won't change the challenge.`;
    } else {
        $("title").textContent = "End focus session early";
        $("lead").textContent = `${label}. Finish it to end your session (logged as incomplete).`;
    }

    const module = await import(`./challenges/${res.type}.js`);
    module.mount($("challenge-root"), { mini: res.mini, onComplete });
}

async function onComplete() {
    const res = await send("challengeComplete", { purpose, domain });
    if (!res.ok) {
        showResult(res.error, { error: true, link: openDashboard });
        return;
    }
    if (purpose === "removal") {
        showResult(
            `Challenge done. ${domain} can be removed after ${formatClock(res.dueAt)}. ` +
            "You'll need to confirm it in the dashboard then. You can cancel anytime before.",
            { link: openDashboard }
        );
    } else {
        showResult("Session ended. Your bans are back to normal.");
    }
}

init();
