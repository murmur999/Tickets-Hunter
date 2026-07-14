// kktix_content.js (v10.9 - 順序優化與極速發送版)
console.log("✅ KKTIX 機器人 v10.9 (邏輯順序優化版) 已載入");

// 注入 inject.js
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.onload = function() { this.remove(); };
(document.head || document.documentElement).appendChild(script);

// --- 視覺化除錯視窗 (可拖曳) ---
let debugBox = null;

function logToScreen(msg) {
    if (!debugBox) {
        createDraggableDebugBox();
    }
    const lines = debugBox.innerHTML.split('<br>').slice(0, 6);
    if (lines.length > 0 && lines[0].includes(msg)) return;
    debugBox.innerHTML = `[${new Date().toLocaleTimeString()}] ${msg}<br>` + lines.join('<br>');
}

function createDraggableDebugBox() {
    debugBox = document.createElement('div');
    debugBox.style.cssText = "position:fixed;top:10px;right:10px;width:320px;background:rgba(0,0,0,0.9);color:#00ff00;z-index:9999999;font-size:14px;padding:12px;border-radius:8px;line-height:1.5;font-family:monospace;border: 2px solid #00ff00; cursor: move; user-select: none; box-shadow: 0 4px 15px rgba(0,0,0,0.5);";
    document.body.appendChild(debugBox);

    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    debugBox.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = debugBox.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        debugBox.style.cursor = 'grabbing';
        debugBox.style.opacity = "0.7";
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        debugBox.style.right = 'auto';
        debugBox.style.left = `${initialLeft + dx}px`;
        debugBox.style.top = `${initialTop + dy}px`;
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            debugBox.style.cursor = 'move';
            debugBox.style.opacity = "1";
        }
    });
}

// ----------------------------------------------------
// 全局變數
// ----------------------------------------------------
let isBotEnabled = false; 
let globalMonitorTimer = null; 
let seatScanTimer = null; 

// ----------------------------------------------------
// 1. 監聽狀態變更 (Ctrl+B 觸發)
// ----------------------------------------------------
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "TOGGLE_STATE") {
        isBotEnabled = request.state;
        logToScreen(isBotEnabled ? "🟢 搶票模式: ON" : "🔴 搶票模式: OFF");
    }
});

// 初始化狀態
chrome.storage.local.get(["botEnabled"], (data) => {
    isBotEnabled = data.botEnabled || false;
    logToScreen(isBotEnabled ? "⚡ 狀態恢復: ON" : "💤 狀態: OFF (請按 Ctrl+B 啟動)");
    startGlobalMonitor();
});

// ----------------------------------------------------
// 2. 快捷鍵 (Windows Alt 專用版)
// ----------------------------------------------------
window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    // 關鍵修改：在 Windows 系統下，監聽 Alt 鍵 (對應 Mac 的 Option)
    if (!e.altKey) return; 

    // ===== 功能一：Alt + 1 (首次買票：自動搜尋設定範圍的空位並逼出彈窗) =====
    if (e.key === '1') {
        logToScreen("⌨️ [Alt+1] 啟動極速空位搜尋 + 實體彈窗觸發");

        chrome.storage.local.get("kktix_settings", (data) => {
            const settings = data.kktix_settings;
            if (!settings) {
                logToScreen("❌ 找不到 KKTIX 設定，無法執行搜尋");
                return;
            }

            // 從後台設定讀取範圍
            const rMin = parseInt(settings.rowMin) || 0;
            const rMax = parseInt(settings.rowMax) || 999;
            const nMin = parseInt(settings.numMin) || 0;
            const nMax = parseInt(settings.numMax) || 999;
            const labelRegex = /([Vv]|\d+)\s*排\s*(\d+)\s*號/;

            // 獲取當前所有可用座位
            const seatElements = document.querySelectorAll('.seat-available');
            const len = seatElements.length;

            // 【極速優化】在迴圈外預先建立好完整滑鼠事件物件，避免重複消耗效能
            const mouseSettings = { bubbles: true, cancelable: true, view: window, buttons: 1 };
            const mEvent = (type) => new MouseEvent(type, mouseSettings);
            const eEnter = mEvent('mouseenter');
            const eOver  = mEvent('mouseover');
            const eDown  = mEvent('mousedown');
            const eUp    = mEvent('mouseup');
            const eClick = mEvent('click');

            let found = false;

            // 開始雷達式 For 循環搜尋
            for (let i = 0; i < len; i++) {
                const seatSpan = seatElements[i];
                const parent = seatSpan.parentElement;
                if (!parent || !window.angular) continue;

                const scope = window.angular.element(parent).scope();
                if (!scope || !scope.view || !scope.view.label) continue;

                const match = scope.view.label.match(labelRegex);
                if (match) {
                    let rowVal = match[1].toUpperCase() === 'V' ? 0 : parseInt(match[1], 10);
                    const numVal = parseInt(match[2], 10);

                    // 檢查是否符合使用者在 options 設定的範圍
                    if (rowVal >= rMin && rowVal <= rMax && numVal >= nMin && numVal <= nMax) {
                        found = true;
                        
                        // 視覺標記
                        seatSpan.style.border = "4px solid #00ff00";
                        seatSpan.scrollIntoView({behavior: "auto", block: "center"});

                        // 依序對格子與父層轟炸完整事件流，逼出原生彈窗
                        seatSpan.dispatchEvent(eEnter);
                        parent.dispatchEvent(eEnter);

                        seatSpan.dispatchEvent(eOver);
                        parent.dispatchEvent(eOver);

                        seatSpan.dispatchEvent(eDown);
                        parent.dispatchEvent(eDown);

                        seatSpan.dispatchEvent(eUp);
                        parent.dispatchEvent(eUp);

                        seatSpan.dispatchEvent(eClick);
                        parent.dispatchEvent(eClick);

                        logToScreen(`🎉 成功鎖定空位並觸發彈窗: ${scope.view.label}`);
                        
                        // 觸發成功後發送通知
                        window.dispatchEvent(new CustomEvent("KKTIX_BOT_SUCCESS", { 
                            detail: { label: scope.view.label } 
                        }));
                        
                        break; // 找到第一個可買的座位後立刻退出迴圈
                    }
                }
            }

            if (!found) {
                logToScreen("⏳ 設定的範圍內目前沒有任何空位...");
            }
        });
    }

    // ===== 功能二：Alt + 3 (保留原本功能：強制重啟原本設定的選位掃描) =====
    if (e.key === '3') {
        logToScreen("⌨️ [Alt+3] 強制重啟選位掃描");
        chrome.storage.local.get("kktix_settings", (data) => {
            if (data.kktix_settings) triggerSeatPick(data.kktix_settings, true);
        });
    }
});

// ----------------------------------------------------
// 主監控迴圈 (永久執行)
// ----------------------------------------------------
function startGlobalMonitor() {
    if (globalMonitorTimer) clearInterval(globalMonitorTimer);
    
    globalMonitorTimer = setInterval(() => {
        chrome.storage.local.get(["kktix_settings"], (data) => {
            const settings = data.kktix_settings;
            if (!settings) return;

            const isSeatMapPage = document.querySelector('.svg-seat-map') || document.querySelector('.seat-available');

            // === A. 選位圖邏輯 (獨立運作) ===
            if (isSeatMapPage) {
                if (!seatScanTimer && settings.seatMode === 'manual' && settings.enableSeatMapClick) {
                    triggerSeatPick(settings);
                }
                const confirmBuyBtn = document.querySelector('a[ng-click*="buy"][class*="btn-primary"]');
                if (confirmBuyBtn && !confirmBuyBtn.classList.contains('disabled')) {
                    logToScreen("💰 [選位圖] 自動點擊購買！");
                    confirmBuyBtn.click();
                }
                return; 
            } else {
                if (seatScanTimer) {
                    clearInterval(seatScanTimer);
                    seatScanTimer = null;
                    logToScreen("📍 離開選位圖，停止掃描");
                }
            }

            // === B. 購票/驗證邏輯 (受 isBotEnabled 控制) ===
            if (!isBotEnabled) return; 

            const url = location.href;
            
            if (url.includes("/events/") && !url.includes("/registrations/")) {
                const nextBtn = document.querySelector('.tickets .btn-point') || 
                                document.querySelector('a.btn-primary');
                if (nextBtn) nextBtn.click();
            }

            if (url.includes("/registrations/")) {
                runTicketSelection(settings);
                runQA(settings);
            }
        });
    }, 50); 
}

// ==========================================
// 邏輯：選位圖 (獨立)
// ==========================================
function triggerSeatPick(settings, isForce = false) {
    if (!isForce && !settings.enableSeatMapClick) return;
    if (seatScanTimer) clearInterval(seatScanTimer);
   
    const rMin = parseInt(settings.rowMin) || 0;
    const rMax = parseInt(settings.rowMax) || 999;
    const nMin = parseInt(settings.numMin) || 0;
    const nMax = parseInt(settings.numMax) || 999;

    // 修改這一行：加入 V 排視為 0 的提示
    logToScreen(`🚀 啟動座位掃描: ${rMin}-${rMax}排 (V排視為0排), ${nMin}-${nMax}號`);

    let attempts = 0;
    seatScanTimer = setInterval(() => {
        attempts++;
        const seat = document.querySelector('.seat-available');
        if (seat) {
            window.dispatchEvent(new CustomEvent("KKTIX_BOT_EXECUTE", {
                detail: { rMin, rMax, nMin, nMax }
            }));
        } else {
            if(attempts % 20 === 0) logToScreen("⏳ 尋找座位中...");
        }
        const buyBtn = document.querySelector('a[ng-click*="buy"]');
        if (buyBtn && !buyBtn.classList.contains('disabled') && !buyBtn.classList.contains('ng-hide')) {
             buyBtn.click();
        }
        if (attempts > 6000) {
            clearInterval(seatScanTimer);
            seatScanTimer = null;
            logToScreen("❌ 掃描逾時自動停止");
        }
    }, 150);
}

window.addEventListener("KKTIX_BOT_SUCCESS", (e) => {
    logToScreen(`🎉 點擊座位: ${e.detail.label}`);
});

// ==========================================
// 邏輯：票種選擇 (確保先選票 -> 再送出)
// ==========================================
function runTicketSelection(settings) {
    const ticketRows = Array.from(document.querySelectorAll('.ticket-unit'));
    if (ticketRows.length === 0) return;

    if (settings.direction === 'bottom_up') ticketRows.reverse();

    let targetFound = false;
    const typeKey = (settings.typeKeyword || "").toLowerCase();
    const priceKey = (settings.priceKeyword || "").toLowerCase();

    for (let row of ticketRows) {
        const nameText = (row.querySelector('.ticket-name')?.innerText || "").toLowerCase();
        const priceText = (row.querySelector('.ticket-price')?.innerText || "").toLowerCase();
        const fullText = nameText + " " + priceText;

        if (fullText.includes("售完") || fullText.includes("無票")) continue;

        let match = true;
        if (typeKey && !fullText.includes(typeKey)) match = false;
        if (priceKey && !fullText.includes(priceKey)) match = false;

        if (match) {
            const input = row.querySelector('input[type="number"], input[type="text"]');
            if (input && !input.disabled) {
                targetFound = true;
                // 1. 只有當張數不對時，才去修改並鎖定
                if (input.value != settings.count) {
                    logToScreen(`✅ 鎖定: ${nameText.trim()}`);
                    input.focus();
                    input.value = settings.count;
                    // 關鍵：發送事件告訴網站張數已變更
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }

                // 2. 勾選同意條款
                const agreeCheck = document.querySelector('#person_agree_terms');
                if (agreeCheck && !agreeCheck.checked) agreeCheck.click();

                // 3. 一切就緒後，最後才執行送出 (包含極速發送)
                clickNextStepButtons(settings.seatMode);
                return; 
            }
        }
    }

    if (!targetFound) {
        // 如果設定為強制送出，即便沒找到特定關鍵字也嘗試點擊 (通常不需要)
        if (settings.forceSubmit) {
            window.isSubmitting = true; // 標記正在送出中
            clickNextStepButtons(settings.seatMode);
        }
        
        // 自動刷新邏輯 (流程狀態控制版)
        if (settings.autoRefresh && !window.isRefreshed) {
            
            // 關鍵防線：如果剛剛有成功觸發點擊送出，或者是網頁正中間出現 KKTIX 的讀取中遮罩
            const kktixLoading = document.querySelector('.loading:not([class*="rc-"]), .loading-mask, .processing');
            if (window.isSubmitting || kktixLoading) {
                logToScreen("⏳ 票券送出中 / 正在查詢空位，暫停自動重新整理...");
                return; // 直接退出，把時間留給系統排隊
            }

            // 確定完全沒有在送出，大膽執行重新整理！
            window.isRefreshed = true;
            logToScreen("🔄 尚未開賣或無票，執行刷新...");
            setTimeout(() => location.reload(), 1000);
        }
    }
} // runTicketSelection 函式總結尾

// 整合：極速發送訊號 + DOM 點擊備援
function clickNextStepButtons(mode) {
    // ===== 新增這行：只要一呼叫送出，立刻鎖定狀態防重整 =====
    window.isSubmitting = true; 

    // 1. 發送極速訊號給 inject.js (使用 Angular 直接呼叫)
    window.dispatchEvent(new CustomEvent("KKTIX_BOT_TRIGGER_NEXT", {
        detail: { mode: mode }
    }));

    // 2. 為了保險起見，原有的 DOM 點擊還是保留著 (雙管齊下)
    const btnComputer = document.querySelector('button[ng-click*="challenge(1)"]');
    const btnManual = document.querySelector('button[ng-click="challenge()"]');
    const btnGeneric = document.querySelector('.btn-primary.btn-lg:not([disabled])');

    if (mode === 'manual' && btnManual && !btnManual.disabled) {
        btnManual.click();
        logToScreen("🖱️ (備用) 點擊自行選位");
    } else if (mode === 'computer' && btnComputer && !btnComputer.disabled) {
        btnComputer.click();
        logToScreen("🖱️ (備用) 點擊電腦配位");
    } else if (btnGeneric) {
        btnGeneric.click();
    }
}

// ==========================================
// 邏輯：問答
// ==========================================
function runQA(settings) {
    if (!settings.memberId) return;
    const qaInputs = document.querySelectorAll('input[name="captcha_answer"], .custom-captcha-inner input, input[placeholder*="邀請碼"], input[placeholder*="會員"]');
    qaInputs.forEach(input => {
        if (!input.value) {
            input.focus();
            input.value = settings.memberId;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });
}