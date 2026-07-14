// --- ticketplus_content.js (v7.0 - 支援1A~1Z、1H、1I等多種排數格式) ---
console.log("✅ 遠大 TicketPlus Bot v7.0 (支援1A~1Z排數版) 已載入");

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
    const lines = debugBox.innerHTML.split('<br>').slice(0, 8);
    debugBox.innerHTML = `[${new Date().toLocaleTimeString()}] ${msg}<br>` + lines.join('<br>');
}

// --- 2. 新增：支援多種排數格式的解析函數 ---
function parseRowValue(rowStr) {
    if (!rowStr) return 0;
    
    const str = rowStr.toUpperCase().trim();
    
    // 1. V 排視為 0
    if (str === 'V') return 0;
    
    // 2. 純數字排 (ex: "5", "12")
    if (/^\d+$/.test(str)) {
        return parseInt(str, 10);
    }
    
    // 3. 數字 + 字母 (ex: "1H", "1A", "2Z", "10K")
    const match = str.match(/^(\d+)([A-Z])$/);
    if (match) {
        const numPart = parseInt(match[1], 10);
        const letterPart = match[2].charCodeAt(0) - 64; // A=1, B=2, ..., Z=26
        return numPart * 1000 + letterPart; // 讓 1A=1001, 1B=1002, 1Z=1026, 2A=2001...
    }
    
    // 兜底
    return parseInt(str) || 0;
}

// --- 3. 購票列表頁邏輯（保持不變）---
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

function findRefreshTicketCountButton() {
    const keywords = ['更新票數', '刷新票數', '更新張數', '重新載入', '刷新', '更新'];
    const contents = document.querySelectorAll('.v-btn__content');
    for (const el of contents) {
        const text = el.textContent.trim();
        if (keywords.some(kw => text.includes(kw))) {
            const btn = el.closest('button');
            if (btn && !btn.disabled) {
                return btn;
            }
        }
    }
    return null;
}

async function clickRefreshIfNeeded() {
    const btn = findRefreshTicketCountButton();
    if (btn) {
        const btnText = btn.querySelector('.v-btn__content')?.textContent.trim() || '更新票數';
        logToScreen(`🔄 找到「${btnText}」 → 點擊刷新票數`);
        simulateClick(btn);
        await new Promise(r => setTimeout(r, 500));
    }
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
    let attempts = 0;
    const maxAttemptsBeforeLog = 20;
    const checkDelay = 10;

    function checkAndProceed() {
        attempts++;
        const plusIcon = document.querySelector('.v-icon.mdi-plus');
        
        if (plusIcon) {
            logToScreen(`✅ + 按鈕出現！開始快速加票 ${settings.count || 1} 張`);
            processListNextStep(plusIcon, settings);
            return;
        }
        
        if (attempts >= maxAttemptsBeforeLog) {
            logToScreen(`⚠️ 已嘗試 ${attempts} 次仍無 + 按鈕，持續點擊更新票數...`);
            attempts = 0;
        }
        
        clickRefreshIfNeeded().then(() => {
            setTimeout(checkAndProceed, checkDelay);
        });
    }
    
    setTimeout(checkAndProceed, 100);
}

function processListNextStep(plusButton, settings) {
    const count = parseInt(settings.count) || 1;
    for (let i = 0; i < count; i++) {
        simulateClick(plusButton.closest('button'));
    }
    
    setTimeout(() => {
        if (settings.seatMode === 'manual') {
            const labelElement = Array.from(document.querySelectorAll('label'))
                .find(el => el.textContent.trim().includes('自行選位'));
            const selfSelectButton = labelElement ? labelElement.closest('.v-radio') : null;
            if (selfSelectButton) {
                selfSelectButton.click();
            }
        }
        observeFinalStep(settings);
    }, 150);
}

// --- 4. 座位頁面邏輯（已完整升級支援1A~1Z）---
async function autoSelectSeatsFromSettings() {
    return new Promise((resolve) => {
        chrome.storage.local.get(["kktix_settings", "autoLoop7"], (data) => {
            const s = data.kktix_settings || {};
            
            const target = parseInt(s.count) || 1;
            
            // 排數與號碼範圍（使用新解析函數）
            const rMin = (s.rowMin !== undefined && s.rowMin !== "") ? parseRowValue(s.rowMin) : 0;
            const rMax = (s.rowMax !== undefined && s.rowMax !== "") ? parseRowValue(s.rowMax) : 999;
            const nMin = (s.numMin !== undefined && s.numMin !== "") ? parseInt(s.numMin) : 0;
            const nMax = (s.numMax !== undefined && s.numMax !== "") ? parseInt(s.numMax) : 999;

            logToScreen(`🚀 實際套用選位範圍 → 排 ${s.rowMin}~${s.rowMax} (解析後: ${rMin}~${rMax}), 號 ${nMin}~${nMax}`);

            let clicked = 0;
            const seats = document.querySelectorAll('.seat.is-avaliable');   // 網站使用「avaliable」（缺i）

            for (const seat of seats) {
                if (clicked >= target) break;

                const rAttr = seat.getAttribute('data-row');
                const nAttr = seat.getAttribute('data-column');

                if (rAttr === null || nAttr === null || rAttr === "") continue;

                const r = parseRowValue(rAttr);
                const n = parseInt(nAttr);

                if (isNaN(r) || isNaN(n)) continue;

                if (r >= rMin && r <= rMax && n >= nMin && n <= nMax) {
                    seat.style.border = "4px solid #00ff00";
                    simulateClick(seat);
                    clicked++;
                    logToScreen(`✅ 已點擊: Row ${rAttr} - Num ${nAttr}`);
                }
            }

            if (clicked > 0) {
                logToScreen(`🎯 成功點擊 ${clicked} 個座位`);
            } else {
                logToScreen(`⚠️ 此範圍內目前無可用座位`);
            }

            resolve(clicked > 0);
        });
    });
}

async function runAutoCycleTask() {
    logToScreen("⚙️ 執行清除與偵測...");

    // 先清除已選座位
    const deleteIcon = document.querySelector('.mdi-delete-outline');
    const deleteBtn = deleteIcon ? deleteIcon.closest('button') || deleteIcon.closest('div.action') : null;
    if (deleteBtn) {
        simulateClick(deleteBtn);
        await new Promise(r => setTimeout(r, 80));
    }

    const isSuccess = await autoSelectSeatsFromSettings();

    if (isSuccess) {
        logToScreen("🎯 成功選位！觸發確定...");
        const confirmBtn = findButtonByText('確定');
        if (confirmBtn) {
            simulateClick(confirmBtn);
            chrome.storage.local.set({ autoLoop7: false });
        }
    } else {
        logToScreen("⏳ 範圍內無票，400ms 後刷新頁面重試...");
        setTimeout(() => location.reload(), 400);
    }
}

function setupSeatSelectionShortcuts() {
    logToScreen("⌨️ Mac 快捷鍵: Option+1~5 / Option+7 / Option+8 (已支援1H~1Z排)");

    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (!e.altKey) return;

        if (e.key === '1') { // 清除
            const delIcon = document.querySelector('.mdi-delete-outline');
            if (delIcon) simulateClick(delIcon.closest('button'));
        }
        if (e.key === '2') { // 單次自動選位
            autoSelectSeatsFromSettings();
        }
        if (e.key === '3') { // 確定
            const btn = findButtonByText('確定');
            if (btn) simulateClick(btn);
        }
        if (e.key === '5') { // 極速重選
            logToScreen("⚡ [Option+5] 極速重選");
            const deleteIcon = document.querySelector('.mdi-delete-outline');
            const deleteBtn = deleteIcon ? deleteIcon.closest('button') || deleteIcon.closest('div.action') : null;
            if (deleteBtn) simulateClick(deleteBtn);
            autoSelectSeatsFromSettings();
        }
        if (e.key === '7') { // 開啟循環
            logToScreen("🚀 [Option+7] 循環重試開啟");
            chrome.storage.local.set({ autoLoop7: true }, () => { location.reload(); });
        }
        if (e.key === '8') { // 關閉循環
            chrome.storage.local.set({ autoLoop7: false });
            logToScreen("🛑 [Option+8] 自動循環已關閉");
        }
    });
}

// --- 5. 初始化 ---
async function initialize() {
    const data = await chrome.storage.local.get("kktix_settings");
    console.log("📋 TicketPlus 目前儲存的設定:", data.kktix_settings);
    if (data.kktix_settings) {
        logToScreen(`📋 設定載入完成 - 張數:${data.kktix_settings.count || 1}`);
    }

    if (window.location.pathname.includes('/seat/')) {
        setupSeatSelectionShortcuts();
        
        const loopData = await chrome.storage.local.get("autoLoop7");
        if (loopData.autoLoop7) {
            logToScreen("🔄 自動循環模式已啟動");
            const check = setInterval(() => {
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