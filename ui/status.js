// Tap-for-status: each tap says one live fact about your day, cycling through what's relevant.
// Rapid tapping annoys the mascot. Asleep, it mumbles and only reports what's actively running.
import { formatDuration } from "../lib/api.js";
import { say } from "./voice.js";

const tries = (n) => `${n} ${n === 1 ? "try" : "tries"}`;

// Pure: state (from getState) -> { urgent: string[], other: string[] }
export function statusFacts(state, now = Date.now()) {
    const urgent = [];
    const other = [];
    if (!state) return { urgent, other };

    if (state.timer) urgent.push(`Focus ends in ${formatDuration(state.timer.endTime - now)}.`);
    for (const w of state.watched || []) {
        if (w.cooldown) urgent.push(`${w.domain} cooldown: ${formatDuration(w.cooldown.until - now)} left.`);
    }
    for (const s of state.superBans || []) {
        if (s.pausedUntil) urgent.push(`${s.domain} is paused for ${formatDuration(s.pausedUntil - now)}. Then it locks again.`);
        if (s.removalStatus === "cooling") urgent.push(`${s.domain} is removable in ${formatDuration(s.removal.dueAt - now)}.`);
        if (s.removalStatus === "due") urgent.push(`${s.domain} removal is ready to confirm. Still sure?`);
    }

    const attempts = Object.entries(state.attemptsToday || {}).sort((a, b) => b[1] - a[1]);
    const total = attempts.reduce((sum, [, n]) => sum + n, 0);
    if (total) other.push(`${tries(total)} today. Most on ${attempts[0][0]} (${attempts[0][1]}).`);
    else other.push("Zero tries today. Suspicious, but nice.");

    for (const w of state.watched || []) {
        if (w.cooldown) continue;
        const top = [...(w.usage || [])].sort((a, b) => b.used / b.limit - a.used / a.limit)[0];
        if (top && top.used >= 1) {
            other.push(top.kind === "swipes"
                ? `${w.domain}: ${top.used} of ${top.limit} swipes.`
                : `${w.domain}: ${Math.floor(top.used)} of ${top.limit} min${top.kind === "streak" ? " of short-form" : " this visit"}.`);
        }
    }
    for (const s of state.superBans || []) {
        if (!s.pausedUntil && s.removalStatus === "none") other.push(`${s.pauseMinutesLeft} pause min left today for ${s.domain}.`);
    }
    if (state.stats?.thisWeek != null) {
        const change = state.stats.change;
        other.push(change == null
            ? `${tries(state.stats.thisWeek)} this week.`
            : `${tries(state.stats.thisWeek)} this week, ${change <= 0 ? `down ${-change}%` : `up ${change}%`} from last week.`);
    }
    return { urgent, other };
}

// Wires a mascot to tap-for-status. `speak(text)` shows the line (bubble or caption).
export function createTapper({ mascot, getState, speak, play = () => {} }) {
    let index = 0;
    let taps = [];

    return function onTap() {
        const now = Date.now();
        taps = taps.filter((t) => now - t < 2500).concat(now);
        if (taps.length >= 4) {
            mascot.express("angry", 2200);
            mascot.react("shake");
            speak(say("tap.annoyed"));
            play("deny");
            return;
        }

        const state = getState();
        const { urgent, other } = statusFacts(state, now);
        const asleep = state && !state.bansActive && !state.timer;

        if (asleep) {
            mascot.express("grudging", 1800);
            mascot.react("nod");
            speak(urgent.length ? `${say("tap.sleepy")} ${urgent[0]}` : say("tap.sleepy"));
            play("poke");
            return;
        }

        const facts = [...urgent, ...other];
        const fact = facts[index % facts.length] || say("tap.calm");
        index += 1;
        mascot.express(urgent.includes(fact) ? "stern" : "mischievous", 1600);
        mascot.react("squash");
        speak(fact);
        play("poke");
    };
}
