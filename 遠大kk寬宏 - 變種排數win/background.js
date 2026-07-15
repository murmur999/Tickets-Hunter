// background.js (v10.8 - 新增外部自停狀態連動同步版)
console.log("✅ 背景服務 v10.8 已啟動");

chrome.commands.onCommand.addListener((command) => {
    if (command === "toggle-bot") {
        chrome.storage.local.get("botEnabled", (data) => {
            const newState = !data.botEnabled;
            chrome.storage.local.set({ botEnabled: newState });

            updateBadge(newState);

            // 嘗試直接發送訊息給 Content Script
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0] && tabs[0].id) {
                    const url = tabs[0].url || "";
                    if (url.includes("kktix") || url.includes("ticketplus")) {
                         chrome.tabs.sendMessage(tabs[0].id, { 
                             action: "TOGGLE_STATE", 
                             state: newState 
                         }).catch(() => {
                             console.log("🔄 無法連接腳本，執行重整...");
                             chrome.tabs.reload(tabs[0].id);
                         });
                    }
                }
            });
        });
    }
});

// ===== 新增：接聽來自 kktix_content.js 的強制自停通知 =====
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "FORCE_BADGE_OFF") {
        console.log("🛑 接收到前台自停通知，強制刷新圖示狀態為 OFF");
        updateBadge(false);
    }
});

function updateBadge(isEnabled) {
    chrome.action.setBadgeText({ text: isEnabled ? "ON" : "OFF" });
    chrome.action.setBadgeBackgroundColor({ color: isEnabled ? "#009688" : "#d9534f" });
}

// 初始化
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ botEnabled: false });
    updateBadge(false);
});

chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.get("botEnabled", (data) => {
        updateBadge(data.botEnabled || false);
    });
});