import { test } from "node:test";
import assert from "node:assert/strict";
import { perchPosition, hopPath, nearestIndex, farthestIndex, releaseVelocity, bubbleSide, THROW_SPEED } from "../ui/roam-math.js";

const size = { w: 100, h: 80 };
const rect = { left: 200, top: 300, width: 400, height: 200 };

test("sit perch rests the mascot on the element's top edge", () => {
    const p = perchPosition(rect, { mode: "sit", align: 0.5 }, size);
    assert.equal(p.x, 350);
    assert.equal(p.y + size.h > rect.top, true, "slight overlap");
    assert.equal(p.layer, "front");
});

test("peek perches tuck about half the mascot behind the edge", () => {
    const right = perchPosition(rect, { mode: "peek", side: "right", align: 0.5 }, size);
    assert.equal(right.layer, "back");
    assert.ok(right.x < rect.left + rect.width && right.x + size.w > rect.left + rect.width);
    const top = perchPosition(rect, { mode: "peek", side: "top", align: 0 }, size);
    assert.ok(top.y < rect.top && top.y + size.h > rect.top);
});

test("hop arcs upward and lands exactly", () => {
    const { points, bounces } = hopPath({ x: 0, y: 500 }, { x: 200, y: 500 });
    assert.equal(bounces, 1);
    assert.deepEqual(points.at(-1), { x: 200, y: 500 });
    assert.ok(Math.min(...points.map((p) => p.y)) < 500, "goes up");
});

test("long hops split into bounces", () => {
    assert.equal(hopPath({ x: 0, y: 0 }, { x: 500, y: 0 }).bounces, 2);
    const long = hopPath({ x: 0, y: 0 }, { x: 900, y: 0 });
    assert.equal(long.bounces, 3);
    assert.deepEqual(long.points.at(-1), { x: 900, y: 0 });
});

test("nearest and farthest perch", () => {
    const positions = [{ x: 0, y: 0 }, { x: 500, y: 0 }, { x: 1000, y: 600 }];
    assert.equal(nearestIndex(positions, { x: 540, y: 30 }, size), 1);
    assert.equal(farthestIndex(positions, { x: 40, y: 30 }, size), 2);
});

test("release velocity separates drops from throws", () => {
    const slow = releaseVelocity([{ x: 0, y: 0, t: 0 }, { x: 20, y: 0, t: 100 }]);
    assert.ok(slow.speed < THROW_SPEED);
    const fast = releaseVelocity([{ x: 0, y: 0, t: 0 }, { x: 100, y: 0, t: 400 }, { x: 400, y: -100, t: 480 }]);
    assert.ok(fast.speed > THROW_SPEED);
    assert.ok(fast.vx > 0 && fast.vy < 0);
});

test("bubble opens on the side with room", () => {
    const vp = { left: 0, top: 0, width: 1200, height: 800 };
    const bubble = { w: 240, h: 60 };
    assert.equal(bubbleSide({ x: 900, y: 400, w: 100, h: 80 }, vp, bubble), "left");
    assert.equal(bubbleSide({ x: 40, y: 400, w: 100, h: 80 }, vp, bubble), "right");
    assert.equal(bubbleSide({ x: 600, y: 400, w: 100, h: 80 }, vp, bubble, "right"), "right", "preferred side wins when it fits");
    assert.equal(bubbleSide({ x: 1050, y: 400, w: 100, h: 80 }, vp, bubble, "right"), "left", "falls back when it doesn't");
});

import { statusFacts } from "../ui/status.js";

test("status facts: urgent first, then the day's numbers", () => {
    const now = 1_000_000;
    const state = {
        bansActive: true,
        timer: { endTime: now + 14 * 60000 },
        attemptsToday: { "reddit.com": 3, "x.com": 1 },
        watched: [
            { domain: "youtube.com", cooldown: { until: now + 12 * 60000 }, usage: [] },
            { domain: "instagram.com", cooldown: null, usage: [{ kind: "swipes", used: 18, limit: 25 }] }
        ],
        superBans: [{ domain: "tiktok.com", pausedUntil: null, removalStatus: "none", pauseMinutesLeft: 30 }],
        stats: { thisWeek: 12, change: -40 }
    };
    const { urgent, other } = statusFacts(state, now);
    assert.deepEqual(urgent, ["Focus ends in 14:00.", "youtube.com cooldown: 12:00 left."]);
    assert.ok(other.includes("4 tries today. Most on reddit.com (3)."));
    assert.ok(other.includes("instagram.com: 18 of 25 swipes."));
    assert.ok(other.includes("30 pause min left today for tiktok.com."));
    assert.ok(other.includes("12 tries this week, down 40% from last week."));
});

test("status facts with nothing going on", () => {
    const { urgent, other } = statusFacts({ attemptsToday: {}, watched: [], superBans: [] });
    assert.equal(urgent.length, 0);
    assert.deepEqual(other, ["Zero tries today. Suspicious, but nice."]);
});
