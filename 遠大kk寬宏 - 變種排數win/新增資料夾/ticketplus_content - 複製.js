// --- ticketplus_content.js (v6.2 - 強化自動選位循環版) ---

console.log("✅ 遠大 TicketPlus Bot v6.2 已載入");

// --- 1. 基礎工具 ---

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

// --- 2. 購票列表頁邏輯 ---

function findButtonByText(text) {
    const span = Array.from(document.querySelectorAll('.v-btn__content'))
                      .find(el => el.textContent.trim().includes(text));
    return span ? span.closest('button') : null;
}

function executeFinalStep(settings) {
    if (settings && settings.memberId) { 
        let input = document.querySelector('input[placeholder*="序號"], input[placeholder*="code"]');
        if (input && input.value === '') {
            input.value = settings.memberId;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
    const agree = document.querySelector('.v-input--checkbox .v-input__slot');
    if (agree) simulateClick(agree);
    
    const nextButton = findButtonByText('下一步');
    if (nextButton) simulateClick(nextButton);
}

function observeFinalStep(settings) {
    const nextButton = findButtonByText('下一步');
    if (nextButton) {
        setTimeout(() => executeFinalStep(settings), 50);
        return; 
    }
    const observer = new MutationObserver((mutations, obs) => {
        const btn = findButtonByText('下一步');
        if (btn) {
            obs.disconnect();
            setTimeout(() => executeFinalStep(settings), 50);
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

async function startTicketLogic() {
    const { kktix_settings: settings } = await chrome.storage.local.get("kktix_settings");
    if (!settings) return;

    const panels = Array.from(document.querySelectorAll('.v-expansion-panel'));
    const typeKey = (settings.typeKeyword || "").toLowerCase();
    const priceKey = (settings.priceKeyword || "").toLowerCase();

    let foundMatch = false;

    for (const panel of panels) {
        const header = panel.querySelector('.v-expansion-panel-header');
        if (!header || header.textContent.includes('已售完')) continue;
        const text = header.textContent.toLowerCase();
        
        if ((!typeKey || text.includes(typeKey)) && (!priceKey || text.includes(priceKey))) {
            foundMatch = true;
            logToScreen(`✅ 命中票區: ${text.trim()}`);
            simulateClick(header);
            waitForPanelContent(settings);
            break; 
        }
    }

    if (!foundMatch && settings.autoRefresh) {
        logToScreen("🔄 找不到票，500ms 後重新整理...");
        setTimeout(() => location.reload(), 500);
    }
}

function waitForPanelContent(settings) {
    const checkInterval = setInterval(() => {
        const plusButton = document.querySelector('.v-icon.mdi-plus');
        if (plusButton) {
            clearInterval(checkInterval);
            processListNextStep(plusButton, settings);
        }
    }, 100);
}

function processListNextStep(plusButton, settings) {
    const count = parseInt(settings.count) || 1;
    for (let i = 0; i < count; i++) {
        simulateClick(plusButton.closest('button'));
    }

    setTimeout(() => {
        if (settings.seatMode === 'manual') {
            const labelElement = Array.from(document.querySelectorAll('label')).find(el => el.textContent.trim().includes('自行選位'));
            const selfSelectButton = labelElement ? labelElement.closest('.v-radio') : null;
            if (selfSelectButton) {
                selfSelectButton.click(); 
                observeFinalStep(settings); 
            } else {
                observeFinalStep(settings);
            }
        } else {
            observeFinalStep(settings);
        }
    }, 150);
}

// --- 3. 座位頁面邏輯 ---

function autoSelectSeatsFromSettings() {
    return new Promise((resolve) => {
        chrome.storage.local.get("kktix_settings", (data) => {
            const s = data.kktix_settings;
            if (!s) return resolve(false);

            const target = parseInt(s.count) || 1;
            const rMin = s.rowMin !== "" ? parseInt(s.rowMin) : 0;
            const rMax = s.rowMax !== "" ? parseInt(s.rowMax) : 999;
            const nMin = s.numMin !== "" ? parseInt(s.numMin) : 0;
            const nMax = s.numMax !== "" ? parseInt(s.numMax) : 999;

            let clicked = 0;
            const seats = document.querySelectorAll('.seat.is-avaliable');
            
            for (const seat of seats) {
                if (clicked >= target) break;

                const rAttr = seat.getAttribute('data-row');
                const nAttr = seat.getAttribute('data-column');
                
                if (rAttr === null || nAttr === null) continue;

                const r = parseInt(rAttr);
                const n = parseInt(nAttr);

                if (r >= rMin && r <= rMax && n >= nMin && n <= nMax) {
                    seat.style.border = "4px solid #00ff00"; 
                    simulateClick(seat);
                    clicked++;
                }
            }
            resolve(clicked > 0);
        });
    });
}

/**
 * 執行按鍵 7 的循環任務 (清除 -> 選位 -> 確定/刷新)
 */
async function runAutoCycleTask() {
    logToScreen("⚙️ 執行清除與偵測...");
    
    // 1. 執行清除 (如果有舊的選位)
    const deleteIcon = document.querySelector('.mdi-delete-outline');
    const deleteBtn = deleteIcon ? deleteIcon.closest('button') || deleteIcon.closest('div.action') : null;
    if (deleteBtn) {
        simulateClick(deleteBtn);
        await new Promise(r => setTimeout(r, 80)); 
    }

    // 2. 依照設定偵測座位
    const isSuccess = await autoSelectSeatsFromSettings();

    if (isSuccess) {
        // 3. 成功：自動按確定
        logToScreen("🎯 成功選位！觸發確定...");
        const confirmBtn = findButtonByText('確定');
        if (confirmBtn) {
            simulateClick(confirmBtn);
            // 任務完成，清除旗標避免重複刷
            chrome.storage.local.set({ autoLoop7: false });
        }
    } else {
        // 4. 沒選到票，重整頁面重試
        logToScreen("⏳ 範圍內無票，即將刷新頁面重試...");
        setTimeout(() => location.reload(), 400); 
    }
}

function setupSeatSelectionShortcuts() {
    logToScreen("⌨️ 快捷鍵: [7]循環偵測 [8]停止 [1-5]手動工具");

    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (e.key === '1') {
            const delIcon = document.querySelector('.mdi-delete-outline');
            if (delIcon) simulateClick(delIcon.closest('button'));
        }
        if (e.key === '2') autoSelectSeatsFromSettings();
        if (e.key === '3') {
            const btn = findButtonByText('確定');
            if (btn) simulateClick(btn);
        }
        if (e.key === '4') location.reload();
        if (e.key === '5') {
            logToScreen("⚡ [5] 極速重選");
            
            // 1. 嘗試清除 (如果有按鈕的話)
            const deleteIcon = document.querySelector('.mdi-delete-outline');
            const deleteBtn = deleteIcon ? deleteIcon.closest('button') || deleteIcon.closest('div.action') : null;
            if (deleteBtn) {
                simulateClick(deleteBtn);
            }

            // 2. 立即執行選位 (無 setTimeout)
            autoSelectSeatsFromSettings();
        }
        if (e.key === '7') {
            logToScreen("🚀 啟動模式 7：循環重試開啟");
            chrome.storage.local.set({ autoLoop7: true }, () => {
                location.reload(); 
            });        
        }
        if (e.key === '8') {
            chrome.storage.local.set({ autoLoop7: false });
            logToScreen("🛑 自動循環已關閉");
        }
    });
}

// --- 4. 初始化 ---

async function initialize() {
    if (window.location.pathname.includes('/seat/')) {
        setupSeatSelectionShortcuts();
        const data = await chrome.storage.local.get("autoLoop7");
        if (data.autoLoop7) {
            const check = setInterval(() => {
                // 確保座位 SVG 已載入
                if (document.querySelectorAll('.seat').length > 5) { 
                    clearInterval(check);
                    runAutoCycleTask();
                }
            }, 150);
        }
    } else {
        chrome.storage.local.get("botEnabled", (data) => {
            if (data.botEnabled) {
                const listGuard = setInterval(() => {
                    if (document.querySelector('.v-expansion-panel')) {
                        clearInterval(listGuard);
                        startTicketLogic();
                    }
                }, 500);
            }
        });
    }
}

initialize();