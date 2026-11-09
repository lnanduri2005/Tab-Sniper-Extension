// Small seeded PRNG so tests can make challenge content deterministic.
export function mulberry32(seed) {
    let a = seed >>> 0;
    return function next() {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function randInt(rng, min, max) {
    return min + Math.floor(rng() * (max - min + 1));
}

export function pick(rng, items) {
    return items[Math.floor(rng() * items.length)];
}
