document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const toggleSwitch = document.getElementById("toggleSwitch");
    const statusText = document.getElementById("statusText");
    const urlList = document.getElementById("urlList");
    const urlInput = document.getElementById("urlInput");
    const addUrlBtn = document.getElementById("addUrl");
    const timerDisplay = document.getElementById("timer-display");
    const timerMinutes = document.getElementById("timer-minutes");
    const startTimerBtn = document.getElementById("start-timer-btn");
    const timerMessage = document.getElementById("timer-message");
    const showUrlsBtn = document.getElementById("show-urls-btn");
    const urlListContainer = document.getElementById("url-list-container");
    const disableConfirm = document.getElementById("disableConfirm");
    const confirmDisableBtn = document.getElementById("confirmDisableBtn");
    
    // Timer variables
    let countdownInterval = null;
    let timerActive = false;
    let timerEndTime = 0;
    
    // URL visibility variables
    let urlHideTimeout = null;
    let urlCountdownInterval = null;
    let secondsRemaining = 15;
    let countdownElement = null;
    
    // Initialize the popup
    initializePopup();
    
    // Add event listeners
    timerMinutes.addEventListener("input", updateTimerPreview);
    addUrlBtn.addEventListener("click", addUrlToBlockList);
    urlInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") addUrlToBlockList();
    });
    showUrlsBtn.addEventListener("click", toggleUrlVisibility);

    // Add event listener for the toggle switch
    toggleSwitch.addEventListener("change", () => {
        if (timerActive) {
            // If timer is active, prevent toggle
            toggleSwitch.checked = true;
            return;
        }

        // Force immediate icon update
        updateIcon(toggleSwitch.checked);
        statusText.textContent = toggleSwitch.checked ? "Enabled" : "Disabled";

        // Then send message to background
        chrome.runtime.sendMessage({ 
            action: "toggle", 
            enabled: toggleSwitch.checked 
        }, (response) => {
            if (!response) return;
            
            // Force update the enabled state in storage
            chrome.storage.sync.set({ enabled: response.enabled }, () => {
                // Double check icon after storage update
                setTimeout(() => updateIcon(response.enabled), 100);
                
                // Immediately update URL list to reflect new state
                chrome.storage.sync.get("blockedUrls", (data) => {
                    updateUrlList(data.blockedUrls || []);
                });
            });
            
            // Update UI based on new state
            if (!response.enabled) {
                setUrlVisibilityMode(false);
                updateLogoPosition(false);
            }
        });
    });

    startTimerBtn.addEventListener("click", () => {
        const minutes = parseInt(timerMinutes.value);
    
        if (isNaN(minutes) || minutes < 1) {
            timerMessage.textContent = "Please enter a valid time";
            return;
        }
    
        chrome.runtime.sendMessage({ 
            action: "startTimer", 
            minutes: minutes 
        }, (response) => {
            if (!response || !response.success) {
                timerMessage.textContent = "Failed to start timer";
                return;
            }
    
            // Timer started successfully
            timerActive = true;
            timerEndTime = response.timerEndTime;
    
            // Force extension to Enabled because focus mode started
            chrome.storage.sync.set({ enabled: true });
    
            // Update UI
            startTimerCountdown(timerEndTime);
            setTimerControlsState(false);
            toggleSwitch.checked = true;
            statusText.textContent = "Enabled";
            updateLogoPosition(true);
    
            // Hide URL list and show button in focus mode
            setUrlVisibilityMode(true);
    
            chrome.storage.sync.get("blockedUrls", (data) => {
                updateUrlList(data.blockedUrls || []);
            });
    
            timerMessage.textContent = "Focus mode activated!";
            setTimeout(() => { timerMessage.textContent = ""; }, 2000);
        });
    });
    
    // Handle "okay close fr" button click if it exists
    if (confirmDisableBtn) {
        confirmDisableBtn.addEventListener("click", () => {
            chrome.runtime.sendMessage({ 
                action: "toggle", 
                enabled: false
            }, (response) => {
                if (!response) return;
        
                // Actually disable now
                toggleSwitch.checked = false;
                statusText.textContent = response.enabled ? "Enabled" : "Disabled";
        
                // Hide the confirmation div
                if (disableConfirm) {
                    disableConfirm.classList.add("hidden");
                    disableConfirm.classList.remove("visible");
                }
        
                // Disable the "okay close fr" button
                confirmDisableBtn.disabled = true;
                confirmDisableBtn.style.opacity = "0.5";
                confirmDisableBtn.style.cursor = "not-allowed";
        
                // Stop the timer completely
                if (countdownInterval) {
                    clearInterval(countdownInterval);
                    countdownInterval = null;
                }
                timerActive = false;
        
                // Reset timer display to normal input
                resetTimerDisplay();
                setTimerControlsState(true);
        
                // Force unlock tabs (unblock sites) by resetting "blockedUrls" if needed
                chrome.storage.sync.set({ enabled: false });
        
                // Make sure URL list and remove buttons are back to normal
                setUrlVisibilityMode(false);
                chrome.storage.sync.get("blockedUrls", (data) => {
                    updateUrlList(data.blockedUrls || []);
                });
        
                // Clear focus mode message
                timerMessage.textContent = "Focus mode canceled.";
                setTimeout(() => { timerMessage.textContent = ""; }, 3000);
            });
        });
    }

    // Initialization logic
    function initializePopup() {
        // Get both enabled state and timer state
        chrome.runtime.sendMessage({ action: "getTimerState" }, (response) => {
            if (!response) return;
            
            // Update timer state
            timerActive = response.timerActive;
            timerEndTime = response.timerEndTime;
            
            // Update switch state based on enabled state
            toggleSwitch.checked = response.enabled;
            statusText.textContent = response.enabled ? "Enabled" : "Disabled";
            
            // Double check enabled state from storage
            chrome.storage.sync.get("enabled", (data) => {
                const isEnabled = data.enabled;
                updateIcon(isEnabled);
                
                // Update UI based on timer state
                if (timerActive && response.timerEndTime > response.currentTime) {
                    startTimerCountdown(response.timerEndTime);
                    setTimerControlsState(false);
                    setUrlVisibilityMode(true);
                    updateLogoPosition(true);
                } else {
                    resetTimerDisplay();
                    setTimerControlsState(true);
                    setUrlVisibilityMode(false);
                    updateLogoPosition(false);
                }
                
                // Update URL list
                chrome.storage.sync.get("blockedUrls", (data) => {
                    updateUrlList(data.blockedUrls || []);
                });
            });
        });
    
        urlListContainer.addEventListener("mousedown", resetUrlTimeout);
        urlListContainer.addEventListener("mousemove", resetUrlTimeout);
        urlListContainer.addEventListener("keydown", resetUrlTimeout);
    }

    function updateLogoPosition(timerActive) {
        const logoContainer = document.getElementById('logo-container');
        const appLogo = document.getElementById('app-logo');
        
        // Get current enabled state
        chrome.storage.sync.get("enabled", (data) => {
            const isEnabled = data.enabled;
            
            if (timerActive) {
                // Only move to corner during timer mode
                logoContainer.classList.remove('centered-logo');
                logoContainer.classList.add('corner-logo');
                appLogo.src = 'icon_mischiveous.png';
            } else {
                // Always center the logo
                logoContainer.classList.remove('corner-logo');
                logoContainer.classList.add('centered-logo');
                // Show mischievous if enabled, sleep if disabled
                appLogo.src = isEnabled ? 'icon_mischiveous.png' : 'icon_sleep.png';
            }
        });
    }
    
    function checkTimerState() {
        chrome.runtime.sendMessage({ action: "getTimerState" }, (response) => {
            if (!response) return;
            timerActive = response.timerActive;
            timerEndTime = response.timerEndTime;
    
            if (timerActive && response.timerEndTime > response.currentTime) {
                startTimerCountdown(response.timerEndTime);
                setTimerControlsState(false);
                toggleSwitch.checked = true;
                statusText.textContent = "Enabled";
                updateIcon(true);
                setUrlVisibilityMode(true);
                updateLogoPosition(true);
            } else {
                // Timer is not active or has expired
                resetTimerDisplay();
                setTimerControlsState(true);
                toggleSwitch.checked = false; // Ensure switch is off
                statusText.textContent = "Disabled";
                updateIcon(false);
                setUrlVisibilityMode(false);
                updateLogoPosition(false);
                
                // Update storage to reflect disabled state
                chrome.storage.sync.set({ enabled: false });
            }
        });
    }
    
    function updateTimerPreview() {
        const minutes = parseInt(timerMinutes.value) || 0;
        const displayMinutes = String(minutes).padStart(2, '0');
        timerDisplay.textContent = `${displayMinutes}:00`;
    }

    function startTimerCountdown(endTime) {
        if (countdownInterval) clearInterval(countdownInterval);

        updateCountdown(endTime);

        countdownInterval = setInterval(() => {
            const stillActive = updateCountdown(endTime);
            if (!stillActive) {
                clearInterval(countdownInterval);
                countdownInterval = null;
                timerActive = false;

                resetTimerDisplay();
                setTimerControlsState(true);
                setUrlVisibilityMode(false);

                timerMessage.textContent = "Focus session complete!";
                setTimeout(() => { timerMessage.textContent = ""; }, 3000);

                chrome.storage.sync.get("blockedUrls", (data) => {
                    updateUrlList(data.blockedUrls || []);
                });
            }
        }, 1000);
    }

    function updateCountdown(endTime) {
        const now = Date.now();
        const timeLeft = endTime - now;
        
        if (timeLeft <= 0) {
            // Timer has ended
            timerDisplay.textContent = "00:00";
            timerActive = false;
            
            // Get the original timer duration from the input field
            const originalMinutes = parseInt(timerMinutes.value) || 1;
            
            // Disable the switch and update UI
            toggleSwitch.checked = false;
            statusText.textContent = "Disabled";
            setTimerControlsState(true);
            setUrlVisibilityMode(false);
            updateLogoPosition(false);
            
            // Clear any remaining intervals
            if (countdownInterval) {
                clearInterval(countdownInterval);
                countdownInterval = null;
            }
            
            // Update storage to reflect disabled state
            chrome.storage.sync.set({ enabled: false }, () => {
                // Show notification when timer ends
                chrome.runtime.sendMessage({ 
                    action: "showNotification",
                    title: "Focus Session complete! YAY! 🎉",
                    message: `You completed your ${originalMinutes} ${originalMinutes === 1 ? 'minute' : 'minutes'} focus session! You can now access all sites.`
                });
            });
            
            return false;
        }
        
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        const displayMinutes = String(minutes).padStart(2, '0');
        const displaySeconds = String(seconds).padStart(2, '0');
        timerDisplay.textContent = `${displayMinutes}:${displaySeconds}`;
        
        return true;
    }

    function resetTimerDisplay() {
        updateTimerPreview();
    }

    function setTimerControlsState(enabled) {
        timerMinutes.disabled = !enabled;
        startTimerBtn.disabled = !enabled;
        
        // Update logo position based on timer state
        updateLogoPosition(!enabled);
    
        // Update switch state based on timer
        toggleSwitch.disabled = timerActive; // Disable switch when timer is active
        if (timerActive) {
            toggleSwitch.checked = true; // Force ON when timer is active
            toggleSwitch.style.opacity = "1";
            toggleSwitch.style.cursor = "not-allowed";
            timerMessage.textContent = "Focus mode active";
        } else {
            // When timer is not active, use the stored enabled state
            chrome.storage.sync.get("enabled", (data) => {
                toggleSwitch.checked = data.enabled;
                statusText.textContent = data.enabled ? "Enabled" : "Disabled";
            });
            toggleSwitch.style.opacity = "1";
            toggleSwitch.style.cursor = "pointer";
            timerMessage.textContent = "";
        }
    }

    function setUrlVisibilityMode(focusModeActive) {
        if (focusModeActive) {
            showUrlsBtn.style.display = "block";
            urlListContainer.classList.add("hidden");
            urlListContainer.classList.remove("visible");
            removeCountdownElement();
        } else {
            showUrlsBtn.style.display = "none";
            urlListContainer.classList.remove("hidden");
            urlListContainer.classList.add("visible");
            clearUrlTimeout();
            removeCountdownElement();
        }
    }

    function toggleUrlVisibility() {
        if (!timerActive) return;

        urlListContainer.classList.remove("hidden");
        urlListContainer.classList.add("visible");
        showUrlsBtn.style.display = "none";

        if (!countdownElement) {
            countdownElement = document.createElement("div");
            countdownElement.className = "countdown";
            countdownElement.style.display = "none";
            urlListContainer.appendChild(countdownElement);
        }
        resetUrlTimeout();
    }

    function resetUrlTimeout() {
        if (!timerActive) return;
        secondsRemaining = 15;
        if (countdownElement) {
            countdownElement.textContent = `URLs will hide in ${secondsRemaining} seconds`;
            countdownElement.style.display = "none";
        }
        clearUrlTimeout();

        urlHideTimeout = setTimeout(hideUrlList, secondsRemaining * 1000);
        urlCountdownInterval = setInterval(() => {
            secondsRemaining--;
            if (countdownElement) {
                countdownElement.textContent = `URLs will hide in ${secondsRemaining} seconds`;
                countdownElement.style.display = "none";
            }
            if (secondsRemaining <= 0) {
                clearInterval(urlCountdownInterval);
                urlCountdownInterval = null;
            }
        }, 1000);
    }

    function clearUrlTimeout() {
        if (urlHideTimeout) {
            clearTimeout(urlHideTimeout);
            urlHideTimeout = null;
        }
        if (urlCountdownInterval) {
            clearInterval(urlCountdownInterval);
            urlCountdownInterval = null;
        }
    }

    function hideUrlList() {
        if (!timerActive) return;
        urlListContainer.classList.add("hidden");
        urlListContainer.classList.remove("visible");
        showUrlsBtn.style.display = "block";
        clearUrlTimeout();
    }

    function removeCountdownElement() {
        if (countdownElement && countdownElement.parentNode) {
            countdownElement.parentNode.removeChild(countdownElement);
            countdownElement = null;
        }
    }

    function addUrlToBlockList() {
        const url = urlInput.value.trim();
        if (!url) return;

        chrome.storage.sync.get("blockedUrls", (data) => {
            const urls = data.blockedUrls || [];
            if (!urls.includes(url)) {
                urls.push(url);
                chrome.runtime.sendMessage({ action: "updateUrls", urls: urls });
                updateUrlList(urls);
                urlInput.value = "";
            }
        });

        if (timerActive) {
            resetUrlTimeout();
        }
    }

    function updateUrlList(urls) {
        urlList.innerHTML = "";
    
        if (urls.length === 0) {
            const emptyMsg = document.createElement("li");
            emptyMsg.textContent = "No blocked URLs";
            emptyMsg.style.justifyContent = "center";
            emptyMsg.style.color = "#888";
            urlList.appendChild(emptyMsg);
            return;
        }
    
        // Get the current enabled state
        chrome.storage.sync.get("enabled", (data) => {
            const isEnabled = data.enabled;
    
            urls.forEach(url => {
                const li = document.createElement("li");
                const urlText = document.createElement("span");
                urlText.textContent = url;
                li.appendChild(urlText);
    
                const removeBtn = document.createElement("button");
                removeBtn.textContent = "❌";
                removeBtn.classList.add("remove-btn");
    
                if (timerActive || isEnabled) {
                    // During timer or when enabled, show disabled remove button
                    removeBtn.style.opacity = "0.5";
                    removeBtn.style.cursor = "not-allowed";
                    removeBtn.title = "Cannot remove while extension is active";
                    removeBtn.disabled = true;
                } else {
                    // When disabled, allow URL deletion
                    removeBtn.style.opacity = "1";
                    removeBtn.style.cursor = "pointer";
                    removeBtn.title = "Remove URL";
                    removeBtn.addEventListener("click", () => {
                        const newUrls = urls.filter(u => u !== url);
                        chrome.runtime.sendMessage({ action: "updateUrls", urls: newUrls });
                        updateUrlList(newUrls);
                    });
                }
    
                li.appendChild(removeBtn);
                urlList.appendChild(li);
            });
        });
    }

    function updateIcon(enabled) {
        const appLogo = document.getElementById('app-logo');
        // Force immediate icon update
        if (enabled) {
            appLogo.src = 'icon_mischiveous.png';
            console.log("Popup: Setting mischievous icon - extension is enabled");
        } else {
            appLogo.src = 'icon_sleep.png';
            console.log("Popup: Setting sleep icon - extension is disabled");
        }
    }
});