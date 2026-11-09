import { test } from "node:test";
import assert from "node:assert/strict";
import {
    pauseMinutesLeft, allowedPauseOptions, startWait, beat, waitRemainingMs,
    canComplete, grantPause, prunePauses, MAX_BEAT_GAP_MS
} from "../lib/pause.js";

const DAY = "2026-11-08";

test("daily cap limits options", () => {
    const usage = { day: DAY, byKey: { "x.com": 20 } };
    assert.equal(pauseMinutesLeft(usage, "x.com", DAY, 30), 10);
    assert.deepEqual(allowedPauseOptions(10), [5, 10]);
    assert.deepEqual(allowedPauseOptions(4), []);
    assert.equal(pauseMinutesLeft(usage, "x.com", "2026-11-09", 30), 30, "resets next day");
});

test("wait completes only after full countdown with steady beats", () => {
    let req = startWait(0, 5);
    for (let t = 5000; t <= 180000; t += 5000) req = beat(req, t);
    assert.equal(waitRemainingMs(req, 180000, 180), 0);
    assert.ok(canComplete(req, 180000, 180));
    assert.ok(!canComplete(req, 179000 + MAX_BEAT_GAP_MS + 2000, 180), "stale beat");
});

test("missed beat or hidden page restarts wait", () => {
    let req = startWait(0, 5);
    req = beat(req, 5000);
    req = beat(req, 5000 + MAX_BEAT_GAP_MS + 1);
    assert.equal(req.reset, true);
    assert.equal(req.startedAt, 5000 + MAX_BEAT_GAP_MS + 1);
    const hidden = beat(startWait(0, 5), 1000, { hidden: true });
    assert.equal(hidden.startedAt, 1000);
});

test("grantPause records usage and expiry", () => {
    const { pauses, usage } = grantPause({}, {}, "x.com", 10, 0, DAY);
    assert.equal(pauses["x.com"].until, 600000);
    assert.equal(usage.byKey["x.com"], 10);
    const pruned = prunePauses(pauses, 600000);
    assert.deepEqual(pruned, { pauses: {}, expired: true });
});
