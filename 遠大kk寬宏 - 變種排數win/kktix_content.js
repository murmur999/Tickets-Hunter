// kktix_content.js (v11.7 - 完美對齊英文字母智慧選位版)
console.log("✅ KKTIX 機器人 v11.7 已載入");

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

// 智慧通報停機函式：同步通知擴充功能本體關閉
function reportBotDisabled() {
    isBotEnabled = false;
    chrome.storage.local.set({ botEnabled: false });
    chrome.runtime.sendMessage({ action: "FORCE_BADGE_OFF" }).catch(() => {});
}

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

            // 修正點：直接傳送字串給新版 inject.js，由 inject 智慧解析 A、B、C 或純數字
            const rMin = (settings.rowMin !== undefined && settings.rowMin !== "") ? settings.rowMin.toString().trim() : "0";
            const rMax = (settings.rowMax !== undefined && settings.rowMax !== "") ? settings.rowMax.toString().trim() : "999";
            const nMin = parseInt(settings.numMin) || 0;
            const nMax = parseInt(settings.numMax) || 999;
            const labelRegex = /([A-Za-z0-9]+)\s*排\s*(\d+)\s*號/;

            const seatElements = document.querySelectorAll('.seat-available');
            const len = seatElements.length;

            const mouseSettings = { bubbles: true, cancelable: true, view: window, buttons: 1 };
            const mEvent = (type) => new MouseEvent(type, mouseSettings);
            const eEnter = mEvent('mouseenter');
            const eOver  = mEvent('mouseover');
            const eDown  = mEvent('mousedown');
            const eUp    = mEvent('mouseup');
            const eClick = mEvent('click');

            // 智慧解析函式（保持跟新版 inject.js 一致，確保手動 Alt+1 功能精準）
            function parseRowStringToValue(rowStr) {
                if (!rowStr) return 0;
                const str = rowStr.toUpperCase().trim();
                if (str === 'V') return 0;
                if (/^\d+$/.test(str)) return parseInt(str, 10);
                if (/^[A-Z]$/.test(str)) return str.charCodeAt(0) - 64;
                const match = str.match(/^(\d+)([A-Z])$/);
                if (match) {
                    return parseInt(match[1], 10) * 1000 + (match[2].charCodeAt(0) - 64);
                }
                return parseInt(str) || 0;
            }

            const rMinVal = parseRowStringToValue(rMin);
            const rMaxVal = parseRowStringToValue(rMax);

            let found = false;

            for (let i = 0; i < len; i++) {
                const seatSpan = seatElements[i];
                const parent = seatSpan.parentElement;
                if (!parent || !window.angular) continue;

                const scope = window.angular.element(parent).scope();
                if (!scope || !scope.view || !scope.view.label) continue;

                const match = scope.view.label.match(labelRegex);
                if (match) {
                    const rowVal = parseRowStringToValue(match[1]);
                    const numVal = parseInt(match[2], 10);

                    if (rowVal >= rMinVal && rowVal <= rMaxVal && numVal >= nMin && numVal <= nMax) {
                        found = true;
                        
                        seatSpan.style.border = "4px solid #00ff00";
                        seatSpan.scrollIntoView({behavior: "auto", block: "center"});

                        seatSpan.dispatchEvent(eEnter); parent.dispatchEvent(eEnter);
                        seatSpan.dispatchEvent(eOver);  parent.dispatchEvent(eOver);
                        seatSpan.dispatchEvent(eDown);  parent.dispatchEvent(eDown);
                        seatSpan.dispatchEvent(eUp);    parent.dispatchEvent(eUp);
                        seatSpan.dispatchEvent(eClick); parent.dispatchEvent(eClick);

                        logToScreen(`🎉 成功鎖定空位並觸發彈窗: ${scope.view.label}`);
                        
                        window.dispatchEvent(new CustomEvent("KKTIX_BOT_SUCCESS", { 
                            detail: { label: scope.view.label } 
                        }));
                        
                        break; 
                    }
                }
            }

            if (!found) {
                logToScreen(`⏳ 設定範圍 [排:${rMin}-${rMax}, 號:${nMin}-${nMax}] 內無可用空位...`);
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

            if (!isBotEnabled) {
                if (seatScanTimer) {
                    clearInterval(seatScanTimer);
                    seatScanTimer = null;
                    logToScreen("🛑 搶票模式已關閉，立刻停止選位掃描！");
                }
                return; 
            }

            const isSeatMapPage = document.querySelector('.svg-seat-map') || document.querySelector('.seat-available');

            // === A. 選位圖邏輯 ===
            if (isSeatMapPage) {
                if (!seatScanTimer && settings.seatMode === 'manual' && settings.enableSeatMapClick) {
                    triggerSeatPick(settings);
                }
                
                const confirmBuyBtn = document.querySelector('a[ng-click*="buy"][class*="btn-primary"]');
                if (confirmBuyBtn && !confirmBuyBtn.classList.contains('disabled')) {
                    logToScreen("💰 [選位圖] 自動點擊購買！");
                    confirmBuyBtn.click();
                    
                    reportBotDisabled();
                    if (seatScanTimer) {
                        clearInterval(seatScanTimer);
                        seatScanTimer = null;
                    }
                    logToScreen("🎉 [安全自停] 已成功按下購買，全功能已同步關閉，請安心結帳！");
                }
                return; 
            } else {
                if (seatScanTimer) {
                    clearInterval(seatScanTimer);
                    seatScanTimer = null;
                    logToScreen("📍 離開選位圖，停止掃描");
                }
            }

            // === B. 購票/驗證邏輯 ===
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
    }, 200); 
}

// ==========================================
// 邏輯：選位圖 (智慧字母相容傳遞版)
// ==========================================
function triggerSeatPick(settings, isForce = false) {
    if (!isForce && !settings.enableSeatMapClick) return;
    if (seatScanTimer) clearInterval(seatScanTimer);
   
    // 修正點：移除前面的 parseInt，保留字串原文（如 A、1H 等），直接整包空運丟給 inject.js 解析
    const rMin = (settings.rowMin !== undefined && settings.rowMin !== "") ? settings.rowMin.toString().trim() : "0";
    const rMax = (settings.rowMax !== undefined && settings.rowMax !== "") ? settings.rowMax.toString().trim() : "999";
    const nMin = parseInt(settings.numMin) || 0;
    const nMax = parseInt(settings.numMax) || 999;

    logToScreen(`🚀 啟動座位掃描: ${rMin}-${rMax}排, ${nMin}-${nMax}號`);

    let attempts = 0;
    seatScanTimer = setInterval(() => {
        if (!isBotEnabled) {
            clearInterval(seatScanTimer);
            seatScanTimer = null;
            return;
        }

        attempts++;
        
        const seat = document.querySelector('.seat-available');
        if (seat) {
            // 完美對接：發送訊息給新版 inject.js
            window.dispatchEvent(new CustomEvent("KKTIX_BOT_EXECUTE", {
                detail: { rMin: rMin, rMax: rMax, nMin: nMin, nMax: nMax }
            }));
        } else {
            if(attempts % 20 === 0) logToScreen("⏳ 尋找座位中...");
        }

        const buyBtn = document.querySelector('a[ng-click*="buy"]');
        if (buyBtn && !buyBtn.classList.contains('disabled') && !buyBtn.classList.contains('ng-hide')) {
             buyBtn.click();
             
             reportBotDisabled();
             clearInterval(seatScanTimer);
             seatScanTimer = null;
             logToScreen("🎉 [安全自停] 偵測到獨立按鈕已點擊，全功能關閉！");
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
// 邏輯：票種選擇
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
                if (input.value != settings.count) {
                    logToScreen(`✅ 鎖定: ${nameText.trim()}`);
                    input.focus();
                    input.value = settings.count;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }

                const agreeCheck = document.querySelector('#person_agree_terms');
                if (agreeCheck && !agreeCheck.checked) agreeCheck.click();

                clickNextStepButtons(settings.seatMode);
                return; 
            }
        }
    }

    if (!targetFound) {
        if (settings.forceSubmit) {
            window.isSubmitting = true; 
            clickNextStepButtons(settings.seatMode);
        }
        
        if (settings.autoRefresh && !window.isRefreshed) {
            const kktixLoading = document.querySelector('.loading:not([class*="rc-"]), .loading-mask, .processing');
            if (window.isSubmitting || kktixLoading) {
                logToScreen("⏳ 票券送出中 / 正在查詢空位，暫停自動重新整理...");
                return; 
            }

            window.isRefreshed = true;
            logToScreen("🔄 尚未開賣或無票，執行刷新...");
            setTimeout(() => location.reload(), 1000);
        }
    }
}

function clickNextStepButtons(mode) {
    window.isSubmitting = true; 

    window.dispatchEvent(new CustomEvent("KKTIX_BOT_TRIGGER_NEXT", {
        detail: { mode: mode }
    }));

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