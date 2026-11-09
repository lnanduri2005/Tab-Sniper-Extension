import { test } from "node:test";
import assert from "node:assert/strict";
import { migrate, V1_SYNC_KEYS, SCHEMA_VERSION } from "../lib/migrate.js";

test("v1 data migrates into sync config + local runtime", () => {
    const sync = {
        enabled: true,
        blockedUrls: ["reddit.com", "www.YouTube.com", "reddit.com", "bad input"],
        presets: [{ id: 1, name: "Deep", minutes: 50, scheduleTime: "09:00" }],
        timerActive: true,
        timerEndTime: 2000,
        timerStartTime: 1000,
        timerDurationMinutes: 25,
        history: [{ id: "s1", duration: 25, completed: true }],
        stats: { dailyMinutes: [1, 2, 3, 4, 5, 6, 7], blockedSites: { "reddit.com": 2 } }
    };
    const out = migrate(sync, {}, 1500);
    assert.deepEqual(out.syncSet.bans, ["reddit.com", "youtube.com"]);
    assert.equal(out.syncSet.enabled, true);
    assert.deepEqual(out.syncSet.presets, [{ id: 1, name: "Deep", minutes: 50 }]);
    assert.deepEqual(out.syncSet.superBans, []);
    assert.equal(out.syncSet.settings.coolOffHours, 12);
    assert.deepEqual(out.syncRemove, V1_SYNC_KEYS);
    assert.equal(out.localSet.schemaVersion, SCHEMA_VERSION);
    assert.equal(out.localSet.timer.endTime, 2000);
    assert.equal(out.localSet.history.length, 1);
    assert.equal(out.localSet.stats.blockedSites["reddit.com"], 2);
});

test("expired v1 timer is dropped", () => {
    const out = migrate({ timerActive: true, timerEndTime: 10 }, {}, 20);
    assert.equal(out.localSet.timer, null);
});

test("already migrated returns null", () => {
    assert.equal(migrate({}, { schemaVersion: SCHEMA_VERSION }, 0), null);
});

test("fresh install gets defaults", () => {
    const out = migrate({}, {}, 0);
    assert.deepEqual(out.syncSet.bans, []);
    assert.equal(out.syncSet.enabled, false);
    assert.deepEqual(out.localSet.stats.dailyMinutes, [0, 0, 0, 0, 0, 0, 0]);
});
