let enabled = false;
let timerActive = false;
let timerEndTime = 0;
let timerStartTime = 0;
let timerDurationMinutes = 0;
let currentSessionId = null;

const CONTEXT_MENU_ID = "tab-sniper-block-domain";
const PRESET_ALARM_PREFIX = "tab-sniper-preset-";
const SESSION_END_ALARM = "tab-sniper-session-end";
const WEEKLY_RESET_ALARM = "tab-sniper-weekly-reset";

// Load initial state
chrome.storage.sync.get(
    [
        "enabled",
        "timerActive",
        "timerEndTime",
        "timerStartTime",
        "timerDurationMinutes",
        "currentSessionId",
        "lastResetWeek"
    ],
    (data) => {
        if (data.enabled !== undefined) enabled = data.enabled;
        if (data.timerActive !== undefined) timerActive = data.timerActive;
        if (data.timerEndTime !== undefined) timerEndTime = data.timerEndTime;
        if (data.timerStartTime !== undefined) timerStartTime = data.timerStartTime;
        if (data.timerDurationMinutes !== undefined) timerDurationMinutes = data.timerDurationMinutes;
        if (data.currentSessionId !== undefined) currentSessionId = data.currentSessionId;

        maybeResetWeekly(data.lastResetWeek);

        if (timerActive && Date.now() >= timerEndTime) {
            endActiveSession({ completed: true, reason: "resume-expired", notify: false });
        } else if (timerActive) {
            scheduleSessionEndAlarm(timerEndTime);
        }

        updateIcon();
        setTimeout(updateIcon, 100);
        console.log("Initial state loaded:", {
            enabled,
            timerActive,
            timerEndTime,
            timerStartTime,
            timerDurationMinutes
        });
    }
);

chrome.runtime.onInstalled.addListener(() => {
    createContextMenu();
    refreshPresetAlarms();
    scheduleWeeklyResetCheck();
});

chrome.runtime.onStartup.addListener(() => {
    createContextMenu();
    refreshPresetAlarms();
    scheduleWeeklyResetCheck();
});

function updateIcon() {
    if (enabled) {
        chrome.action.setIcon({ path: "icon_mischiveous.png" });
    } else {
        chrome.action.setIcon({ path: "icon_sleep.png" });
    }
}

function ensureStatsShape(stats) {
    const base = Array.isArray(stats?.dailyMinutes) && stats.dailyMinutes.length === 7
        ? stats.dailyMinutes
        : [0, 0, 0, 0, 0, 0, 0];
    const blockedSites = stats?.blockedSites || {};
    return { dailyMinutes: base, blockedSites };
}

function getCurrentWeekKey(date = new Date()) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-${weekNo}`;
}

function maybeResetWeekly(lastKnownWeek) {
    const currentWeek = getCurrentWeekKey();
    if (lastKnownWeek === currentWeek) return;
    if (!lastKnownWeek) {
        chrome.storage.sync.set({ lastResetWeek: currentWeek });
        return;
    }

    chrome.storage.sync.get(["history", "stats", "currentSessionId"], () => {
        const clearedHistory = [];
        const clearedStats = ensureStatsShape({});
        currentSessionId = null;

        chrome.storage.sync.set({
            history: clearedHistory,
            stats: clearedStats,
            currentSessionId: null,
            lastResetWeek: currentWeek
        });
    });
}

function scheduleWeeklyResetCheck() {
    chrome.alarms.clear(WEEKLY_RESET_ALARM, () => {
        chrome.alarms.create(WEEKLY_RESET_ALARM, {
            periodInMinutes: 24 * 60,
            when: Date.now() + 1000
        });
    });
}

function scheduleSessionEndAlarm(endTime) {
    chrome.alarms.clear(SESSION_END_ALARM, () => {
        if (endTime) {
            chrome.alarms.create(SESSION_END_ALARM, { when: endTime });
        }
    });
}

function recordSessionStart(durationMinutes, sourceLabel) {
    const sessionId = `session-${Date.now()}`;
    chrome.storage.sync.get(["history", "blockedUrls"], (data) => {
        const history = data.history || [];
        const blockedSnapshot = data.blockedUrls || [];
        const session = {
            id: sessionId,
            date: new Date().toISOString(),
            duration: durationMinutes,
            completed: false,
            source: sourceLabel,
            blockedSnapshot
        };
        const updatedHistory = [session, ...history].slice(0, 1000);
        chrome.storage.sync.set({
            history: updatedHistory,
            currentSessionId: sessionId
        });
    });
    currentSessionId = sessionId;
    return sessionId;
}

function finalizeSessionRecord({ completed, reason, sessionMinutes }) {
    chrome.storage.sync.get(["history", "stats", "currentSessionId"], (data) => {
        const history = data.history || [];
        const stats = ensureStatsShape(data.stats || {});
        const sessionKey = data.currentSessionId || currentSessionId;
        const nowIso = new Date().toISOString();

        let index = sessionKey ? history.findIndex((h) => h.id === sessionKey) : -1;
        if (index === -1) {
            const fallbackId = sessionKey || `session-${Date.now()}`;
            history.unshift({
                id: fallbackId,
                date: nowIso,
                duration: sessionMinutes,
                completed: false,
                source: reason,
                blockedSnapshot: []
            });
            index = 0;
        }

        const session = history[index];
        session.completed = completed;
        session.completedAt = nowIso;
        session.reason = reason;
        session.duration = session.duration || sessionMinutes || 0;

        if (completed) {
            const dayIndex = new Date().getDay();
            stats.dailyMinutes[dayIndex] =
                (stats.dailyMinutes[dayIndex] || 0) + (session.duration || 0);
            (session.blockedSnapshot || []).forEach((site) => {
                stats.blockedSites[site] = (stats.blockedSites[site] || 0) + 1;
            });
        }

        chrome.storage.sync.set({
            history,
            stats,
            currentSessionId: null
        });
        currentSessionId = null;
    });
}

function endActiveSession({ completed, reason, notify }) {
    if (!timerActive) return false;

    const sessionMinutes = getSessionDurationMinutes();
    scheduleSessionEndAlarm(null);

    timerActive = false;
    enabled = false;
    timerEndTime = 0;
    timerStartTime = 0;
    timerDurationMinutes = 0;

    const resetState = {
        timerActive: false,
        enabled: false,
        timerEndTime: 0,
        timerStartTime: 0,
        timerDurationMinutes: 0
    };

    chrome.storage.sync.set(resetState);
    finalizeSessionRecord({ completed, reason, sessionMinutes });
    updateIcon();

    if (notify) {
        chrome.notifications.create("timer-end", {
            type: "basic",
            iconUrl: "icon_mischiveous.png",
            title: "Focus Session complete!",
            message: `You completed your ${sessionMinutes} ${sessionMinutes === 1 ? "minute" : "minutes"} focus session! You can now access all sites.`,
            priority: 2
        });
    }

    return true;
}

function beginTimer(minutes, sourceLabel = "focus") {
    const sanitizedMinutes = Math.max(1, parseInt(minutes, 10));
    timerStartTime = Date.now();
    timerEndTime = timerStartTime + (sanitizedMinutes * 60 * 1000);
    timerDurationMinutes = sanitizedMinutes;
    timerActive = true;
    enabled = true;
    const sessionId = recordSessionStart(timerDurationMinutes, sourceLabel);

    chrome.storage.sync.set({
        timerActive: true,
        timerEndTime: timerEndTime,
        timerStartTime: timerStartTime,
        timerDurationMinutes: timerDurationMinutes,
        enabled: true,
        currentSessionId: sessionId
    });

    scheduleSessionEndAlarm(timerEndTime);
    updateIcon();
    checkAllOpenTabs();
    return timerEndTime;
}

function getSessionDurationMinutes() {
    if (timerDurationMinutes) {
        return Math.max(1, Math.round(timerDurationMinutes));
    }
    if (timerEndTime && timerStartTime) {
        const minutes = Math.round((timerEndTime - timerStartTime) / 60000);
        return Math.max(1, minutes);
    }
    return 1;
}

function extractDomain(url) {
    try {
        const hostname = new URL(url).hostname;
        return hostname.replace(/^www\./i, "");
    } catch (e) {
        return null;
    }
}

function matchesBlockedUrl(targetUrl, blockedValue) {
    const targetDomain = extractDomain(targetUrl);
    if (!blockedValue) return false;

    const blockedDomain = extractDomain(blockedValue) || blockedValue;
    if (blockedDomain && !blockedValue.includes("/")) {
        if (!targetDomain) return false;
        return targetDomain === blockedDomain || targetDomain.endsWith(`.${blockedDomain}`);
    }

    return targetUrl.includes(blockedValue);
}

function checkTimerExpired() {
    if (timerActive && Date.now() >= timerEndTime) {
        return endActiveSession({ completed: true, reason: "timer-expired", notify: true });
    }
    return false;
}

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    if (details.frameId !== 0) return;
    if (checkTimerExpired()) return;

    if (enabled || timerActive) {
        chrome.storage.sync.get("blockedUrls", (data) => {
            const blockedUrls = data.blockedUrls || [];
            if (blockedUrls.some((url) => matchesBlockedUrl(details.url, url))) {
                chrome.tabs.remove(details.tabId).catch((error) => {
                    if (!error.message.includes("No tab with id")) {
                        console.error("Error removing tab:", error);
                    }
                });
            }
        });
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (!changeInfo.url) return;
    if (checkTimerExpired()) return;

    if (enabled || timerActive) {
        chrome.storage.sync.get("blockedUrls", (data) => {
            const blockedUrls = data.blockedUrls || [];
            if (blockedUrls.some((url) => matchesBlockedUrl(changeInfo.url, url))) {
                chrome.tabs.remove(tabId).catch((error) => {
                    if (!error.message.includes("No tab with id")) {
                        console.error("Error removing tab:", error);
                    }
                });
            }
        });
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggle") {
        if (!timerActive) {
            enabled = request.enabled;
            updateIcon();
            chrome.storage.sync.set({ enabled: enabled }, () => {
                setTimeout(updateIcon, 100);
            });
            if (enabled) {
                checkAllOpenTabs();
            }
        }
        sendResponse({ enabled: enabled, timerActive: timerActive });
    } else if (request.action === "showNotification") {
        chrome.notifications.create("timer-end", {
            type: "basic",
            iconUrl: "icon_mischiveous.png",
            title: request.title,
            message: request.message,
            priority: 2
        });
        sendResponse({ success: true });
    } else if (request.action === "updateUrls") {
        const rawUrls = request.urls || [];
        const normalized = Array.from(
            new Set(
                rawUrls
                    .map((url) => {
                        const domain = extractDomain(url);
                        return domain || url;
                    })
                    .filter(Boolean)
            )
        );
        chrome.storage.sync.set({ blockedUrls: normalized });
        sendResponse({ success: true });
    } else if (request.action === "startTimer") {
        const minutes = parseInt(request.minutes);
        const sourceLabel = request.source || "popup";

        if (isNaN(minutes) || minutes < 1) {
            sendResponse({ success: false, message: "Invalid time" });
            return true;
        }

        const endTime = beginTimer(minutes, sourceLabel);

        chrome.notifications.create({
            type: "basic",
            iconUrl: "icon_mischiveous.png",
            title: "Focus Session Started!",
            message: `Focus mode activated for ${minutes} ${minutes === 1 ? "minute" : "minutes"}. You can do it!`,
            priority: 2
        });

        sendResponse({
            success: true,
            timerEndTime: endTime,
            timerActive: true,
            timerDurationMinutes: timerDurationMinutes
        });
    } else if (request.action === "getTimerState") {
        if (timerActive && Date.now() >= timerEndTime) {
            endActiveSession({ completed: true, reason: "state-check-expired", notify: true });
        }

        sendResponse({
            enabled: enabled,
            timerActive: timerActive,
            timerEndTime: timerEndTime,
            timerStartTime: timerStartTime,
            timerDurationMinutes: timerDurationMinutes,
            currentTime: Date.now()
        });
    } else if (request.action === "expireTimer") {
        const success = endActiveSession({
            completed: request.completed !== false,
            reason: request.reason || "explicit-expire",
            notify: false
        });
        sendResponse({
            success,
            timerActive: timerActive,
            enabled: enabled
        });
    } else if (request.action === "debug") {
        chrome.storage.sync.get("blockedUrls", (data) => {
            sendResponse({
                enabled: enabled,
                timerActive: timerActive,
                timerEndTime: timerEndTime,
                currentTime: Date.now(),
                timerStartTime: timerStartTime,
                timerDurationMinutes: timerDurationMinutes,
                blockedUrls: data.blockedUrls || []
            });
        });
        return true;
    } else if (request.action === "reduceTimer") {
        if (!timerActive) {
            sendResponse({ success: false, message: "No active timer" });
            return true;
        }

        const minutesToReduce = parseInt(request.minutes) || 1;
        const reduction = minutesToReduce * 60 * 1000;
        const newEndTime = timerEndTime - reduction;
        const currentTime = Date.now();
        timerEndTime = Math.max(currentTime + 10000, newEndTime);

        const updatedDurationMinutes = timerStartTime
            ? Math.max(1, Math.round((timerEndTime - timerStartTime) / 60000))
            : Math.max(1, Math.round((timerEndTime - currentTime) / 60000));
        timerDurationMinutes = updatedDurationMinutes;

        chrome.storage.sync.set({
            timerEndTime: timerEndTime,
            timerDurationMinutes: timerDurationMinutes
        });
        scheduleSessionEndAlarm(timerEndTime);

        sendResponse({
            success: true,
            timerEndTime: timerEndTime,
            timerDurationMinutes: timerDurationMinutes
        });
    }

    return true;
});

function checkAllOpenTabs() {
    if (!enabled && !timerActive) return;

    chrome.tabs.query({}, (tabs) => {
        chrome.storage.sync.get("blockedUrls", (data) => {
            const blockedUrls = data.blockedUrls || [];
            tabs.forEach((tab) => {
                if (tab.url && blockedUrls.some((url) => matchesBlockedUrl(tab.url, url))) {
                    chrome.tabs.remove(tab.id).catch((error) => {
                        if (!error.message.includes("No tab with id")) {
                            console.error("Error removing tab:", error);
                        }
                    });
                }
            });
        });
    });
}

function computeNextAlarmTime(timeString) {
    if (!timeString || !/^\d{2}:\d{2}$/.test(timeString)) return null;
    const [hours, minutes] = timeString.split(":").map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);
    if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
    }
    return target.getTime();
}

function refreshPresetAlarms() {
    chrome.alarms.getAll((alarms) => {
        const presetAlarms = alarms.filter((a) => a.name && a.name.startsWith(PRESET_ALARM_PREFIX));
        presetAlarms.forEach((a) => chrome.alarms.clear(a.name));

        chrome.storage.sync.get("presets", (data) => {
            const presets = data.presets || [];
            presets.forEach((preset) => {
                if (preset.scheduleTime) {
                    const when = computeNextAlarmTime(preset.scheduleTime);
                    if (when) {
                        chrome.alarms.create(`${PRESET_ALARM_PREFIX}${preset.id}`, {
                            when,
                            periodInMinutes: 24 * 60
                        });
                    }
                }
            });
        });
    });
}

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === SESSION_END_ALARM) {
        endActiveSession({ completed: true, reason: "alarm-expired", notify: true });
        return;
    }
    if (alarm.name === WEEKLY_RESET_ALARM) {
        maybeResetWeekly();
        return;
    }
    if (!alarm.name || !alarm.name.startsWith(PRESET_ALARM_PREFIX)) return;
    const presetId = alarm.name.replace(PRESET_ALARM_PREFIX, "");

    chrome.storage.sync.get("presets", (data) => {
        const presets = data.presets || [];
        const preset = presets.find((p) => p.id === presetId);
        if (!preset || !preset.scheduleTime) return;

        if (timerActive) {
            chrome.notifications.create({
                type: "basic",
                iconUrl: "icon_mischiveous.png",
                title: "Scheduled focus skipped",
                message: `Skipped "${preset.name}" because a focus session is already running.`,
                priority: 1
            });
            return;
        }

        beginTimer(preset.minutes, `scheduled preset: ${preset.name}`);
        chrome.notifications.create({
            type: "basic",
            iconUrl: "icon_mischiveous.png",
            title: `Scheduled focus started: ${preset.name}`,
            message: `Focus mode for ${preset.minutes} ${preset.minutes === 1 ? "minute" : "minutes"} is now active.`,
            priority: 2
        });
    });
});

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace !== "sync") return;

    if (changes.enabled !== undefined) {
        enabled = changes.enabled.newValue;
        updateIcon();
        if (enabled) {
            checkAllOpenTabs();
        }
    }
    if (changes.timerActive !== undefined) {
        timerActive = changes.timerActive.newValue;
        updateIcon();
        if (timerActive) {
            scheduleSessionEndAlarm(timerEndTime);
            checkAllOpenTabs();
        } else {
            scheduleSessionEndAlarm(null);
        }
    }
    if (changes.timerEndTime !== undefined) {
        timerEndTime = changes.timerEndTime.newValue;
        if (timerActive) {
            scheduleSessionEndAlarm(timerEndTime);
        }
    }
    if (changes.timerStartTime !== undefined) {
        timerStartTime = changes.timerStartTime.newValue;
    }
    if (changes.timerDurationMinutes !== undefined) {
        timerDurationMinutes = changes.timerDurationMinutes.newValue;
    }
    if (changes.presets !== undefined) {
        refreshPresetAlarms();
    }
});

refreshPresetAlarms();
scheduleWeeklyResetCheck();

function createContextMenu() {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create(
            {
                id: CONTEXT_MENU_ID,
                title: "Block this site in Tab Sniper",
                contexts: ["page", "browser_action", "action"]
            },
            () => {}
        );
    });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== CONTEXT_MENU_ID) return;
    if (!tab || !tab.url) return;

    const domain = extractDomain(tab.url);
    if (!domain) return;

    chrome.storage.sync.get("blockedUrls", (data) => {
        const blockedUrls = data.blockedUrls || [];
        if (blockedUrls.includes(domain)) {
            chrome.notifications.create({
                type: "basic",
                iconUrl: "icon_mischiveous.png",
                title: "Already blocked",
                message: `${domain} is already in your blocked list.`
            });
            return;
        }

        const updated = [...blockedUrls, domain];
        chrome.storage.sync.set({ blockedUrls: updated }, () => {
            chrome.notifications.create({
                type: "basic",
                iconUrl: "icon_mischiveous.png",
                title: "Site blocked",
                message: `${domain} added to Tab Sniper block list.`
            });

            if (enabled || timerActive) {
                checkAllOpenTabs();
            }
        });
    });
});
