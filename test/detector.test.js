import { test } from "node:test";
import assert from "node:assert/strict";
import { accrue, recordNav, evaluate, measure, emptyEntry, VISIT_GAP_MS, MAX_SEGMENT_MS } from "../lib/detector.js";
import { newWatchedEntry, isShortForm, swipeId, findWatched, clampWatchField } from "../lib/profiles.js";

const MIN = 60_000;
const yt = newWatchedEntry({ profile: "youtube" });
const custom = newWatchedEntry({ domain: "news.ycombinator.com" });

// Credit `minutes` of active time on url in 30s segments starting at t0.
function spend(entry, watched, url, t0, minutes) {
    let e = entry;
    for (let t = t0; t < t0 + minutes * MIN; t += 30_000) e = accrue(e, watched, url, t, t + 30_000);
    return e;
}

test("profiles: defaults, short-form paths, swipe ids", () => {
    assert.deepEqual(yt, { domain: "youtube.com", profile: "youtube", visitLimitMin: 15, streakLimitMin: 8, swipeLimit: 25, swipeWindowMin: 10 });
    assert.deepEqual(custom, { domain: "news.ycombinator.com", profile: null, visitLimitMin: 15 });
    assert.equal(newWatchedEntry({ profile: "x" }).swipeLimit, undefined, "no swipe limit without swipe pattern");
    assert.ok(isShortForm(yt, "https://www.youtube.com/shorts/abc"));
    assert.ok(!isShortForm(yt, "https://www.youtube.com/watch?v=abc"));
    assert.equal(swipeId(yt, "https://youtube.com/shorts/abc123?feature=share"), "abc123");
    assert.equal(swipeId(newWatchedEntry({ profile: "instagram" }), "https://instagram.com/reel/C9x/"), "C9x");
    assert.equal(swipeId(custom, "https://news.ycombinator.com/item?id=1"), null);
    assert.equal(findWatched([yt], "https://m.youtube.com/shorts/x").domain, "youtube.com");
    assert.equal(findWatched([yt], "https://example.com"), null);
    assert.equal(clampWatchField("visitLimitMin", 999), 120);
    assert.equal(clampWatchField("swipeLimit", "x"), null);
});

test("per-visit limit warns at 80% then trips", () => {
    let e = spend(emptyEntry(), custom, "https://news.ycombinator.com/", 0, 11.5);
    assert.equal(evaluate(e, custom, 0).warn, null);
    e = spend(e, custom, "https://news.ycombinator.com/", 11.5 * MIN, 0.5);
    const warned = evaluate(e, custom, 12 * MIN);
    assert.equal(warned.warn.kind, "visit");
    assert.match(warned.warn.text, /12 of 15 min/);
    assert.equal(evaluate(warned.entry, custom, 12 * MIN).warn, null, "warns once");
    e = spend(warned.entry, custom, "https://news.ycombinator.com/", 12 * MIN, 3);
    const tripped = evaluate(e, custom, 15 * MIN);
    assert.equal(tripped.trip.kind, "visit");
    assert.equal(tripped.trip.text, "15 min straight on news.ycombinator.com");
});

test("visit resets after 5 min away", () => {
    let e = spend(emptyEntry(), custom, "https://news.ycombinator.com/", 0, 10);
    e = accrue(e, custom, "https://news.ycombinator.com/", 10 * MIN + VISIT_GAP_MS + 1, 10 * MIN + VISIT_GAP_MS + 30_001);
    assert.equal(e.visitMs, 30_000);
});

test("segments are capped (sleep gaps don't count as usage)", () => {
    const e = accrue(emptyEntry(), custom, "https://news.ycombinator.com/", 0, 10 * MIN);
    assert.equal(e.visitMs, MAX_SEGMENT_MS);
});

test("short-form streak trips at 8 min; a minute elsewhere breaks it", () => {
    let e = spend(emptyEntry(), yt, "https://youtube.com/shorts/a", 0, 7);
    e = spend(e, yt, "https://youtube.com/feed/subscriptions", 7 * MIN, 1);
    assert.equal(e.streakMs, 0, "streak broken");
    e = spend(e, yt, "https://youtube.com/shorts/b", 8 * MIN, 6.5);
    assert.equal(evaluate(e, yt, 14.5 * MIN).trip, null);
    e = spend(e, yt, "https://youtube.com/shorts/b", 14.5 * MIN, 0.5);
    // visit limit (15) also reached here; streak is 7 so visit trips first
    assert.equal(evaluate(e, yt, 15 * MIN).trip.kind, "visit");
});

test("short detour under a minute keeps the streak", () => {
    let e = spend(emptyEntry(), yt, "https://youtube.com/shorts/a", 0, 7);
    e = accrue(e, yt, "https://youtube.com/", 7 * MIN, 7 * MIN + 30_000);
    e = spend(e, yt, "https://youtube.com/shorts/a", 7.5 * MIN, 1);
    const r = evaluate(e, yt, 8.5 * MIN);
    assert.equal(r.trip.kind, "streak");
    assert.equal(r.trip.text, "8 min of Shorts in a row");
});

test("swipe counting: distinct ids in rolling window", () => {
    let e = emptyEntry();
    for (let i = 0; i < 19; i++) e = recordNav(e, yt, `https://youtube.com/shorts/v${i}`, i * 1000);
    e = recordNav(e, yt, "https://youtube.com/shorts/v0", 19_000); // repeat doesn't count
    assert.equal(measure(e, yt, 19_000).find((m) => m.kind === "swipes").used, 19);
    e = recordNav(e, yt, "https://youtube.com/shorts/v19", 20_000);
    const warned = evaluate(e, yt, 20_000);
    assert.equal(warned.warn.kind, "swipes");
    assert.match(warned.warn.text, /20 of 25 Shorts in 10 min/);
    e = warned.entry;
    for (let i = 20; i < 25; i++) e = recordNav(e, yt, `https://youtube.com/shorts/v${i}`, 21_000 + i);
    assert.equal(evaluate(e, yt, 22_000).trip.text, "25 Shorts in 10 min");
});

test("old swipes fall out of the window", () => {
    let e = emptyEntry();
    for (let i = 0; i < 24; i++) e = recordNav(e, yt, `https://youtube.com/shorts/v${i}`, 0);
    e = { ...e, lastAt: 9.9 * MIN };
    e = recordNav(e, yt, "https://youtube.com/shorts/late", 10 * MIN + 1);
    assert.equal(measure(e, yt, 10 * MIN + 1).find((m) => m.kind === "swipes").used, 1);
});

test("custom domains only measure visit time", () => {
    assert.deepEqual(measure(emptyEntry(), custom, 0).map((m) => m.kind), ["visit"]);
    assert.deepEqual(measure(emptyEntry(), newWatchedEntry({ profile: "reddit" }), 0).map((m) => m.kind), ["visit", "streak"]);
});
