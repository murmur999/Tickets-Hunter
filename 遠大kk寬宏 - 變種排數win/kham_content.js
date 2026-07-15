// kham_content.js (v1.2 - 速度優化 + 懸浮視窗穩定版)
console.log("✅ 寬宏售票 KHAM Bot v1.2 (高速版) 已載入");

let debugBox = null;
let isBotEnabled = true;

// 穩定版懸浮視窗
function createDebugBox() {
    if (debugBox && document.body.contains(debugBox)) return debugBox;
    
    debugBox = document.createElement('div');
    debugBox.style.cssText = `
        position:fixed; top:15px; right:15px; width:360px; background:rgba(0,0,0,0.95); 
        color:#00ff9d; z-index:2147483647; font-size:13.8px; padding:12px; border-radius:8px; 
        font-family:monospace; border:2px solid #00ff9d; box-shadow:0 0 15px rgba(0,255,157,0.6);
        pointer-events:none; max-height:70vh; overflow-y:auto; line-height:1.45; 
        user-select:none;`;
    document.documentElement.appendChild(debugBox);  // 改用 documentElement 更穩定
    return debugBox;
}

function logToScreen(msg) {
    const box = createDebugBox();
    const time = new Date().toLocaleTimeString('zh-TW', {hour12: false});
    const entry = `[${time}] ${msg}<br>`;
    
    // 保留最近15筆
    let html = box.innerHTML || '';
    const lines = html.split('<br>').slice(0, 14);
    box.innerHTML = entry + lines.join('<br>');
}

function simulateClick(el) {
    if (!el) return false;
    el.scrollIntoView({ behavior: "instant", block: "center" });
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
}

// ==================== 主邏輯 ====================
async function initializeKham() {
    const data = await chrome.storage.local.get(["kktix_settings", "botEnabled"]);
    const settings = data.kktix_settings || {};
    isBotEnabled = data.botEnabled !== false;

    if (!isBotEnabled) {
        logToScreen("🔴 Bot 已關閉");
        return;
    }

    logToScreen(`🚀 KHAM 高速模式啟動 | 票種:${settings.typeKeyword || '無'} | 票價:${settings.priceKeyword || '無'}`);

    // 立即開始掃描
    scanTicketAreas(settings);
}

// 高速掃描票區
function scanTicketAreas(settings) {
    const typeKey = (settings.typeKeyword || "").toLowerCase().trim();
    const priceKey = (settings.priceKeyword || "").toLowerCase().trim();

    const rows = document.querySelectorAll('tr.status_tr');
    
    for (let row of rows) {
        const fullText = row.textContent.toLowerCase();
        const matchType = !typeKey || fullText.includes(typeKey);
        const matchPrice = !priceKey || fullText.includes(priceKey);

        if (matchType && matchPrice) {
            const isSoldout = row.classList.contains('Soldout') || fullText.includes('已售完');
            logToScreen(`🎯 命中${isSoldout ? '(已售完仍點)' : ''} → ${row.textContent.trim().substring(0,55)}`);
            
            simulateClick(row);
            setTimeout(() => selectBuyType(settings), 450);  // 加速
            return;
        }
    }

    // 沒找到就快速重試
    logToScreen(`⏳ 掃描中... (${rows.length} 個票區)`);
    if (settings.autoRefresh) {
        setTimeout(() => location.reload(), 900);
    } else {
        setTimeout(() => scanTicketAreas(settings), 600);
    }
}

function selectBuyType(settings) {
    const isManual = settings.seatMode === 'manual';
    const btnId = isManual ? 'BUY_TYPE_1' : 'BUY_TYPE_2';
    const btn = document.getElementById(btnId);

    if (btn) {
        logToScreen(`⚡ 點擊 ${isManual ? '自行選位' : '電腦配位'}`);
        simulateClick(btn);
        setTimeout(() => monitorFinalStep(settings), 500);
    } else {
        logToScreen("⚠️ BUY_TYPE 按鈕未出現，繼續監聽...");
        setTimeout(() => selectBuyType(settings), 400);
    }
}

function monitorFinalStep(settings) {
    if (settings.memberId) {
        document.querySelectorAll('input').forEach(input => {
            if (!input.value && (input.placeholder || '').includes('序號') || (input.name || '').includes('code')) {
                input.value = settings.memberId;
                input.dispatchEvent(new Event('input', {bubbles:true}));
                logToScreen("✅ 填入會員/序號");
            }
        });
    }

    const agree = document.querySelector('input[type="checkbox"]');
    if (agree && !agree.checked) {
        simulateClick(agree);
    }
}

// 持續監控（更頻繁）
setInterval(() => {
    chrome.storage.local.get("botEnabled", (d) => {
        if (d.botEnabled !== isBotEnabled) {
            isBotEnabled = d.botEnabled;
            if (isBotEnabled) initializeKham();
        }
    });
}, 800);

// 頁面載入後立即執行
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeKham);
} else {
    initializeKham();
}

// 狀態監聽
chrome.runtime.onMessage.addListener((req) => {
    if (req.action === "TOGGLE_STATE") {
        logToScreen(req.state ? "🟢 KHAM Bot 已開啟" : "🔴 KHAM Bot 已關閉");
    }
});