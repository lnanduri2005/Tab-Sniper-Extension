let enabled = false;
let timerActive = false;
let timerEndTime = 0;

// Load initial state
chrome.storage.sync.get(["enabled", "timerActive", "timerEndTime"], (data) => {
    if (data.enabled !== undefined) enabled = data.enabled;
    if (data.timerActive !== undefined) timerActive = data.timerActive;
    if (data.timerEndTime !== undefined) timerEndTime = data.timerEndTime;
    
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
    
    console.log("Initial state loaded:", { enabled, timerActive, timerEndTime });
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
        chrome.notifications.create('timer-end', {
            type: 'basic',
            iconUrl: 'icon_mischiveous.png',
            title: 'Focus Session complete! YAY! 🎉',
            message: 'Your focus session has ended. You can now access all sites.',
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
            if (blockedUrls.some(url => details.url.includes(url))) {
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
            if (blockedUrls.some(url => changeInfo.url.includes(url))) {
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
        chrome.storage.sync.set({ blockedUrls: request.urls });
        console.log("URLs updated:", request.urls);
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
        timerEndTime = Date.now() + (minutes * 60 * 1000);
        timerActive = true;
        enabled = true; // Always enable extension when timer starts
        
        // Save state
        chrome.storage.sync.set({
            timerActive: true,
            timerEndTime: timerEndTime,
            enabled: true
        });
        
        console.log("Timer started:", { timerActive, timerEndTime, enabled });
        updateIcon();
        
        // Show notification when timer starts
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon_mischiveous.png',
            title: 'Focus Session Started! 🎯',
            message: `Focus mode activated for ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}. You can do it!`,
            priority: 2
        });
        
        // Important: Also check all current tabs when timer starts
        checkAllOpenTabs();
        
        sendResponse({ 
            success: true, 
            timerEndTime: timerEndTime,
            timerActive: true
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
            chrome.notifications.create('timer-end', {
                type: 'basic',
                iconUrl: 'icon_mischiveous.png',
                title: 'Focus Session complete! YAY! 🎉',
                message: 'Your focus session has ended. You can now access all sites.',
                priority: 2
            });
        }
        
        sendResponse({
            enabled: enabled,
            timerActive: timerActive,
            timerEndTime: timerEndTime,
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
        chrome.storage.sync.set({
            timerEndTime: timerEndTime
        });
        
        console.log("Timer reduced:", { 
            minutesReduced: minutesToReduce,
            newEndTime: timerEndTime 
        });
        
        sendResponse({ 
            success: true, 
            timerEndTime: timerEndTime
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
                if (tab.url && blockedUrls.some(url => tab.url.includes(url))) {
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
    }
});