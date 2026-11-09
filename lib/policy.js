import { extractDomain, domainMatches } from "./match.js";

// state: { enabled, timer, bans: string[], superBans: {domain}[], pauses: {[domain]: {until}},
//          watched: {domain}[], cooldowns: {[domain]: {until}}, settings }

export function timerRunning(timer, now) {
    return !!timer?.active && timer.endTime > now;
}

export function bansActive(state, now) {
    return !!state.enabled || timerRunning(state.timer, now);
}

export function isPaused(pauses, domain, now) {
    return !!pauses?.[domain] && pauses[domain].until > now;
}

// What to do with a navigation to `url`.
// -> { action: "allow" } | { action: "block" | "close", category: "super" | "watched" | "ban", domain }
export function decide(url, state, now) {
    const host = extractDomain(url);
    if (!host) return { action: "allow" };

    const superBan = (state.superBans || []).find((s) => domainMatches(host, s.domain));
    if (superBan && !isPaused(state.pauses, superBan.domain, now)) {
        return { action: "block", category: "super", domain: superBan.domain };
    }

    const cooling = (state.watched || []).find(
        (w) => domainMatches(host, w.domain) && state.cooldowns?.[w.domain]?.until > now
    );
    if (cooling) return { action: "block", category: "watched", domain: cooling.domain };

    if (bansActive(state, now)) {
        const ban = (state.bans || []).find((d) => domainMatches(host, d));
        if (ban) {
            const action = state.settings?.blockAction === "close" ? "close" : "block";
            return { action, category: "ban", domain: ban };
        }
    }

    return { action: "allow" };
}

// Domains that need a redirect-to-block-page rule right now.
export function activeBlocks(state, now) {
    const blocks = [];
    const taken = new Set();
    for (const { domain } of state.superBans || []) {
        if (isPaused(state.pauses, domain, now)) continue;
        taken.add(domain);
        blocks.push({ domain, category: "super" });
    }
    for (const { domain } of state.watched || []) {
        if (taken.has(domain) || !(state.cooldowns?.[domain]?.until > now)) continue;
        taken.add(domain);
        blocks.push({ domain, category: "watched" });
    }
    if (bansActive(state, now) && state.settings?.blockAction !== "close") {
        for (const domain of state.bans || []) {
            if (!taken.has(domain)) blocks.push({ domain, category: "ban" });
        }
    }
    return blocks;
}
