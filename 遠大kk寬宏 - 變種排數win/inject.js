// inject.js (v9.7 - 支援全英文字母、數字與複合排數極速版)
(function() {
    // 1. 監聽：選位圖點座位 (全自動功能使用)
    window.addEventListener("KKTIX_BOT_EXECUTE", function(event) {
        const d = event.detail;
        findAndClickRange(d.rMin, d.rMax, d.nMin, d.nMax);
    });

    // 2. 監聽：下一步按鈕 (電腦配位/自行選位)
    window.addEventListener("KKTIX_BOT_TRIGGER_NEXT", function(event) {
        if (!window.angular) return;

        const mode = event.detail.mode; 
        const area = document.querySelector('.register-new-next-button-area');

        if (area) {
            const scope = window.angular.element(area).scope();
            if (scope) {
                if (mode === 'computer') {
                    console.log("⚡ [Inject] 極速觸發：電腦配位");
                    scope.challenge(1);
                } else if (mode === 'manual') {
                    console.log("⚡ [Inject] 極速觸發：自行選位");
                    scope.challenge();
                }
                
                if(scope.$root && scope.$root.$$phase !== '$apply' && scope.$root.$$phase !== '$digest') {
                     scope.$apply();
                }
            }
        }
    });

    // --- 內部智慧排數轉換函數 ---
    function parseRowStringToValue(rowStr) {
        if (!rowStr) return 0;
        const str = rowStr.toUpperCase().trim();

        // 1. V 排或字母 V 視為 0
        if (str === 'V') return 0;

        // 2. 純數字排 (ex: "37", "5")
        if (/^\d+$/.test(str)) {
            return parseInt(str, 10);
        }

        // 3. 純英文字母排 (ex: "A", "B", "Z") -> 轉為 A=1, B=2, C=3...
        if (/^[A-Z]$/.test(str)) {
            return str.charCodeAt(0) - 64; // A 是 65, 減 64 等於 1
        }

        // 4. 數字+字母複合排 (ex: "1H", "1A") -> 1A=1001, 1B=1002... (對齊 ticketplus_content 演算法)
        const match = str.match(/^(\d+)([A-Z])$/);
        if (match) {
            const numPart = parseInt(match[1], 10);
            const letterPart = match[2].charCodeAt(0) - 64;
            return numPart * 1000 + letterPart;
        }

        return parseInt(str) || 0;
    }

    // --- 內部函數：尋找並點擊座位 ---
    function findAndClickRange(minRowStr, maxRowStr, minNum, maxNum) {
        if (!window.angular) return;

        // 將設定後台傳過來的文字範圍（可能包含字母）轉換成權重數值進行數值比對
        const rMinVal = parseRowStringToValue(minRowStr);
        const rMaxVal = parseRowStringToValue(maxRowStr);

        const seatElements = document.querySelectorAll('.seat-available');
        
        // 💥 超強升級正則：可匹配 "A排", "1H排", "12排", "V排" 等全類型結構
        const labelRegex = /([A-Za-z0-9]+)\s*排\s*(\d+)\s*號/;

        for (let i = 0; i < seatElements.length; i++) {
            const seatSpan = seatElements[i];
            const parent = seatSpan.parentElement;

            if (parent) {
                const el = window.angular.element(parent);
                const scope = el.scope();

                if (scope && scope.view && scope.view.label) {
                    const label = scope.view.label; 
                    const match = label.match(labelRegex);

                    if (match) {
                        // 解析網頁上這格座位的排數與號碼
                        const rowVal = parseRowStringToValue(match[1]);
                        const numVal = parseInt(match[2], 10);

                        // 進行數值範圍交叉比對
                        if (rowVal >= rMinVal && rowVal <= rMaxVal && 
                            numVal >= minNum && numVal <= maxNum) {
                            
                            console.log(`✅ [Bot] 智慧命中點擊: ${label}`);
                            
                            seatSpan.style.border = "4px solid #00ff00";
                            seatSpan.scrollIntoView({behavior: "auto", block: "center"});

                            if (scope.clickSeatWeb) {
                                scope.clickSeatWeb(scope.view.areaId, scope.view.seatId, scope.view);
                            } else {
                                seatSpan.click();
                            }

                            window.dispatchEvent(new CustomEvent("KKTIX_BOT_SUCCESS", { 
                                detail: { label: label } 
                            }));

                            break; 
                        }
                    }
                }
            }
        }
    }
})();