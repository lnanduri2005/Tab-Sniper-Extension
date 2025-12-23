document.addEventListener("DOMContentLoaded", () => {
    // State
    let enabled = false;
    let timerActive = false;
    let timerEndTime = 0;
    let focusDurationMinutes = 0;
    let countdownInterval = null;
    let presets = [];
    let history = [];
    let stats = {
        dailyMinutes: [0, 0, 0, 0, 0, 0, 0],
        blockedSites: {}
    };
    let blockedUrls = [];

    // DOM Elements
    const toggleSwitch = document.getElementById("toggle-switch");
    const statusText = document.getElementById("status-text");
    const timerDisplay = document.getElementById("timer-display");
    const timerMinutes = document.getElementById("timer-minutes");
    const startTimerBtn = document.getElementById("start-timer-btn");
    const saveFocusBtn = document.getElementById("save-focus-btn");
    const timerMessage = document.getElementById("timer-message");
    const urlInput = document.getElementById("url-input");
    const addUrlBtn = document.getElementById("add-url-btn");
    const urlList = document.getElementById("url-list");
    const urlInputFocus = document.getElementById("url-input-focus");
    const addUrlBtnFocus = document.getElementById("add-url-btn-focus");
    const urlListFocus = document.getElementById("url-list-focus");
    const presetList = document.getElementById("preset-list");
    const appLogo = document.getElementById("app-logo");
    const weeklyChart = document.getElementById("weekly-chart");
    const blockedStats = document.getElementById("blocked-stats");
    const historyList = document.getElementById("history-list");

    // Tab Navigation
    document.querySelectorAll(".tab").forEach(tab => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

            tab.classList.add("active");
            document.getElementById(`${tab.dataset.tab}-tab`).classList.add("active");

            if (tab.dataset.tab === "stats") {
                renderStats();
            }
        });
    });

    // Initialize
    init();

    function init() {
        loadFromStorage();

        toggleSwitch.addEventListener("change", handleToggle);
        startTimerBtn.addEventListener("click", () => startFocusSession());
        saveFocusBtn.addEventListener("click", saveCurrentAsPreset);
        addUrlBtn.addEventListener("click", addBlockedSite);
        addUrlBtnFocus.addEventListener("click", addBlockedSiteFocus);
        urlInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") addBlockedSite();
        });
        urlInputFocus.addEventListener("keypress", (e) => {
            if (e.key === "Enter") addBlockedSiteFocus();
        });
        timerMinutes.addEventListener("input", updateTimerPreview);

        updateTimerPreview();
    }

    function loadFromStorage() {
        chrome.runtime.sendMessage({ action: "getTimerState" }, (response) => {
            if (!response) return;

            enabled = response.enabled;
            timerActive = response.timerActive;
            timerEndTime = response.timerEndTime;
            focusDurationMinutes = response.timerDurationMinutes || 0;

            toggleSwitch.checked = enabled;
            statusText.textContent = enabled ? "ON" : "OFF";
            updateIcon(enabled);

            if (timerActive && response.timerEndTime > response.currentTime) {
                startTimerCountdown(response.timerEndTime);
            } else {
                timerActive = false;
                updateTimerPreview();
            }
        });

        chrome.storage.sync.get(["blockedUrls", "presets", "history", "stats"], (data) => {
            blockedUrls = data.blockedUrls || [];
            presets = data.presets || [];
            history = data.history || [];
            stats = data.stats || { dailyMinutes: [0, 0, 0, 0, 0, 0, 0], blockedSites: {} };

            // Ensure stats shape is intact
            if (!Array.isArray(stats.dailyMinutes) || stats.dailyMinutes.length !== 7) {
                stats.dailyMinutes = [0, 0, 0, 0, 0, 0, 0];
            }
            if (!stats.blockedSites) stats.blockedSites = {};

            renderUrlList(blockedUrls);
            renderUrlListFocus(blockedUrls);
            renderPresets();
            renderHistory();
        });
    }

    function handleToggle() {
        if (timerActive) {
            toggleSwitch.checked = true;
            return;
        }

        enabled = toggleSwitch.checked;
        statusText.textContent = enabled ? "ON" : "OFF";
        updateIcon(enabled);

        chrome.runtime.sendMessage({
            action: "toggle",
            enabled: enabled
        });
    }

    function startFocusSession(presetMinutes = null) {
        const minutes = presetMinutes || parseInt(timerMinutes.value);
        if (isNaN(minutes) || minutes < 1) {
            timerMessage.textContent = "Enter valid time";
            return;
        }

        chrome.runtime.sendMessage({
            action: "startTimer",
            minutes: minutes
        }, (response) => {
            if (!response || !response.success) {
                timerMessage.textContent = "Failed to start";
                return;
            }

            timerActive = true;
            timerEndTime = response.timerEndTime;
            focusDurationMinutes = response.timerDurationMinutes || minutes;
            enabled = true;

            toggleSwitch.checked = true;
            statusText.textContent = "ON";
            updateIcon(true);

            startTimerCountdown(timerEndTime);

            const session = {
                date: new Date().toISOString(),
                duration: minutes,
                completed: false,
                blockedSnapshot: [...blockedUrls]
            };
            history.unshift(session);
            chrome.storage.sync.set({ history });

            timerMessage.textContent = "Focus mode activated!";
            setTimeout(() => { timerMessage.textContent = ""; }, 2000);
        });
    }

    function startTimerCountdown(endTime) {
        if (countdownInterval) clearInterval(countdownInterval);

        updateCountdown(endTime);

        countdownInterval = setInterval(() => {
            const stillActive = updateCountdown(endTime);
            if (!stillActive) {
                clearInterval(countdownInterval);
                countdownInterval = null;
                onTimerComplete();
            }
        }, 1000);
    }

    function updateCountdown(endTime) {
        const now = Date.now();
        const timeLeft = endTime - now;

        if (timeLeft <= 0) {
            timerDisplay.textContent = "00:00";
            return false;
        }

        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        timerDisplay.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

        return true;
    }

    function onTimerComplete() {
        timerActive = false;
        enabled = false;

        toggleSwitch.checked = false;
        statusText.textContent = "OFF";
        updateIcon(false);

        // Mark latest history item complete
        if (history[0] && !history[0].completed) {
            history[0].completed = true;
            history[0].blockedSnapshot = history[0].blockedSnapshot || [...blockedUrls];

            const dayIndex = new Date().getDay();
            stats.dailyMinutes[dayIndex] = (stats.dailyMinutes[dayIndex] || 0) + focusDurationMinutes;

            const sites = history[0].blockedSnapshot || [];
            sites.forEach(site => {
                stats.blockedSites[site] = (stats.blockedSites[site] || 0) + 1;
            });

            chrome.storage.sync.set({ history, stats, enabled: false });
        } else {
            chrome.storage.sync.set({ enabled: false });
        }

        // Fire a completion notification via the background service worker
        const completedMinutes = focusDurationMinutes || parseInt(timerMinutes.value) || 1;
        chrome.runtime.sendMessage({
            action: "showNotification",
            title: "Focus Session complete!",
            message: `You completed your ${completedMinutes} minute${completedMinutes === 1 ? "" : "s"} focus session!`
        });

        updateTimerPreview();
        renderHistory();
        renderStats();

        timerMessage.textContent = "Session complete!";
        setTimeout(() => { timerMessage.textContent = ""; }, 3000);
    }

    function updateTimerPreview() {
        if (!timerActive) {
            const minutes = parseInt(timerMinutes.value) || 0;
            timerDisplay.textContent = `${String(minutes).padStart(2, "0")}:00`;
        }
    }

    function saveCurrentAsPreset() {
        const minutes = parseInt(timerMinutes.value);
        if (isNaN(minutes) || minutes < 1) return;

        const name = (prompt("Name this preset:") || "").trim();
        if (!name) return;

        const preset = {
            id: Date.now(),
            name,
            minutes
        };

        presets.push(preset);
        chrome.storage.sync.set({ presets });
        renderPresets();

        timerMessage.textContent = `Saved "${name}"`;
        setTimeout(() => { timerMessage.textContent = ""; }, 2000);
    }

    function renderPresets() {
        presetList.innerHTML = "";

        if (!presets.length) {
            presetList.innerHTML = '<div class="empty-state">No presets saved yet</div>';
            return;
        }

        presets.forEach(preset => {
            const div = document.createElement("div");
            div.className = "preset-item";
            div.innerHTML = `
                <div class="preset-header">
                    <div>
                        <div class="preset-name">${preset.name}</div>
                        <div class="preset-duration">${preset.minutes} minutes</div>
                    </div>
                </div>
                <div class="preset-actions">
                    <button class="btn-small" data-action="start">Start</button>
                    <button class="btn-small danger" data-action="delete">Delete</button>
                </div>
            `;

            div.querySelector('[data-action="start"]').addEventListener("click", () => {
                timerMinutes.value = preset.minutes;
                updateTimerPreview();
                startFocusSession(preset.minutes);
            });

            div.querySelector('[data-action="delete"]').addEventListener("click", () => {
                presets = presets.filter(p => p.id !== preset.id);
                chrome.storage.sync.set({ presets });
                renderPresets();
            });

            presetList.appendChild(div);
        });
    }

    function addBlockedSite() {
        const url = urlInput.value.trim();
        if (!url) return;

        const domain = normalizeDomain(url);
        if (!domain) return;

        chrome.storage.sync.get("blockedUrls", (data) => {
            const urls = data.blockedUrls || [];
            if (!urls.includes(domain)) {
                urls.push(domain);
                blockedUrls = urls;
                chrome.runtime.sendMessage({ action: "updateUrls", urls });
                chrome.storage.sync.set({ blockedUrls: urls });
                renderUrlList(urls);
                renderUrlListFocus(urls);
                urlInput.value = "";
            }
        });
    }

    function addBlockedSiteFocus() {
        const url = urlInputFocus.value.trim();
        if (!url) return;

        const domain = normalizeDomain(url);
        if (!domain) return;

        chrome.storage.sync.get("blockedUrls", (data) => {
            const urls = data.blockedUrls || [];
            if (!urls.includes(domain)) {
                urls.push(domain);
                blockedUrls = urls;
                chrome.runtime.sendMessage({ action: "updateUrls", urls });
                chrome.storage.sync.set({ blockedUrls: urls });
                renderUrlList(urls);
                renderUrlListFocus(urls);
                urlInputFocus.value = "";
            }
        });
    }

    function renderUrlList(urls) {
        urlList.innerHTML = "";

        if (!urls.length) {
            urlList.innerHTML = '<div class="empty-state">No sites blocked yet</div>';
            return;
        }

        urls.forEach(url => {
            const li = document.createElement("li");
            li.className = "list-item";
            const removeDisabled = enabled || timerActive ? "disabled" : "";
            li.innerHTML = `
                <span class="list-item-text">${url}</span>
                <div class="list-item-actions">
                    <button class="btn-small danger" ${removeDisabled} data-url="${url}">Remove</button>
                </div>
            `;

            const btn = li.querySelector("button");
            if (!removeDisabled) {
                btn.addEventListener("click", () => removeUrl(url));
            }

            urlList.appendChild(li);
        });
    }

    function renderUrlListFocus(urls) {
        urlListFocus.innerHTML = "";

        if (!urls.length) {
            urlListFocus.innerHTML = '<div class="empty-state" style="padding: 20px;">No sites blocked yet</div>';
            return;
        }

        urls.forEach(url => {
            const li = document.createElement("li");
            li.className = "list-item";
            const removeDisabled = enabled || timerActive ? "disabled" : "";
            li.innerHTML = `
                <span class="list-item-text">${url}</span>
                <div class="list-item-actions">
                    <button class="btn-small danger" ${removeDisabled} data-url="${url}">Remove</button>
                </div>
            `;

            const btn = li.querySelector("button");
            if (!removeDisabled) {
                btn.addEventListener("click", () => removeUrl(url));
            }

            urlListFocus.appendChild(li);
        });
    }

    function removeUrl(url) {
        if (enabled || timerActive) return;

        chrome.storage.sync.get("blockedUrls", (data) => {
            const urls = (data.blockedUrls || []).filter(u => u !== url);
            blockedUrls = urls;
            chrome.runtime.sendMessage({ action: "updateUrls", urls });
            chrome.storage.sync.set({ blockedUrls: urls });
            renderUrlList(urls);
            renderUrlListFocus(urls);
        });
    }

    function renderHistory() {
        historyList.innerHTML = "";

        if (!history.length) {
            historyList.innerHTML = '<div class="empty-state">No focus sessions yet</div>';
            return;
        }

        history.slice(0, 20).forEach(session => {
            const date = new Date(session.date);
            const div = document.createElement("div");
            div.className = "list-item";
            const statusColor = session.completed ? "var(--primary)" : "#8B4B6B";
            div.innerHTML = `
                <div>
                    <div class="list-item-text">${session.duration} minutes</div>
                    <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
                        ${date.toLocaleDateString()} ${date.toLocaleTimeString([], {hour: "2-digit", minute:"2-digit"})}
                    </div>
                </div>
                <div style="font-size: 12px; color: ${statusColor};">
                    ${session.completed ? "✓ Completed" : "✗ Incomplete"}
                </div>
            `;
            historyList.appendChild(div);
        });
    }

    function renderStats() {
        const completed = history.filter(h => h.completed);
        const totalMinutes = completed.reduce((sum, h) => sum + h.duration, 0);

        document.getElementById("total-sessions").textContent = completed.length;
        document.getElementById("total-minutes").textContent = totalMinutes;

        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const maxMinutes = Math.max(...stats.dailyMinutes, 1);

        weeklyChart.innerHTML = "";
        stats.dailyMinutes.forEach((minutes, i) => {
            const pct = (minutes / maxMinutes) * 100;
            const div = document.createElement("div");
            div.className = "bar-item";
            div.innerHTML = `
                <div class="bar-label">${days[i]}</div>
                <div class="bar-track">
                    <div class="bar-fill" style="width:${pct}%">
                        <span class="bar-value">${minutes}m</span>
                    </div>
                </div>
            `;
            weeklyChart.appendChild(div);
        });

        blockedStats.innerHTML = "";
        const entries = Object.entries(stats.blockedSites || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
        if (!entries.length) {
            blockedStats.innerHTML = '<div class="empty-state">No data yet</div>';
        } else {
            entries.forEach(([site, count]) => {
                const div = document.createElement("div");
                div.className = "blocked-site-item";
                div.innerHTML = `
                    <span class="site-name">${site}</span>
                    <span class="site-count">${count}</span>
                `;
                blockedStats.appendChild(div);
            });
        }
    }

    function normalizeDomain(input) {
        const trimmed = input.trim();
        if (!trimmed) return null;

        try {
            const hasProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed);
            const url = new URL(hasProtocol ? trimmed : `https://${trimmed}`);
            return url.hostname.replace(/^www\./i, "");
        } catch (e) {
            return trimmed;
        }
    }

    function updateIcon(isEnabled) {
        appLogo.src = isEnabled ? "icon_mischiveous.png" : "icon_sleep.png";
    }
});
