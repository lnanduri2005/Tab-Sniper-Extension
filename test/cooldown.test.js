import { test } from "node:test";
import assert from "node:assert/strict";
import { cooldownMinutes, startCooldown, inCooldown, nextCooldownMinutes, pruneCooldowns } from "../lib/cooldown.js";
import { decide, activeBlocks } from "../lib/policy.js";
import { DEFAULT_SETTINGS } from "../lib/defaults.js";

const DAY = "2026-11-08";

test("cooldown doubles per trip, capped at 4h", () => {
    assert.deepEqual([1, 2, 3, 4, 5, 6].map((n) => cooldownMinutes(n)), [30, 60, 120, 240, 240, 240]);
});

test("cooldown base is adjustable", () => {
    assert.deepEqual([1, 2, 3].map((n) => cooldownMinutes(n, 10)), [10, 20, 40]);
    assert.deepEqual([1, 2, 3].map((n) => cooldownMinutes(n, 120)), [120, 240, 240]);
    const r = startCooldown({}, {}, "x.com", "r", 0, "2026-11-08", 10);
    assert.equal(r.minutes, 10);
    assert.equal(nextCooldownMinutes(r.trips, "x.com", "2026-11-08", 10), 20);
});

test("startCooldown escalates within a day and resets next day", () => {
    let r = startCooldown({}, {}, "youtube.com", "25 Shorts in 10 min", 0, DAY);
    assert.equal(r.minutes, 30);
    assert.equal(r.cooldowns["youtube.com"].until, 30 * 60_000);
    r = startCooldown(r.cooldowns, r.trips, "youtube.com", "x", 0, DAY);
    assert.equal(r.minutes, 60);
    assert.equal(nextCooldownMinutes(r.trips, "youtube.com", DAY), 120);
    r = startCooldown(r.cooldowns, r.trips, "youtube.com", "x", 0, "2026-11-09");
    assert.equal(r.minutes, 30);
});

test("inCooldown and prune", () => {
    const c = { "a.com": { until: 10 } };
    assert.ok(inCooldown(c, "a.com", 9));
    assert.ok(!inCooldown(c, "a.com", 10));
    assert.deepEqual(pruneCooldowns(c, 10), { cooldowns: {}, expired: true });
});

test("policy blocks watched site during cooldown; super takes precedence", () => {
    const state = {
        enabled: false,
        bans: [],
        superBans: [],
        pauses: {},
        settings: { ...DEFAULT_SETTINGS },
        watched: [{ domain: "youtube.com" }],
        cooldowns: { "youtube.com": { until: 100 } }
    };
    assert.deepEqual(decide("https://www.youtube.com/watch?v=1", state, 50), { action: "block", category: "watched", domain: "youtube.com" });
    assert.equal(decide("https://youtube.com", state, 100).action, "allow");
    assert.deepEqual(activeBlocks(state, 50), [{ domain: "youtube.com", category: "watched" }]);
    const both = { ...state, superBans: [{ domain: "youtube.com" }] };
    assert.deepEqual(activeBlocks(both, 50), [{ domain: "youtube.com", category: "super" }]);
});
