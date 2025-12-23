let enabled = false;
let timerActive = false;
let timerEndTime = 0;
let timerStartTime = 0;
let timerDurationMinutes = 0;
const CONTEXT_MENU_ID = "tab-sniper-block-domain";
const PRESET_ALARM_PREFIX = "tab-sniper-preset-";

// Load initial state
chrome.storage.sync.get(
    ["enabled", "timerActive", "timerEndTime", "timerStartTime", "timerDurationMinutes"], 
    (data) => {
    if (data.enabled !== undefined) enabled = data.enabled;
    if (data.timerActive !== undefined) timerActive = data.timerActive;
    if (data.timerEndTime !== undefined) timerEndTime = data.timerEndTime;
    if (data.timerStartTime !== undefined) timerStartTime = data.timerStartTime;
    if (data.timerDurationMinutes !== undefined) timerDurationMinutes = data.timerDurationMinutes;
    
    // Check if timer should still be active
    if (timerActive && Date.now() >= timerEndTime) {
        timerActive = false;
        enabled = false; // Also disable when timer expires
        chrome.storage.sync.set({ 
            timerActive: false,
            enabled: false 
        });
    }
    
    // Force immediate icon update
    updateIcon();
    
    // Double check icon after a short delay
    setTimeout(updateIcon, 100);
    
    console.log("Initial state loaded:", { enabled, timerActive, timerEndTime, timerStartTime, timerDurationMinutes });
});

chrome.runtime.onInstalled.addListener(() => {
    createContextMenu();
});

chrome.runtime.onStartup.addListener(() => {
    createContextMenu();
});

function updateIcon() {
    // Force immediate icon update
    if (enabled) {
        chrome.action.setIcon({path: "icon_mischiveous.png"});
        console.log("Setting mischievous icon - extension is enabled");
    } else {
        chrome.action.setIcon({path: "icon_sleep.png"});
        console.log("Setting sleep icon - extension is disabled");
    }
}

function beginTimer(minutes, sourceLabel = "focus") {
    const sanitizedMinutes = Math.max(1, parseInt(minutes, 10));
    timerStartTime = Date.now();
    timerEndTime = timerStartTime + (sanitizedMinutes * 60 * 1000);
    timerDurationMinutes = sanitizedMinutes;
    timerActive = true;
    enabled = true; // Always enable extension when timer starts

    chrome.storage.sync.set({
        timerActive: true,
        timerEndTime: timerEndTime,
        timerStartTime: timerStartTime,
        timerDurationMinutes: timerDurationMinutes,
        enabled: true
    });

    console.log(`Timer started from ${sourceLabel}:`, { timerActive, timerEndTime, enabled });
    updateIcon();

    // Important: Also check all current tabs when timer starts
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
        // Drop leading www for cleaner matching
        return hostname.replace(/^www\./i, "");
    } catch (e) {
        return null;
    }
}

function matchesBlockedUrl(targetUrl, blockedValue) {
    const targetDomain = extractDomain(targetUrl);
    if (!blockedValue) return false;

    // If the blocked value looks like a domain, do domain comparison
    const blockedDomain = extractDomain(blockedValue) || blockedValue;
    if (blockedDomain && !blockedValue.includes("/")) {
        if (!targetDomain) return false;
        return targetDomain === blockedDomain || targetDomain.endsWith(`.${blockedDomain}`);
    }

    // Fallback to substring match for non-domain entries
    return targetUrl.includes(blockedValue);
}

// Function to check if timer is expired
function checkTimerExpired() {
    if (timerActive && Date.now() >= timerEndTime) {
        timerActive = false;
        enabled = false; // Disable extension when timer ends
        chrome.storage.sync.set({ 
            timerActive: false,
            enabled: false 
        });
        console.log("Timer expired - disabling extension and allowing all sites");
        updateIcon();
        
        // Show notification when timer ends
        const durationMinutes = getSessionDurationMinutes();
        chrome.notifications.create('timer-end', {
            type: 'basic',
            iconUrl: 'icon_mischiveous.png',
            title: 'Focus Session complete! YAY! 🎉',
            message: `You completed your ${durationMinutes} ${durationMinutes === 1 ? 'minute' : 'minutes'} focus session! You can now access all sites.`,
            priority: 2
        });
        
        return true;
    }
    return false;
}

// IMPORTANT: Set up blocking on all navigation events
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    // Only process main frame navigations (not iframes)
    if (details.frameId !== 0) return;
    
    // Check if timer has expired
    if (checkTimerExpired()) {
        console.log("Timer expired - allowing navigation to:", details.url);
        return;
    }
    
    // Only block if either enabled OR timer is active
    if (enabled || timerActive) {
        chrome.storage.sync.get("blockedUrls", (data) => {
            const blockedUrls = data.blockedUrls || [];
            if (blockedUrls.some(url => matchesBlockedUrl(details.url, url))) {
                console.log("Blocking navigation to:", details.url);
                chrome.tabs.remove(details.tabId).catch(error => {
                    if (!error.message.includes("No tab with id")) {
                        console.error("Error removing tab:", error);
                    }
                });
            } else {
                console.log("Navigation allowed:", details.url);
            }
        });
    } else {
        console.log("Navigation allowed - extension not blocking:", details.url);
    }
});

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Skip if no URL change
    if (!changeInfo.url) return;
    
    // Check if timer has expired
    if (checkTimerExpired()) {
        console.log("Timer expired - allowing tab update to:", changeInfo.url);
        return;
    }
    
    // Only block if either enabled OR timer is active
    if (enabled || timerActive) {
        chrome.storage.sync.get("blockedUrls", (data) => {
            const blockedUrls = data.blockedUrls || [];
            if (blockedUrls.some(url => matchesBlockedUrl(changeInfo.url, url))) {
                console.log("Blocking tab update to:", changeInfo.url);
                chrome.tabs.remove(tabId).catch(error => {
                    if (!error.message.includes("No tab with id")) {
                        console.error("Error removing tab:", error);
                    }
                });
            } else {
                console.log("Tab update allowed:", changeInfo.url);
            }
        });
    } else {
        console.log("Tab update allowed - extension not blocking:", changeInfo.url);
    }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Message received:", request);

    // Handle toggle action
    if (request.action === "toggle") {
        if (!timerActive) {
            enabled = request.enabled;
            // Force immediate icon update
            updateIcon();
            // Then update storage
            chrome.storage.sync.set({ enabled: enabled }, () => {
                // Double check icon after storage update
                setTimeout(updateIcon, 100);
            });
            console.log("Toggle state changed:", enabled);
            
            // If enabled, check and close existing blocked tabs
            if (enabled) {
                checkAllOpenTabs();
            }
        }
        sendResponse({ enabled: enabled, timerActive: timerActive });
    }
    // Handle notification request
    else if (request.action === "showNotification") {
        chrome.notifications.create('timer-end', {
            type: 'basic',
            iconUrl: 'icon_mischiveous.png',
            title: request.title,
            message: request.message,
            priority: 2
        });
        sendResponse({ success: true });
    }
    // Handle URL updates
    else if (request.action === "updateUrls") {
        const rawUrls = request.urls || [];
        const normalized = Array.from(new Set(rawUrls.map((url) => {
            const domain = extractDomain(url);
            return domain || url;
        }).filter(Boolean)));
        chrome.storage.sync.set({ blockedUrls: normalized });
        console.log("URLs updated:", normalized);
        sendResponse({ success: true });
    }
    // Handle timer start
    else if (request.action === "startTimer") {
        const minutes = parseInt(request.minutes);
        
        if (isNaN(minutes) || minutes < 1) {
            sendResponse({ success: false, message: "Invalid time" });
            return true;
        }
        
        // Start new timer
        const endTime = beginTimer(minutes, "popup");
        
        // Show notification when timer starts
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon_mischiveous.png',
            title: 'Focus Session Started! 🎯',
            message: `Focus mode activated for ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}. You can do it!`,
            priority: 2
        });
        
        // Important: Also check all current tabs when timer starts
        sendResponse({ 
            success: true, 
            timerEndTime: endTime,
            timerActive: true,
            timerDurationMinutes: timerDurationMinutes
        });
    }
    // Handle timer check
    else if (request.action === "getTimerState") {
        // Update timer state if needed
        if (timerActive && Date.now() >= timerEndTime) {
            timerActive = false;
            enabled = false; // Disable extension when timer ends
            chrome.storage.sync.set({ 
                timerActive: false,
                enabled: false 
            });
            console.log("Timer expired - disabling extension and allowing all sites");
            updateIcon();
            
            // Show notification when timer ends
            const durationMinutes = getSessionDurationMinutes();
            chrome.notifications.create('timer-end', {
                type: 'basic',
                iconUrl: 'icon_mischiveous.png',
                title: 'Focus Session complete! YAY! 🎉',
                message: `You completed your ${durationMinutes} ${durationMinutes === 1 ? 'minute' : 'minutes'} focus session! You can now access all sites.`,
                priority: 2
            });
        }
        
        sendResponse({
            enabled: enabled,
            timerActive: timerActive,
            timerEndTime: timerEndTime,
            timerStartTime: timerStartTime,
            timerDurationMinutes: timerDurationMinutes,
            currentTime: Date.now()
        });
    }
    // Handle explicit timer expiration
    else if (request.action === "expireTimer") {
        timerActive = false;
        enabled = false; // Also disable the extension when game is won
        chrome.storage.sync.set({ 
            timerActive: false,
            enabled: false
        });
        console.log("Timer explicitly expired by request and extension disabled");
        updateIcon();
        sendResponse({
            success: true,
            timerActive: false,
            enabled: false
        });
    }
    // Handle debug request
    else if (request.action === "debug") {
        console.log("Debug info requested");
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
        return true; // Keep channel open for async
    } 
    
    else if (request.action === "reduceTimer") {
        if (!timerActive) {
            sendResponse({ success: false, message: "No active timer" });
            return true;
        }
         
        const minutesToReduce = parseInt(request.minutes) || 1;
        
        // Calculate new end time (reduce by specified minutes)
        const reduction = minutesToReduce * 60 * 1000;
        const newEndTime = timerEndTime - reduction;
        
        // Don't allow reducing below current time
        const currentTime = Date.now();
        timerEndTime = Math.max(currentTime + 10000, newEndTime); // Keep at least 10 seconds
        
        // Save state
        const updatedDurationMinutes = timerStartTime 
            ? Math.max(1, Math.round((timerEndTime - timerStartTime) / 60000))
            : Math.max(1, Math.round((timerEndTime - currentTime) / 60000));
        timerDurationMinutes = updatedDurationMinutes;
        chrome.storage.sync.set({
            timerEndTime: timerEndTime,
            timerDurationMinutes: timerDurationMinutes
        });
        
        console.log("Timer reduced:", { 
            minutesReduced: minutesToReduce,
            newEndTime: timerEndTime 
        });
        
        sendResponse({ 
            success: true, 
            timerEndTime: timerEndTime,
            timerDurationMinutes: timerDurationMinutes
        });
    }
    
    return true; // Keep channel open for async response
});

// Function to check all open tabs
function checkAllOpenTabs() {
    // Only check tabs if either enabled or timer is active
    if (!enabled && !timerActive) {
        console.log("Extension disabled and no timer - not checking tabs");
        return;
    }
    
    chrome.tabs.query({}, (tabs) => {
        chrome.storage.sync.get("blockedUrls", (data) => {
            const blockedUrls = data.blockedUrls || [];
            
            tabs.forEach(tab => {
                if (tab.url && blockedUrls.some(url => matchesBlockedUrl(tab.url, url))) {
                    console.log("Blocking existing tab:", tab.url);
                    chrome.tabs.remove(tab.id).catch(error => {
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
        const presetAlarms = alarms.filter(a => a.name && a.name.startsWith(PRESET_ALARM_PREFIX));
        presetAlarms.forEach(a => chrome.alarms.clear(a.name));

        chrome.storage.sync.get("presets", (data) => {
            const presets = data.presets || [];
            presets.forEach((preset) => {
                if (preset.scheduleTime) {
                    const when = computeNextAlarmTime(preset.scheduleTime);
                    if (when) {
                        chrome.alarms.create(`${PRESET_ALARM_PREFIX}${preset.id}`, {
                            when,
                            periodInMinutes: 24 * 60 // daily
                        });
                        console.log("Scheduled preset alarm", preset.name, preset.scheduleTime);
                    }
                }
            });
        });
    });
}

chrome.alarms.onAlarm.addListener((alarm) => {
    if (!alarm.name || !alarm.name.startsWith(PRESET_ALARM_PREFIX)) return;
    const presetId = alarm.name.replace(PRESET_ALARM_PREFIX, "");
    
    chrome.storage.sync.get("presets", (data) => {
        const presets = data.presets || [];
        const preset = presets.find(p => p.id === presetId);
        if (!preset || !preset.scheduleTime) return;

        if (timerActive) {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icon_mischiveous.png',
                title: 'Scheduled focus skipped',
                message: `Skipped "${preset.name}" because a focus session is already running.`,
                priority: 1
            });
            return;
        }

        const endTime = beginTimer(preset.minutes, "scheduled preset");
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon_mischiveous.png',
            title: `Scheduled focus started: ${preset.name}`,
            message: `Focus mode for ${preset.minutes} ${preset.minutes === 1 ? 'minute' : 'minutes'} is now active.`,
            priority: 2
        });
    });
});

// Listen for storage changes to keep state in sync
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
        console.log("Storage changes:", changes);
        
        if (changes.enabled !== undefined) {
            enabled = changes.enabled.newValue;
            console.log("Enabled state updated:", enabled);
            updateIcon();
            
            // If enabled, check and close existing blocked tabs
            if (enabled) {
                checkAllOpenTabs();
            }
        }
        if (changes.timerActive !== undefined) {
            timerActive = changes.timerActive.newValue;
            console.log("Timer active state updated:", timerActive);
            updateIcon();
            
            // If timer becomes active, check all open tabs
            if (timerActive) {
                checkAllOpenTabs();
            }
        }
        if (changes.timerEndTime !== undefined) {
            timerEndTime = changes.timerEndTime.newValue;
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
    }
});

// Ensure context menu and alarms are ready on service worker start
refreshPresetAlarms();

function createContextMenu() {
    chrome.contextMenus.removeAll(() => {
        if (chrome.runtime.lastError) {
            // Ignore errors from removeAll (e.g., no menus yet)
        }
        chrome.contextMenus.create({
            id: CONTEXT_MENU_ID,
            title: "Block this site in Tab Sniper",
            contexts: ["page", "browser_action", "action"]
        }, () => {
            if (chrome.runtime.lastError) {
                // Ignore duplicate creation errors
            }
        });
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

            // If blocking is active, close matching tabs immediately
            if (enabled || timerActive) {
                checkAllOpenTabs();
            }
        });
    });
});
