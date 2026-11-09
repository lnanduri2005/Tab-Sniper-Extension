// Super-ban pause: wait out a countdown on a visible tab, then unlock for N minutes,
// limited by a daily per-site cap.
import { PAUSE_OPTIONS_MIN, MINUTE_MS } from "./defaults.js";
import { readDaily, bumpDaily } from "./day.js";

export const MAX_BEAT_GAP_MS = 10000;

export function pauseMinutesLeft(usage, domain, day, capMin) {
    return Math.max(0, capMin - readDaily(usage, day, domain));
}

export function allowedPauseOptions(minutesLeft) {
    return PAUSE_OPTIONS_MIN.filter((m) => m <= minutesLeft);
}

export function startWait(now, minutes) {
    return { startedAt: now, lastBeat: now, minutes };
}

// A heartbeat from the countdown page. A missed beat or a hidden page restarts the wait.
export function beat(request, now, { hidden = false } = {}) {
    if (hidden || now - request.lastBeat > MAX_BEAT_GAP_MS) {
        return { ...request, startedAt: now, lastBeat: now, reset: true };
    }
    return { ...request, lastBeat: now, reset: false };
}

export function waitRemainingMs(request, now, waitSec) {
    return Math.max(0, request.startedAt + waitSec * 1000 - now);
}

export function canComplete(request, now, waitSec) {
    if (!request) return false;
    if (now - request.lastBeat > MAX_BEAT_GAP_MS) return false;
    return waitRemainingMs(request, now, waitSec) === 0;
}

export function grantPause(pauses, usage, domain, minutes, now, day) {
    return {
        pauses: { ...pauses, [domain]: { until: now + minutes * MINUTE_MS, minutes } },
        usage: bumpDaily(usage, day, domain, minutes)
    };
}

export function prunePauses(pauses, now) {
    const kept = {};
    let expired = false;
    for (const [domain, pause] of Object.entries(pauses || {})) {
        if (pause.until > now) kept[domain] = pause;
        else expired = true;
    }
    return { pauses: kept, expired };
}
