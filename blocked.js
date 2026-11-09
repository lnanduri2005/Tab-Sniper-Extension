import { send, formatDuration } from "./lib/api.js";
import { parseBlockPageSearch } from "./lib/rules.js";

const { domain, category, url } = parseBlockPageSearch(location.search);
const $ = (id) => document.getElementById(id);

async function init() {
    document.title = `${domain} blocked · Tab Sniper`;
    const attempt = await send("recordAttempt", { domain });
    const info = await send("getBlockInfo", { domain, category });

    if (info.ok && !info.stillBlocked) {
        // Pause started or ban lifted since the redirect: go back.
        location.replace(url || `https://${domain}`);
        return;
    }

    const count = attempt.attemptsToday || 1;
    $("attempts").textContent = `Attempt #${count} on ${domain} today.`;

    if (category === "super") {
        $("title").textContent = `${domain} is super banned`;
        $("lead").textContent = "Blocked around the clock. You set this up for a reason.";
        renderPause(info);
    } else if (category === "watched") {
        renderCooldown(info);
    } else {
        $("title").textContent = `${domain} is banned right now`;
        $("lead").textContent = "This site is on your ban list.";
        $("ban-card").hidden = false;
        if (info.timer) {
            const tick = () => {
                const left = info.timer.endTime - Date.now();
                $("ban-help").textContent = left > 0
                    ? `Focus session: ${formatDuration(left)} left.`
                    : "Focus session finished. Reload to continue.";
            };
            tick();
            setInterval(tick, 1000);
        } else {
            $("ban-help").textContent = "Turn Tab Sniper off from the toolbar popup to visit it.";
        }
    }
}

function renderCooldown(info) {
    const cooldown = info.cooldown;
    $("title").textContent = `Cooldown: ${domain}`;
    $("lead").textContent = cooldown ? `You hit your limit: ${cooldown.reason}.` : "You hit your limit.";
    $("ban-card").hidden = false;
    const tick = () => {
        const left = (cooldown?.until || 0) - Date.now();
        if (left <= 0) {
            location.replace(url || `https://${domain}`);
            return;
        }
        $("ban-help").textContent =
            `Back in ${formatDuration(left)}. Trip #${info.tripsToday} today. ` +
            `Next one locks you out for ${info.nextCooldownMin} min. Cooldowns can't be paused.`;
    };
    tick();
    setInterval(tick, 1000);
}

function renderPause(info) {
    $("pause-card").hidden = false;
    const waitMin = Math.round(info.pauseWaitSec / 60);
    if (!info.pauseOptions.length) {
        $("pause-help").textContent = `You've used today's pause allowance for ${domain}. It resets at midnight.`;
        return;
    }
    $("pause-help").textContent =
        `Pausing takes a ${waitMin} minute wait on a page you can't leave. ` +
        `${info.pauseMinutesLeft} pause minutes left today.`;
    for (const minutes of info.pauseOptions) {
        const btn = document.createElement("button");
        btn.className = "btn ghost";
        btn.textContent = `Pause ${minutes} min`;
        btn.addEventListener("click", () => {
            const params = new URLSearchParams({ d: domain, m: String(minutes) });
            location.href = `pause.html?${params}&u=${url}`;
        });
        $("pause-options").append(btn);
    }
}

init();
