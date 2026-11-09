// Challenge pool. The challenge type is locked per purpose (e.g. "removal:reddit.com")
// so closing and reopening the page can't reroll an easier one.

export const CHALLENGE_TYPES = ["typing", "cannon", "math", "memory"];

export const CHALLENGE_LABELS = {
    typing: "Typing gauntlet",
    cannon: "Cannon into basket",
    math: "Mental math",
    memory: "Memory sequence"
};

export function pickChallenge(rng = Math.random) {
    return CHALLENGE_TYPES[Math.floor(rng() * CHALLENGE_TYPES.length)];
}

// -> { locks, type } (locks unchanged when the key already has a type)
export function lockChallenge(locks, key, rng = Math.random) {
    const existing = locks?.[key];
    if (existing && CHALLENGE_TYPES.includes(existing)) return { locks, type: existing };
    const type = pickChallenge(rng);
    return { locks: { ...(locks || {}), [key]: type }, type };
}

export function releaseChallenge(locks, key) {
    const next = { ...(locks || {}) };
    delete next[key];
    return next;
}

// One-time escape from the cannon for people who can't aim precisely: it swaps to typing,
// which is no easier, and only the cannon can be swapped, so it can't be used to reroll.
export const SWAPPABLE = { cannon: "typing" };

// -> { locks, type } or null when this lock can't be swapped
export function swapChallenge(locks, key) {
    const current = locks?.[key];
    const next = SWAPPABLE[current];
    if (!next) return null;
    return { locks: { ...locks, [key]: next }, type: next };
}
