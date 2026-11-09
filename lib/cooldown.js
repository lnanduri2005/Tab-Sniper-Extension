// Watched-site cooldowns: 30 min, doubling with each trip that day, max 4h. Unpausable.
import { MINUTE_MS } from "./defaults.js";
import { bumpDaily, readDaily } from "./day.js";

export const BASE_COOLDOWN_MIN = 30;
export const MAX_COOLDOWN_MIN = 240;

export function cooldownMinutes(tripNumber) {
    return Math.min(MAX_COOLDOWN_MIN, BASE_COOLDOWN_MIN * 2 ** Math.max(0, tripNumber - 1));
}

export function startCooldown(cooldowns, trips, domain, reason, now, day) {
    const nextTrips = bumpDaily(trips, day, domain);
    const minutes = cooldownMinutes(nextTrips.byKey[domain]);
    return {
        cooldowns: { ...cooldowns, [domain]: { until: now + minutes * MINUTE_MS, reason, minutes } },
        trips: nextTrips,
        minutes
    };
}

export function inCooldown(cooldowns, domain, now) {
    return !!cooldowns?.[domain] && cooldowns[domain].until > now;
}

export function nextCooldownMinutes(trips, domain, day) {
    return cooldownMinutes(readDaily(trips, day, domain) + 1);
}

export function pruneCooldowns(cooldowns, now) {
    const kept = {};
    let expired = false;
    for (const [domain, c] of Object.entries(cooldowns || {})) {
        if (c.until > now) kept[domain] = c;
        else expired = true;
    }
    return { cooldowns: kept, expired };
}
