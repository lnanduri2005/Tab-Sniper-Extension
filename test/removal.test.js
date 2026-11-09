import { test } from "node:test";
import assert from "node:assert/strict";
import { newRemoval, completeRemovalChallenge, removalStatus } from "../lib/removal.js";
import { lockChallenge, releaseChallenge, CHALLENGE_TYPES } from "../challenges/index.js";
import { HOUR_MS } from "../lib/defaults.js";

test("removal goes challenge -> cooling -> due", () => {
    let r = newRemoval(0);
    assert.equal(removalStatus(r, 0), "challenge");
    r = completeRemovalChallenge(r, 10, 12);
    assert.equal(removalStatus(r, 10), "cooling");
    assert.equal(removalStatus(r, 10 + 12 * HOUR_MS), "due");
    assert.equal(removalStatus(undefined, 0), "none");
});

test("challenge lock survives re-requests (no rerolls)", () => {
    const first = lockChallenge({}, "removal:x.com", () => 0.99);
    assert.equal(first.type, CHALLENGE_TYPES[3]);
    const again = lockChallenge(first.locks, "removal:x.com", () => 0);
    assert.equal(again.type, first.type);
    const released = releaseChallenge(again.locks, "removal:x.com");
    assert.deepEqual(released, {});
});

import { swapChallenge } from "../challenges/index.js";

test("cannon can be swapped to typing exactly once", () => {
    const first = swapChallenge({ "removal:x.com": "cannon" }, "removal:x.com");
    assert.equal(first.type, "typing");
    assert.equal(swapChallenge(first.locks, "removal:x.com"), null, "typing can't be swapped again");
    assert.equal(swapChallenge({ settings: "math" }, "settings"), null, "only the cannon is swappable");
    assert.equal(swapChallenge({}, "settings"), null);
});
