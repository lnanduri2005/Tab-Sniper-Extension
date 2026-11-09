import { test } from "node:test";
import assert from "node:assert/strict";
import { lastDays, logEvent, pruneLog, summarize, trend } from "../lib/stats.js";

const TODAY = new Date(2026, 10, 8); // Nov 8 2026 local

test("lastDays spans 30 local days ending today, across month edges", () => {
    const days = lastDays(TODAY);
    assert.equal(days.length, 30);
    assert.equal(days.at(-1), "2026-11-08");
    assert.equal(days[0], "2026-10-10");
});

test("logEvent accumulates per field", () => {
    let log = logEvent({}, "2026-11-08", "attempts", "reddit.com");
    log = logEvent(log, "2026-11-08", "attempts", "reddit.com", 2);
    log = logEvent(log, "2026-11-08", "focusMin", null, 25);
    log = logEvent(log, "2026-11-08", "trips", "youtube.com");
    assert.deepEqual(log["2026-11-08"], { attempts: { "reddit.com": 3 }, trips: { "youtube.com": 1 }, pauses: {}, focusMin: 25 });
});

test("pruneLog drops days older than 30", () => {
    const log = { "2026-11-08": { attempts: {} }, "2026-10-09": { attempts: {} }, "2026-10-10": { attempts: {} } };
    assert.deepEqual(Object.keys(pruneLog(log, TODAY)).sort(), ["2026-10-10", "2026-11-08"]);
});

test("summarize: series, top sites, week over week, trend", () => {
    let log = {};
    for (const day of lastDays(TODAY).slice(-14, -7)) log = logEvent(log, day, "attempts", "reddit.com", 4);
    for (const day of lastDays(TODAY).slice(-7)) log = logEvent(log, day, "attempts", "instagram.com", 1);
    log = logEvent(log, "2026-11-08", "focusMin", null, 50);
    const s = summarize(log, TODAY);
    assert.equal(s.series.length, 30);
    assert.equal(s.lastWeek, 28);
    assert.equal(s.thisWeek, 7);
    assert.equal(s.change, -75);
    assert.equal(s.focusThisWeek, 50);
    assert.deepEqual(s.topSites[0], ["reddit.com", 28]);
    assert.equal(trend(s), "down");
    assert.equal(trend(summarize({}, TODAY)), "none");
    assert.equal(trend({ thisWeek: 3, lastWeek: 0, total30: 3 }), "first");
    assert.equal(trend({ thisWeek: 10, lastWeek: 5, total30: 15 }), "up");
});
