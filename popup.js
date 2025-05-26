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
    const gameContainer = document.getElementById("game-container");
    
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

    
    // Handle toggle switch
    toggleSwitch.addEventListener("change", () => {
        // Reset "okay close fr" button in case it was disabled before
        if (confirmDisableBtn) {
            confirmDisableBtn.disabled = false;
            confirmDisableBtn.style.opacity = "1";
            confirmDisableBtn.style.cursor = "pointer";
        }

        if (!toggleSwitch.checked) {
            // User is trying to disable - show confirmation div
            toggleSwitch.checked = true; // revert temporarily
            if (disableConfirm) {
                disableConfirm.classList.remove("hidden");
                disableConfirm.classList.add("visible");
            }
        } else {
            // User is enabling
            chrome.runtime.sendMessage({ 
                action: "toggle", 
                enabled: true
            }, (response) => {
                if (!response) return;
                statusText.textContent = response.enabled ? "Enabled" : "Disabled";
            });
        }
    });

    showUrlsBtn.addEventListener("click", toggleUrlVisibility);
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

            // NEW: Don't auto-init game - wait until user tries to remove URL
            if (window.gameController && window.gameController.stopGame) {
                window.gameController.stopGame();
            }
    
            // Update UI
            startTimerCountdown(timerEndTime);
            setTimerControlsState(false);
            toggleSwitch.checked = true;
            statusText.textContent = "Enabled";
    
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
        chrome.storage.sync.get(["enabled", "blockedUrls"], (data) => {
            toggleSwitch.checked = data.enabled === true;  
            statusText.textContent = toggleSwitch.checked ? "Enabled" : "Disabled";
            updateUrlList(data.blockedUrls || []);
        });
    
        checkTimerState();
        urlListContainer.addEventListener("mousedown", resetUrlTimeout);
        urlListContainer.addEventListener("mousemove", resetUrlTimeout);
        urlListContainer.addEventListener("keydown", resetUrlTimeout);
    }

    function updateLogoPosition(timerActive) {
        const logoContainer = document.getElementById('logo-container');
        if (timerActive) {
            logoContainer.classList.remove('centered-logo');
            logoContainer.classList.add('corner-logo');
        } else {
            logoContainer.classList.remove('corner-logo');
            logoContainer.classList.add('centered-logo');
        }
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
                setUrlVisibilityMode(true);
                updateLogoPosition(true);
            } else {
                resetTimerDisplay();
                setTimerControlsState(true);
                setUrlVisibilityMode(false);
                updateLogoPosition(false);
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
            timerDisplay.textContent = "00:00";

            if (window.gameController && window.gameController.stopGame) {
                window.gameController.stopGame();
            }

            window.dispatchEvent(new CustomEvent('focus-mode-changed', { 
                detail: { active: false } 
            }));

            return false;
        }

        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);

        timerDisplay.textContent = 
            `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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
    
        if (!enabled) {
            timerMessage.textContent = "Focus mode active - can't disable";
        } else {
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
            urlListContainer.appendChild(countdownElement);
        }
        resetUrlTimeout();
    }

    function resetUrlTimeout() {
        if (!timerActive) return;
        secondsRemaining = 15;
        if (countdownElement) {
            countdownElement.textContent = `URLs will hide in ${secondsRemaining} seconds`;
        }
        clearUrlTimeout();

        urlHideTimeout = setTimeout(hideUrlList, secondsRemaining * 1000);
        urlCountdownInterval = setInterval(() => {
            secondsRemaining--;
            if (countdownElement) {
                countdownElement.textContent = `URLs will hide in ${secondsRemaining} seconds`;
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
    
        urls.forEach(url => {
            const li = document.createElement("li");
            const urlText = document.createElement("span");
            urlText.textContent = url;
            li.appendChild(urlText);
    
            const removeBtn = document.createElement("button");
            removeBtn.textContent = "❌";
            removeBtn.classList.add("remove-btn");
            removeBtn.title = "Remove";
    
            if (timerActive) {
                // NEW: During active timer, don't disable button but make it trigger game instead
                removeBtn.style.opacity = "1"; // Make it fully visible
                removeBtn.title = "Challenge the timer!";
                
                // Add click event that ONLY triggers the game instead of removing URL
                removeBtn.addEventListener("click", (event) => {
                    event.stopPropagation();
                    if (window.gameController && window.gameController.initGame) {
                        window.gameController.initGame();
                        // Scroll to the game container
                        if (gameContainer) {
                            gameContainer.scrollIntoView({ behavior: 'smooth' });
                        }
                        
                        // Show explanation message
                        timerMessage.textContent = "Score a point to end focus mode!";
                        setTimeout(() => { timerMessage.textContent = ""; }, 3000);
                    }
                });
            } else {
                // Normal behavior when timer is not active
                removeBtn.addEventListener("click", () => {
                    const newUrls = urls.filter(u => u !== url);
                    chrome.runtime.sendMessage({ action: "updateUrls", urls: newUrls });
                    updateUrlList(newUrls);
                });
            }
    
            li.appendChild(removeBtn);
            urlList.appendChild(li);
        });
    }
    
});