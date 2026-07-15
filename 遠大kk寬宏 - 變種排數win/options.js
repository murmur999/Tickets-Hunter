// options.js (v9.7 - 新增排數智慧加減微調按鈕邏輯)

document.getElementById('seat_mode').addEventListener('change', function() {
    const manualDiv = document.getElementById('manual_options');
    if (this.value === 'manual') {
        manualDiv.classList.add('show');
    } else {
        manualDiv.classList.remove('show');
    }
});

function save_options() {
    const kktixSettings = {
        priceKeyword: document.getElementById('price_keyword').value,
        typeKeyword: document.getElementById('type_keyword').value,
        direction: document.getElementById('search_direction').value,
        count: document.getElementById('ticket_count').value,
        memberId: document.getElementById('member_id').value,
        autoRefresh: document.getElementById('auto_refresh').checked,
        forceSubmit: document.getElementById('force_submit').checked,
        seatMode: document.getElementById('seat_mode').value,
        enableSeatMapClick: document.getElementById('enable_seat_map_click').checked,
        rowMin: document.getElementById('row_min').value.trim(),
        rowMax: document.getElementById('row_max').value.trim(),
        numMin: document.getElementById('num_min').value,
        numMax: document.getElementById('num_max').value
    };

    chrome.storage.local.set({ kktix_settings: kktixSettings }, function() {
        const status = document.getElementById('status');
        status.textContent = '✅ 設定已儲存！ (請按 Ctrl+B 或 Alt+B 啟動)';
        setTimeout(() => { status.textContent = ''; }, 2500);
    });
}

function restore_options() {
    chrome.storage.local.get({
        kktix_settings: {
            priceKeyword: '', 
            typeKeyword: '', 
            direction: 'top_down', 
            count: '1', 
            memberId: '',
            autoRefresh: false, 
            forceSubmit: false, 
            seatMode: 'computer',
            enableSeatMapClick: false, 
            rowMin: '', 
            rowMax: '', 
            numMin: '', 
            numMax: ''
        }
    }, function(items) {
        const s = items.kktix_settings;
        
        document.getElementById('price_keyword').value = s.priceKeyword || '';
        document.getElementById('type_keyword').value = s.typeKeyword || '';
        document.getElementById('search_direction').value = s.direction || 'top_down';
        document.getElementById('ticket_count').value = s.count || '1';
        document.getElementById('member_id').value = s.memberId || '';
        
        document.getElementById('auto_refresh').checked = !!s.autoRefresh;
        document.getElementById('force_submit').checked = !!s.forceSubmit;
        document.getElementById('seat_mode').value = s.seatMode || 'computer';

        document.getElementById('seat_mode').dispatchEvent(new Event('change'));

        document.getElementById('enable_seat_map_click').checked = !!s.enableSeatMapClick;
        
        document.getElementById('row_min').value = s.rowMin || '';
        document.getElementById('row_max').value = s.rowMax || '';
        document.getElementById('num_min').value = s.numMin || '';
        document.getElementById('num_max').value = s.numMax || '';
    });
}

// ===== 新增：排數智慧加減微調按鈕核心邏輯 =====
function handleRowStep(inputId, direction) {
    const input = document.getElementById(inputId);
    let val = input.value.trim();
    if (!val) {
        input.value = direction === 'up' ? '1' : '1';
        return;
    }

    // 1. 處理純數字格式 (如: 37 -> 38)
    if (/^\d+$/.test(val)) {
        let num = parseInt(val, 10);
        num = direction === 'up' ? num + 1 : num - 1;
        if (num < 0) num = 0;
        input.value = num.toString();
        return;
    }

    // 2. 處理數字+字母格式 (如: 1H -> 1I 或 1A -> 1B)
    const match = val.match(/^(\d+)([A-Za-z])$/);
    if (match) {
        let numPart = match[1];
        let letterPart = match[2];
        let charCode = letterPart.charCodeAt(0);

        if (direction === 'up') {
            // Z 或 z 不再往上加
            if (letterPart !== 'Z' && letterPart !== 'z') charCode++;
        } else {
            // A 或 a 不再往下減
            if (letterPart !== 'A' && letterPart !== 'a') charCode--;
        }
        input.value = numPart + String.fromCharCode(charCode);
        return;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    restore_options();
    document.getElementById('save').addEventListener('click', save_options);

    // 綁定排數微調按鈕事件
    document.getElementById('row_min_up').addEventListener('click', () => handleRowStep('row_min', 'up'));
    document.getElementById('row_min_down').addEventListener('click', () => handleRowStep('row_min', 'down'));
    document.getElementById('row_max_up').addEventListener('click', () => handleRowStep('row_max', 'up'));
    document.getElementById('row_max_down').addEventListener('click', () => handleRowStep('row_max', 'down'));
});