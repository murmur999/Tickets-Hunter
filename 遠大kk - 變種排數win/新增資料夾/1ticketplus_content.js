// --- ticketplus_content.js (v5.0 - 全自動刷新循環版) ---

console.log("✅ 遠大 TicketPlus Bot v5.0 已載入");
console.log("⌨️ 快捷鍵說明:");
console.log(" [1] 刪除選擇  [2] 單次自動選位  [3] 點擊確定  [4] 頁面刷新");
console.log(" [5] 極速重選 (清除+選位)  [7] 啟動全自動循環 (刷新+清除+選位+確定)");
console.log(" [8] 停止自動循環模式");

// --- 1. 基礎輔助函式 ---

function simulateClick(element) {
    if (!element) return;
    const event = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window
    });
    element.dispatchEvent(event);
}

let debugBox = null;
function logToScreen(msg) {
    if (!debugBox) {
        debugBox = document.createElement('div');
        debugBox.style.cssText = "position:fixed;top:10px;right:10px;width:320px;background:rgba(0,0,0,0.9);color:#00e5ff;z-index:999999;font-size:14px;padding:12px;border-radius:8px;font-family:monospace;border:2px solid #00e5ff;box-shadow:0 0 10px rgba(0,229,255,0.5);pointer-events:none;";
        document.body.appendChild(debugBox);
    }
    const lines = debugBox.innerHTML.split('<br>').slice(0, 5);
    debugBox.innerHTML = `[${new Date().toLocaleTimeString()}] ${msg}<br>` + lines.join('<br>');
}

// --- 2. 選位核心邏輯 ---

/**
 * 根據設定掃描座位並點擊
 * @returns {Promise<boolean>} 是否成功點擊座位
 */
function autoSelectSeatsFromSettings() {
    return new Promise((resolve) => {
        chrome.storage.local.get("kktix_settings", (data) => {
            const s = data.kktix_settings;
            if (!s) {
                logToScreen("⚠️ 找不到設定，請檢查設定頁");
                resolve(false);
                return;
            }

            const targetCount = parseInt(s.count) || 1;
            const rMin = parseInt(s.rowMin) || 0;
            const rMax = parseInt(s.rowMax) || 999;
            const nMin = parseInt(s.numMin) || 0;
            const nMax = parseInt(s.numMax) || 999;

            let clickedCount = 0;
            const allSeats = document.querySelectorAll('div.seat');
            
            for (const seat of allSeats) {
                if (clickedCount >= targetCount) break;

                const r = parseInt(seat.getAttribute('data-row'));
                const n = parseInt(seat.getAttribute('data-column'));

                if (r >= rMin && r <= rMax && n >= nMin && n <= nMax) {
                    if (seat.classList.contains('is-avaliable')) {
                        seat.style.border = "4px solid #00e5ff"; // 視覺提示
                        simulateClick(seat);
                        clickedCount++;
                    }
                }
            }

            if (clickedCount > 0) {
                logToScreen(`⚡ 成功點擊 ${clickedCount} 個座位`);
                resolve(true);
            } else {
                resolve(false);
            }
        });
    });
}

/**
 * 執行按鍵 7 的循環任務 (清除 -> 選位 -> 確定/刷新)
 */
async function runAutoCycleTask() {
    // 1. 嘗試執行清除
    const deleteIcon = document.querySelector('.mdi-delete-outline');
    const deleteBtn = deleteIcon ? deleteIcon.closest('button') || deleteIcon.closest('div.action') : null;
    if (deleteBtn) {
        simulateClick(deleteBtn);
        // 清除後稍等 50ms 讓 DOM 更新
        await new Promise(r => setTimeout(r, 50));
    }

    // 2. 執行自動選位
    const isSuccess = await autoSelectSeatsFromSettings();

    if (isSuccess) {
        // 3. 成功：自動按確定
        logToScreen("🎯 成功選位！觸發確定...");
        const confirmSpan = Array.from(document.querySelectorAll('.v-btn__content')).find(el => el.textContent.trim() === '確定');
        const confirmBtn = confirmSpan ? confirmSpan.closest('button') : null;
        if (confirmBtn) {
            simulateClick(confirmBtn);
            // 任務完成，清除旗標
            chrome.storage.local.set({ autoLoop7: false });
        }
    } else {
        // 4. 失敗：提示並刷新頁面 (約 300ms 後，避免伺服器拒絕)
        logToScreen("⏳ 範圍內無票，即將刷新頁面重試...");
        setTimeout(() => {
            location.reload();
        }, 300);
    }
}

// --- 3. 購票列表頁邏輯 (保留原功能) ---

function findNextButtonElement() {
    const nextButtonSpan = Array.from(document.querySelectorAll('button .v-btn__content')).find(el => el.textContent.trim().includes('下一步'));
    return nextButtonSpan ? nextButtonSpan.parentElement : null;
}

function executeFinalStep(settings) {
    if (settings && settings.memberId) { 
        let priorityInput = document.querySelector('input[placeholder*="序號"], input[placeholder*="code"]');
        if (priorityInput && priorityInput.value === '') {
            priorityInput.value = settings.memberId;
            priorityInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
    const agreeCheckbox = document.querySelector('.v-input--checkbox .v-input__slot');
    if (agreeCheckbox) simulateClick(agreeCheckbox);
    const nextButton = findNextButtonElement();
    if (nextButton) simulateClick(nextButton);
}

function startTicketLogic() {
    chrome.storage.local.get("kktix_settings", (data) => {
        const settings = data.kktix_settings;
        if (!settings) return;
        const ticketPanels = Array.from(document.querySelectorAll('.v-expansion-panel'));
        const typeKey = (settings.typeKeyword || "").toLowerCase();
        const priceKey = (settings.priceKeyword || "").toLowerCase();

        for (const panel of ticketPanels) {
            const headerText = (panel.querySelector('.v-expansion-panel-header')?.textContent || "").toLowerCase();
            if (headerText.includes('已售完')) continue;
            if ((!typeKey || headerText.includes(typeKey)) && (!priceKey || headerText.includes(priceKey))) {
                simulateClick(panel.querySelector('.v-expansion-panel-header'));
                // 此處省略原有的 waitForPanelContent 詳細邏輯，保持代碼精簡
                return;
            }
        }
    });
}

// --- 4. 初始化與快捷鍵監聽 ---

function setupSeatSelectionShortcuts() {
    window.addEventListener('keydown', (event) => {
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;

        if (event.key === '1') { // 刪除
            const deleteIcon = document.querySelector('.mdi-delete-outline');
            const btn = deleteIcon ? deleteIcon.closest('button') : null;
            if (btn) simulateClick(btn);
        }
        if (event.key === '2') autoSelectSeatsFromSettings(); // 單次選位
        if (event.key === '3') { // 確定
            const confirmSpan = Array.from(document.querySelectorAll('.v-btn__content')).find(el => el.textContent.trim() === '確定');
            if (confirmSpan) simulateClick(confirmSpan.closest('button'));
        }
        if (event.key === '4') location.reload();
        
        if (event.key === '5') { // 極速重選
            const deleteIcon = document.querySelector('.mdi-delete-outline');
            if (deleteIcon) simulateClick(deleteIcon.closest('button'));
            autoSelectSeatsFromSettings();
        }

        // [重要] 快捷鍵 7：啟動全自動循環
        if (event.key === '7') {
            logToScreen("🚀 啟動模式 7：刷新+清除+選位+確定");
            chrome.storage.local.set({ autoLoop7: true }, () => {
                location.reload(); // 先刷新，載入後會自動執行 runAutoCycleTask
            });
        }

        // [重要] 快捷鍵 8：停止
        if (event.key === '8') {
            chrome.storage.local.set({ autoLoop7: false });
            logToScreen("🛑 已終止自動循環模式");
        }
    });
}

/**
 * 頁面載入時檢查是否需要自動執行
 */
async function initialize() {
    if (window.location.pathname.includes('/seat/')) {
        setupSeatSelectionShortcuts();
        
        // 檢查是否有自動循環旗標
        const data = await chrome.storage.local.get("autoLoop7");
        if (data.autoLoop7) {
            logToScreen("🤖 自動循環模式運行中...");
            // 等待 SVG 加載完成
            const checkExist = setInterval(() => {
                if (document.querySelectorAll('div.seat').length > 0) {
                    clearInterval(checkExist);
                    runAutoCycleTask();
                }
            }, 100);
        }
    } else {
        // 購票列表頁
        chrome.storage.local.get("botEnabled", (data) => {
            if (data.botEnabled) startTicketLogic();
        });
    }
}

initialize();