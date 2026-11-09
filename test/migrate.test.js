import { test } from "node:test";
import assert from "node:assert/strict";
import { migrate, SCHEMA_VERSION } from "../lib/migrate.js";

test("v1 (all in sync) moves everything to local and clears sync", () => {
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
    assert.equal(out.clearSync, true);
    const l = out.localSet;
    assert.equal(l.schemaVersion, SCHEMA_VERSION);
    assert.deepEqual(l.bans, ["reddit.com", "youtube.com"]);
    assert.equal(l.enabled, true);
    assert.deepEqual(l.presets, [{ id: 1, name: "Deep", minutes: 50 }]);
    assert.deepEqual(l.superBans, []);
    assert.equal(l.settings.coolOffHours, 12);
    assert.equal(l.timer.endTime, 2000);
    assert.equal(l.history.length, 1);
    assert.equal(l.stats.blockedSites["reddit.com"], 2);
});

test("v2 (config in sync, runtime in local) keeps runtime and pulls config local", () => {
    const sync = {
        enabled: false,
        bans: ["x.com"],
        superBans: [{ domain: "instagram.com", addedAt: 5 }],
        watched: [{ domain: "youtube.com", profile: "youtube", visitLimitMin: 15 }],
        settings: { coolOffHours: 6 },
        removals: { "instagram.com": { requestedAt: 1, challengeDoneAt: null, dueAt: null } }
    };
    const local = { schemaVersion: 2, timer: null, history: [{ id: "a" }], attempts: { day: "d", byKey: { "x.com": 2 } } };
    const l = migrate(sync, local, 0).localSet;
    assert.deepEqual(l.bans, ["x.com"]);
    assert.equal(l.superBans[0].domain, "instagram.com");
    assert.equal(l.watched[0].domain, "youtube.com");
    assert.equal(l.settings.coolOffHours, 6);
    assert.equal(l.settings.pauseWaitSec, 180, "defaults fill new settings");
    assert.equal(l.removals["instagram.com"].requestedAt, 1);
    assert.deepEqual(l.history, [{ id: "a" }]);
    assert.equal(l.attempts.byKey["x.com"], 2);
});

test("config already in local wins over leftovers in sync", () => {
    const l = migrate({ bans: ["old.com"] }, { bans: ["new.com"] }, 0).localSet;
    assert.deepEqual(l.bans, ["new.com"]);
});

test("expired v1 timer is dropped", () => {
    assert.equal(migrate({ timerActive: true, timerEndTime: 10 }, {}, 20).localSet.timer, null);
});

test("already on v3 does nothing", () => {
    assert.equal(migrate({ bans: ["x.com"] }, { schemaVersion: SCHEMA_VERSION }, 0), null);
});

test("fresh install gets defaults", () => {
    const l = migrate({}, {}, 0).localSet;
    assert.deepEqual(l.bans, []);
    assert.equal(l.enabled, false);
    assert.deepEqual(l.stats.dailyMinutes, [0, 0, 0, 0, 0, 0, 0]);
});
