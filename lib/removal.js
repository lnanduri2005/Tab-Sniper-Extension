// Super-ban removal: request -> challenge -> cool-off -> final confirm.
import { HOUR_MS } from "./defaults.js";

export function newRemoval(now) {
    return { requestedAt: now, challengeDoneAt: null, dueAt: null };
}

export function completeRemovalChallenge(removal, now, coolOffHours) {
    return { ...removal, challengeDoneAt: now, dueAt: now + coolOffHours * HOUR_MS };
}

// "none" | "challenge" | "cooling" | "due"
export function removalStatus(removal, now) {
    if (!removal) return "none";
    if (!removal.challengeDoneAt) return "challenge";
    return removal.dueAt <= now ? "due" : "cooling";
}
