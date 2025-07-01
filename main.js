// --- 定数 ---
const DEFAULT_TARGET_DAYS = 30;
const DEFAULT_TARGET_CURRENCY = 500000;
const QUICK_BTN_NUM = 5;
const QUICK_BTN_TEMPLATE = [
  { label: "デイリー", amount: 60 },
  { label: "課金パス", amount: 90 },
  { label: "クリア", amount: 50 },
  { label: "アチーブメント", amount: 5 },
  { label: "配布", amount: 100 }
];
const STORAGE_KEY = "gachaDataV3Slots";
const SLOT_MAX = 3;
const HISTORY_DISPLAY_LIMIT = 10; // 表示は最新10件

// --- グラフ用 ---
let currencyChart = null;

// --- multi-slotデータ構造 ---
function getEmptySlot(idx) {
  return {
    label: `データ${idx + 1}`,
    data: {
      startDate: "",
      currentCurrency: 0,
      targetDate: "",
      targetCurrency: "",
      quickBtns: QUICK_BTN_TEMPLATE,
      history: [],
      currencyLabel: "通貨"
    }
  };
}
function getEmptySlots() {
  return {
    slots: [0, 1, 2].map(i => getEmptySlot(i)),
    activeSlot: 0,
    settings: {
      showGraph: true,
      showHistory: true,
      darkMode: false
    }
  };
}

// --- 利用規約同意管理 ---
function checkTermsConsent() {
  return localStorage.getItem("gachaTermsConsent") === "true";
}

// --- cookie同意管理 ---
function showCookieDialog(show) {
  const dialog = document.getElementById("cookieDialog");
  if (dialog) {
    if (show) {
      dialog.classList.remove("hidden");
      dialog.removeAttribute("aria-hidden");
    } else {
      dialog.classList.add("hidden");
      dialog.setAttribute("aria-hidden", "true");
    }
  }
  const mainArea = document.getElementById("mainArea");
  if (mainArea) {
    if (show) {
      mainArea.classList.add("disabled-area");
    } else {
      mainArea.classList.remove("disabled-area");
    }
  }
}
function checkCookieConsent() {
  return localStorage.getItem("gachaCookieConsent") === "true";
}
function setCookieConsentHandlers() {
  const btn = document.getElementById("cookieConsentBtn");
  if (btn) {
    btn.onclick = function() {
      const cookieChecked = document.getElementById("cookieConsentCheck").checked;
      
      if (!cookieChecked) {
        alert("利用規約、Cookie利用への同意が必要です");
        return;
      }
      
      localStorage.setItem("gachaTermsConsent", "true");
      localStorage.setItem("gachaCookieConsent", "true");
      showCookieDialog(false);
      initialDisplay();
      if (getSessionPrevCurrency() === null) {
        initSessionPrevCurrency();
      }
    };
  }
}

// --- multi-slotデータ操作 ---
function saveSlots(slotsObj) {
  if (checkCookieConsent()) localStorage.setItem(STORAGE_KEY, JSON.stringify(slotsObj));
}
function loadSlots() {
  if (!checkCookieConsent()) return getEmptySlots();
  const d = localStorage.getItem(STORAGE_KEY);
  if (d) {
    let parsed = JSON.parse(d);
    if (!Array.isArray(parsed.slots) || parsed.slots.length < SLOT_MAX) {
      parsed = getEmptySlots();
    }
    parsed.slots = parsed.slots.map((s, i) =>
      (typeof s === "object" && s.label && s.data)
        ? s
        : getEmptySlot(i)
    );
    if (typeof parsed.activeSlot !== "number" || parsed.activeSlot < 0 || parsed.activeSlot >= SLOT_MAX) {
      parsed.activeSlot = 0;
    }
    // currencyLabelが未設定の古いデータ用
    parsed.slots.forEach(slot => {
      if (!slot.data.currencyLabel) slot.data.currencyLabel = "通貨";
    });
    // settingsが未設定の場合のデフォルト値
    if (!parsed.settings) {
      parsed.settings = { showGraph: true, showHistory: true, darkMode: false };
    }
    if (typeof parsed.settings.darkMode === 'undefined') {
      parsed.settings.darkMode = false;
    }
    return parsed;
  }
  return getEmptySlots();
}
function getActiveSlotIdx() {
  return loadSlots().activeSlot;
}
function getActiveSlotObj() {
  const slotsObj = loadSlots();
  return slotsObj.slots[slotsObj.activeSlot];
}
function getActiveData() {
  return getActiveSlotObj().data;
}
function setActiveData(newData) {
  const slotsObj = loadSlots();
  slotsObj.slots[slotsObj.activeSlot].data = newData;
  saveSlots(slotsObj);
}
function setSlotLabel(idx, label) {
  const slotsObj = loadSlots();
  slotsObj.slots[idx].label = label;
  saveSlots(slotsObj);
}
function setActiveSlot(idx) {
  const slotsObj = loadSlots();
  slotsObj.activeSlot = idx;
  saveSlots(slotsObj);
}

// --- セッションで前回値を保持(スロットごと) ---
function getSessionPrevCurrency() {
  const idx = getActiveSlotIdx();
  const val = sessionStorage.getItem(`gachaPrevCurrency${idx}`);
  return val !== null ? Number(val) : null;
}
function setSessionPrevCurrency(val) {
  const idx = getActiveSlotIdx();
  sessionStorage.setItem(`gachaPrevCurrency${idx}`, String(val));
}
function clearSessionPrevCurrency() {
  for (let i = 0; i < SLOT_MAX; ++i) {
    sessionStorage.removeItem(`gachaPrevCurrency${i}`);
  }
}
function initSessionPrevCurrency() {
  const data = getActiveData();
  if (data.history && data.history.length > 0) {
    setSessionPrevCurrency(data.history[data.history.length-1].currency);
  } else {
    setSessionPrevCurrency(data.currentCurrency || 0);
  }
}

// --- スロット切り替えUI ---
function renderSlotSwitcher() {
  const { slots, activeSlot } = loadSlots();
  const switcher = document.getElementById("slotSwitcher");
  switcher.innerHTML = "";
  slots.forEach((slot, idx) => {
    const btn = document.createElement("button");
    btn.className = "slot-btn" + (activeSlot === idx ? " active" : "");
    btn.type = "button";
    btn.setAttribute("data-slot", idx);

    // ラベル
    const labelSpan = document.createElement("span");
    labelSpan.className = "slot-label";
    labelSpan.textContent = slot.label;
    labelSpan.title = slot.label;
    btn.appendChild(labelSpan);

    // データ切替
    btn.onclick = function() {
      if (getActiveSlotIdx() !== idx) {
        setActiveSlot(idx);
        initialDisplay();
        if (getSessionPrevCurrency() === null) {
          initSessionPrevCurrency();
        }
      }
    };
    switcher.appendChild(btn);
  });
}

// --- 設定モーダル管理 ---
let currentSettingsTab = 'data';

// 設定ボタンクリック
document.getElementById("settingsBtn").onclick = function() {
  openSettingsModal();
};

// Q&Aボタンクリック
document.getElementById("qaBtn").onclick = function() {
  openQaModal();
};

// 設定モーダルを開く
function openSettingsModal() {
  const modal = document.getElementById("settingsModal");
  modal.classList.add("show");
  modal.classList.remove("hidden");
  document.querySelector(".modal-backdrop").classList.remove("hidden");
  
  renderDataSlotList();
  loadGeneralSettings();
  switchTab(currentSettingsTab);
}

// 設定モーダルを閉じる
function closeSettingsModal() {
  const modal = document.getElementById("settingsModal");
  modal.classList.remove("show");
  setTimeout(() => {
    modal.classList.add("hidden");
    document.querySelector(".modal-backdrop").classList.add("hidden");
  }, 280);
}

// タブ切り替え
function switchTab(tabName) {
  currentSettingsTab = tabName;
  
  // タブボタンの状態更新
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  
  // タブコンテンツの表示切り替え
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('hidden', content.id !== tabName + 'Tab');
  });
}

// データスロット一覧を描画
function renderDataSlotList() {
  const { slots } = loadSlots();
  const container = document.getElementById('dataSlotList');
  container.innerHTML = '';
  
  slots.forEach((slot, idx) => {
    const item = document.createElement('div');
    item.className = 'data-slot-item';
    item.innerHTML = `
      <div class="data-slot-header">
        <span class="data-slot-name">${slot.label}</span>
        <div class="data-slot-actions">
          <button type="button" onclick="editSlotSettings(${idx})">編集</button>
          <button type="button" onclick="resetSlotConfirm(${idx})" class="reset-btn">リセット</button>
        </div>
      </div>
      <div class="data-slot-info">
        開始日: ${slot.data.startDate || '未設定'}<br>
        現在の${slot.data.currencyLabel || '通貨'}: ${slot.data.currentCurrency || 0}
      </div>
    `;
    container.appendChild(item);
  });
}

// スロット設定編集
function editSlotSettings(idx) {
  closeSettingsModal();
  openSlotSettingsModal(idx);
}

// スロットリセット確認
function resetSlotConfirm(idx) {
  const slot = loadSlots().slots[idx];
  if (confirm(`「${slot.label}」をリセットします。よろしいですか？`)) {
    resetSlot(idx);
    renderDataSlotList();
  }
}

// タブボタンのイベントリスナー
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.onclick = () => switchTab(btn.dataset.tab);
});

// 設定モーダル閉じるボタン
document.getElementById('closeSettingsModal').onclick = closeSettingsModal;

// 全般設定の保存
document.getElementById('saveGeneralSettings').onclick = function() {
  const slotsObj = loadSlots();
  slotsObj.settings = {
    showGraph: document.getElementById('showGraphSetting').checked,
    showHistory: document.getElementById('showHistorySetting').checked,
    darkMode: document.getElementById('darkModeSetting').checked
  };
  saveSlots(slotsObj);
  applyDisplaySettings(slotsObj.settings);
  alert('設定を保存しました！');
};

// 表示設定を適用
function applyDisplaySettings(settings) {
  const graphArea = document.querySelector('.graph-area');
  const historyArea = document.querySelector('.history-area');
  
  if (graphArea) {
    graphArea.style.display = settings.showGraph ? 'block' : 'none';
  }
  if (historyArea) {
    historyArea.style.display = settings.showHistory ? 'block' : 'none';
  }
  
  // ダークモード適用
  if (settings.darkMode) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
}

// 設定モーダルを開く時に全般設定を読み込み
function loadGeneralSettings() {
  const slotsObj = loadSlots();
  const settings = slotsObj.settings || { showGraph: true, showHistory: true, darkMode: false };
  
  document.getElementById('showGraphSetting').checked = settings.showGraph;
  document.getElementById('showHistorySetting').checked = settings.showHistory;
  document.getElementById('darkModeSetting').checked = settings.darkMode;
  
  applyDisplaySettings(settings);
}

// --- データ個別設定モーダルロジック ---
function openSlotSettingsModal(idx) {
  // すでに同じスロットの設定が開いてたら閉じる（トグル動作）
  const modal = document.getElementById("slotSettingsModal");
  if (
    modal.classList.contains("show") &&
    currentSettingsModalSlot === idx
  ) {
    closeSlotSettingsModal();
    return;
  }
  currentSettingsModalSlot = idx;

  const slotsObj = loadSlots();
  const slot = slotsObj.slots[idx];

  // アニメーション用クラス付け替え
  modal.classList.add("show");
  modal.classList.remove("hidden");
  document.querySelector(".modal-backdrop").classList.remove("hidden");
  // modal.focus(); ← スクロール防止のため削除

  // ラベル初期値
  document.getElementById("slotSettingsLabelInput").value = slot.label;
  // 通貨ラベル初期値
  document.getElementById("slotSettingsCurrencyInput").value = slot.data.currencyLabel || "通貨";
  // 即時入力ボタン初期値
  const quickBtns = slot.data.quickBtns || QUICK_BTN_TEMPLATE;
  let html = "";
  for (let i = 0; i < QUICK_BTN_NUM; i++) {
    html += `
      <div class="input-row">
        <input type="text" id="slotSetQLabel${i}" value="${quickBtns[i]?.label || ""}" placeholder="ラベル" maxlength="7">
        <input type="number" id="slotSetQAmount${i}" value="${quickBtns[i]?.amount || ""}" placeholder="数">
      </div>
    `;
  }
  document.getElementById("slotSettingsQuickBtnsForm").innerHTML = html;

  // 保存ボタン
  document.getElementById("slotSettingsQuickBtnsSave").onclick = function() {
    const btns = [];
    for (let i = 0; i < QUICK_BTN_NUM; i++) {
      let label = document.getElementById("slotSetQLabel" + i).value || `ボタン${i + 1}`;
      if (label.length > 7) label = label.slice(0, 7);
      btns.push({
        label: label,
        amount: Number(document.getElementById("slotSetQAmount" + i).value) || 1,
      });
    }
    slotsObj.slots[idx].data.quickBtns = btns;
    saveSlots(slotsObj);
    if (getActiveSlotIdx() === idx) {
      renderQuickBtns(btns);
    }
    alert("即時入力ボタンを保存しました");
  };

  // ラベル保存
  document.getElementById("slotSettingsLabelInput").onchange = function() {
    let v = this.value.trim();
    if (!v) v = `データ${idx + 1}`;
    slotsObj.slots[idx].label = v;
    saveSlots(slotsObj);
    renderSlotSwitcher();
  };

  // 通貨ラベル保存
  document.getElementById("slotSettingsCurrencyInput").onchange = function() {
    let v = this.value.trim();
    if (!v) v = "通貨";
    if (v.length > 8) v = v.slice(0, 8);
    slotsObj.slots[idx].data.currencyLabel = v;
    saveSlots(slotsObj);
    if (getActiveSlotIdx() === idx) {
      // アクティブスロットの場合は表示を更新
      const label = v;
      document.getElementById("currencyLabelInput").value = label;
      document.getElementById("targetCurrencyLabel").textContent = label;
      document.getElementById("currentCurrencyLabel").textContent = label;
      document.getElementById("settingsCurrentCurrencyLabel").textContent = label;
      document.getElementById("historyAmountLabel").textContent = label + "数";
      renderStatus(getActiveData());
    }
  };

  // データリセット
  document.getElementById("slotSettingsResetBtn").onclick = function() {
    if (confirm(`「${slot.label}」をリセットします。よろしいですか？`)) {
      resetSlot(idx);
      closeSlotSettingsModal();
    }
  };
}

// モーダルの閉じる
function closeSlotSettingsModal() {
  const modal = document.getElementById("slotSettingsModal");
  if (!modal.classList.contains("show")) return;
  modal.classList.remove("show");
  // アニメーション後にhidden
  setTimeout(() => {
    modal.classList.add("hidden");
    document.querySelector(".modal-backdrop").classList.add("hidden");
  }, 280); // CSSと揃える
  currentSettingsModalSlot = null;
}
document.getElementById("closeSlotSettingsModal").onclick = closeSlotSettingsModal;

// ESCでも閉じる
document.addEventListener("keydown", function(e){
  if(e.key === "Escape"){
    closeSlotSettingsModal();
    closeSettingsModal();
    closeCalcModal();
    closeQaModal();
    showEditTargetCurrencyPanel(false);
    showEditTargetDatePanel(false);
  }
});

// --- Q&Aモーダル ---
function openQaModal() {
  const modal = document.getElementById("qaModal");
  modal.classList.add("show");
  modal.classList.remove("hidden");
  document.querySelector(".modal-backdrop").classList.remove("hidden");
}

function closeQaModal() {
  const modal = document.getElementById("qaModal");
  modal.classList.remove("show");
  setTimeout(() => {
    modal.classList.add("hidden");
    document.querySelector(".modal-backdrop").classList.add("hidden");
  }, 280);
}

document.getElementById("closeQaModal").onclick = closeQaModal;

// X連絡ボタン
document.getElementById("contactTwitterBtn").onclick = function() {
  const twitterUrl = "https://twitter.com/SamoPrs54805";
  window.open(twitterUrl, "_blank");
};

// 使い方ガイドボタン
document.getElementById("usageGuideBtn").onclick = function() {
  const guideUrl = "https://note.com/preview/n4548ff95fac3?prev_access_key=8e2566085f72f683dbeee5ef620b9c5f";
  window.open(guideUrl, "_blank");
};

// すべてリセット
function resetSlot(idx) {
  const slotsObj = loadSlots();
  slotsObj.slots[idx] = getEmptySlot(idx);
  saveSlots(slotsObj);
  if (getActiveSlotIdx() === idx) {
    initialDisplay();
    setSessionPrevCurrency(0);
  }
  renderSlotSwitcher();
}
function resetAll() {
  localStorage.removeItem(STORAGE_KEY);
  clearSessionPrevCurrency();
  initialDisplay();
  renderSlotSwitcher();
}
document.getElementById("resetAllBtn").onclick = function() {
  // スロットラベル一覧取得
  const slotsObj = loadSlots();
  const labelList = slotsObj.slots.map((slot, idx) => slot.label || `データ${idx+1}`).join("、");
  if (confirm(`「${labelList}」すべて削除しますか？`)) {
    resetAll();
  }
};

// --- 日付関連ユーティリティ ---
function getTodayString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysBetween(start, end) {
  return Math.floor((end - start) / (1000 * 60 * 60 * 24));
}
function daysBetweenYMD(ymd1, ymd2) {
  const d1 = new Date(ymd1 + "T00:00:00");
  const d2 = new Date(ymd2 + "T00:00:00");
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
}

// --- 設定フォーム表示制御 ---
function showSettingsForm(show) {
  const area = document.getElementById("settingsFormArea");
  if (area) area.classList.toggle("hidden", !show);
}

// --- 状態表示 ---
function renderStatus(data) {
  const label = data.currencyLabel || "通貨";
  if (!data.startDate) {
    document.getElementById("statusArea").innerHTML = "開始日を設定してください。";
    renderCurrencyGraph([]); // グラフも空に
    renderHistoryTable([]);
    return;
  }

  // 目標日付: 空欄なら空欄のまま
  let targetDate = data.targetDate || "";
  let targetCurrency = data.targetCurrency;
  const startAmount = data.history.length ? data.history[0].currency : data.currentCurrency;
  const todayStr = getTodayString();

  // 経過日数
  const daysPassed = daysBetweenYMD(data.startDate, todayStr);

  // 目標までの日数
  const toTargetDate = targetDate ? daysBetweenYMD(todayStr, targetDate) : "-";
  const toTargetCurrency = targetCurrency ? Math.max(0, targetCurrency - data.currentCurrency) : "-";

  // 追加: 毎日いくつ集めれば達成？（両方入力時のみ）
  let perDayMsg = "";
  if (targetDate && targetCurrency && toTargetDate > 0 && toTargetCurrency > 0) {
    const perDay = Math.ceil(toTargetCurrency / toTargetDate);
    perDayMsg = `<div style="color:#2563eb;font-weight:600;">
      ※目標まで毎日あと<strong>${perDay}</strong>${label}集めれば達成！
    </div>`;
  }

  const targetCurrencyDisplay = targetCurrency ? `${targetCurrency}（あと${toTargetCurrency}）` : "-";
  const targetDateDisplay = targetDate ? `${targetDate}（あと${toTargetDate}日）` : "-";

  document.getElementById("statusArea").innerHTML = `
    <div><strong>経過日数:</strong> ${daysPassed}日</div>
    <div><strong>現在の${label}数:</strong> ${data.currentCurrency}</div>
    <div><strong>開始日からの増加量:</strong> ${data.currentCurrency - startAmount}</div>
    <div><strong>目標${label}数:</strong> ${targetCurrencyDisplay}</div>
    <div><strong>目標日付:</strong> ${targetDateDisplay}</div>
    ${perDayMsg}
    ${
      (targetCurrency && targetDate && toTargetCurrency === 0 && toTargetDate <= 0)
      ? "<span style='color:green;font-weight:bold;'>目標達成！</span>" : ""
    }
  `;

  renderCurrencyGraph(data.history || []);
  renderHistoryTable(data.history || []);
}

// --- グラフ描画 ---
function renderCurrencyGraph(history) {
  const ctx = document.getElementById('currencyChart').getContext('2d');
  if (currencyChart) { currencyChart.destroy(); }
  
  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { 
      legend: { display: false },
      tooltip: {
        mode: 'index',
        intersect: false
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    },
    elements: {
      point: {
        radius: 3,
        hoverRadius: 6
      }
    }
  };
  
  if (!history || history.length === 0) {
    // データがない場合はプレースホルダーを表示
    const canvas = document.getElementById('currencyChart');
    const parent = canvas.parentElement;
    
    // 既存のプレースホルダーを削除
    const existingPlaceholder = parent.querySelector('.graph-placeholder');
    if (existingPlaceholder) {
      existingPlaceholder.remove();
    }
    
    // プレースホルダーを作成
    const placeholder = document.createElement('div');
    placeholder.className = 'graph-placeholder';
    placeholder.innerHTML = `
      <div class="placeholder-icon">📊</div>
      <div class="placeholder-text">データを記録するとグラフが表示されます</div>
      <div class="placeholder-subtext">通貨数を入力して記録を開始しましょう</div>
    `;
    
    canvas.style.display = 'none';
    parent.appendChild(placeholder);
    return;
  }
  
  // データがある場合はcanvasを表示してプレースホルダーを削除
  const canvas = document.getElementById('currencyChart');
  const parent = canvas.parentElement;
  const existingPlaceholder = parent.querySelector('.graph-placeholder');
  if (existingPlaceholder) {
    existingPlaceholder.remove();
  }
  canvas.style.display = 'block';
  
  const label = getActiveData().currencyLabel || "通貨";
  
  // グラフの色をダークモードに応じて調整
  const isDarkMode = document.body.classList.contains('dark-mode');
  const borderColor = isDarkMode ? '#a855f7' : '#2563eb';
  const backgroundColor = isDarkMode ? 'rgba(168, 85, 247, 0.15)' : 'rgba(37, 99, 235, 0.18)';
  const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
  
  currencyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: history.map(h => {
        const date = h.date;
        if (date && date.includes('-')) {
          const parts = date.split('-');
          return `${parts[1]}/${parts[2]}`; // MM/DD形式
        }
        return date;
      }),
      datasets: [{
        label: label + '数',
        data: history.map(h => h.currency),
        borderColor: borderColor,
        backgroundColor: backgroundColor,
        fill: true,
        tension: 0.18,
        borderWidth: 2
      }]
    },
    options: {
      ...commonOptions,
      scales: {
        x: { 
          title: { display: true, text: '日付' },
          grid: { display: false }
        },
        y: { 
          title: { display: true, text: label + '数' }, 
          beginAtZero: true,
          grid: { color: gridColor }
        }
      }
    }
  });
}

// --- 履歴テーブル描画 ---
function renderHistoryTable(history) {
  const tbody = document.getElementById("historyTable").querySelector("tbody");
  tbody.innerHTML = "";
  if (!history || !history.length) return;

  const label = getActiveData().currencyLabel || "通貨";
  document.getElementById("historyAmountLabel").textContent = label + "数";

  const showList = history.slice(-HISTORY_DISPLAY_LIMIT).reverse();

  showList.forEach((entry, idx) => {
    const realIdx = history.length - 1 - idx;
    let delta = "-";
    if (idx < showList.length - 1) {
      const prev = showList[idx + 1];
      if (prev) {
        const diff = entry.currency - prev.currency;
        delta = diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : "±0";
      }
    }
    const isLatest = (idx === 0);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${entry.date || ""}</td>
      <td>${entry.currency}</td>
      <td>${delta}</td>
      <td style="display:flex;align-items:center;gap:0.2em;">
        <input class="memo-input" type="text" value="${entry.memo||""}" data-idx="${realIdx}" placeholder="メモを入力">
        ${isLatest
          ? `<button type="button" class="undo-btn" data-idx="${realIdx}" title="この履歴を取り消す">取消</button>`
          : ""}
      </td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll(".memo-input").forEach(input => {
    input.addEventListener("change", function() {
      const idx = Number(this.dataset.idx);
      const data = getActiveData();
      data.history[idx].memo = this.value;
      setActiveData(data);
    });
  });
  tbody.querySelectorAll(".undo-btn").forEach(btn => {
    btn.addEventListener("click", function() {
      const idx = Number(this.dataset.idx);
      const data = getActiveData();
      if (idx !== data.history.length - 1) {
        alert("一番新しい履歴しか取り消せません。");
        return;
      }
      if (!confirm("この最新の履歴を取り消しますか？")) return;
      data.history.pop();
      if (data.history.length) {
        data.currentCurrency = data.history[data.history.length - 1].currency;
      }
      setActiveData(data);
      document.getElementById("currentCurrency").value = data.currentCurrency;
      renderStatus(data);
    });
  });
}

// --- データのロードとフォーム初期化 ---
function initialDisplay() {
  // 利用規約とcookie同意の両方をチェック
  if (!checkTermsConsent() || !checkCookieConsent()) {
    showCookieDialog(true);
    setCookieConsentHandlers();
    return;
  }
  renderSlotSwitcher();
  const data = getActiveData();

  const label = data.currencyLabel || "通貨";
  document.getElementById("currencyLabelInput").value = label;
  document.getElementById("targetCurrencyLabel").textContent = label;
  document.getElementById("currentCurrencyLabel").textContent = label;
  document.getElementById("settingsCurrentCurrencyLabel").textContent = label;

  if (!data.startDate) {
    showSettingsForm(true);
  } else {
    showSettingsForm(false);
  }
  document.getElementById("startDate").value = data.startDate || "";
  document.getElementById("targetCurrency").value = data.targetCurrency || "";
  document.getElementById("targetDate").value = data.targetDate || "";
  document.getElementById("currentCurrency").value = data.currentCurrency || 0;
  document.getElementById("settingsCurrentCurrency").value = data.currentCurrency || 0;
  document.getElementById("targetCurrencyErr").textContent = "";
  document.getElementById("currentCurrencyErr").textContent = "";
  document.getElementById("settingsCurrentCurrencyErr").textContent = "";
  renderStatus(data);
  renderQuickBtns(data.quickBtns || QUICK_BTN_TEMPLATE);
  
  // 表示設定を適用
  const slotsObj = loadSlots();
  applyDisplaySettings(slotsObj.settings || { showGraph: true, showHistory: true, darkMode: false });
}

// --- 目標編集ボタンまわり ---
function showEditTargetCurrencyPanel(show) {
  document.getElementById("editTargetCurrencyPanel").style.display = show ? 'flex' : 'none';
  if (show) {
    document.getElementById("editTargetCurrencyInput").value = getActiveData().targetCurrency || '';
    document.getElementById("editTargetCurrencyInput").focus();
  }
}
function showEditTargetDatePanel(show) {
  document.getElementById("editTargetDatePanel").style.display = show ? 'flex' : 'none';
  if (show) {
    document.getElementById("editTargetDateInput").value = getActiveData().targetDate || '';
    document.getElementById("editTargetDateInput").focus();
  }
}
document.getElementById("editTargetCurrencyBtn").onclick = function() {
  showEditTargetCurrencyPanel(true);
  showEditTargetDatePanel(false);
};
document.getElementById("editTargetDateBtn").onclick = function() {
  showEditTargetDatePanel(true);
  showEditTargetCurrencyPanel(false);
};
document.getElementById("cancelTargetCurrencyBtn").onclick = function() {
  showEditTargetCurrencyPanel(false);
};
document.getElementById("cancelTargetDateBtn").onclick = function() {
  showEditTargetDatePanel(false);
};
document.getElementById("saveTargetCurrencyBtn").onclick = function() {
  const v = document.getElementById("editTargetCurrencyInput").value;
  if (!v || isNaN(Number(v)) || Number(v) < 1) {
    alert("正しい数値を入力してください");
    return;
  }
  const data = getActiveData();
  data.targetCurrency = Number(v);
  setActiveData(data);
  renderStatus(data);
  showEditTargetCurrencyPanel(false);
};
document.getElementById("saveTargetDateBtn").onclick = function() {
  const v = document.getElementById("editTargetDateInput").value;
  if (!v) {
    alert("日付を入力してください");
    return;
  }
  const data = getActiveData();
  data.targetDate = v;
  setActiveData(data);
  renderStatus(data);
  showEditTargetDatePanel(false);
};
document.getElementById("deleteTargetCurrencyBtn").onclick = function() {
  if (!confirm("目標個数を削除（未設定）にしますか？")) return;
  const data = getActiveData();
  data.targetCurrency = "";
  setActiveData(data);
  renderStatus(data);
  showEditTargetCurrencyPanel(false);
};
document.getElementById("deleteTargetDateBtn").onclick = function() {
  if (!confirm("目標日付を削除（未設定）にしますか？")) return;
  const data = getActiveData();
  data.targetDate = "";
  setActiveData(data);
  renderStatus(data);
  showEditTargetDatePanel(false);
};

// --- 設定保存 ---
document.getElementById("settingsForm").onsubmit = function(e) {
  e.preventDefault();
  const startDate = document.getElementById("startDate").value;
  const targetCurrency = document.getElementById("targetCurrency").value;
  const currentCurrency = document.getElementById("settingsCurrentCurrency").value;
  const currencyLabel = document.getElementById("currencyLabelInput").value.trim() || "通貨";
  let hasError = false;
  if (!startDate) {
    alert("ガチャ禁開始日を入力してください。");
    hasError = true;
  }
  if (targetCurrency && isNaN(Number(targetCurrency))) {
    document.getElementById("targetCurrencyErr").textContent = "数字で入力してください";
    hasError = true;
  } else {
    document.getElementById("targetCurrencyErr").textContent = "";
  }
  if (currentCurrency === "" || isNaN(Number(currentCurrency))) {
    document.getElementById("settingsCurrentCurrencyErr").textContent = "数字で入力してください";
    hasError = true;
  } else {
    document.getElementById("settingsCurrentCurrencyErr").textContent = "";
  }
  if (currencyLabel.length > 8) {
    alert("通貨ラベルは8文字以内で入力してください");
    hasError = true;
  }
  if (hasError) return;

  const data = getActiveData();
  data.startDate = startDate;
  data.targetCurrency = targetCurrency;
  data.targetDate = document.getElementById("targetDate").value;
  data.currencyLabel = currencyLabel;
  const newCurrency = Number(currentCurrency);
  if (data.currentCurrency !== newCurrency) {
    data.history = data.history || [];
    data.history.push({
      date: getTodayString(),
      currency: newCurrency,
      memo: "直接入力"
    });
    data.currentCurrency = newCurrency;
    setSessionPrevCurrency(newCurrency);
  }
  setActiveData(data);
  renderStatus(data);
  showSettingsForm(false);
  alert("設定・記録を保存しました！");
  location.reload();
};

// --- 現在の通貨数欄の即時反映 ---
document.getElementById("currentCurrency").addEventListener("change", function() {
  const v = this.value;
  if (v === "" || isNaN(Number(v))) {
    document.getElementById("currentCurrencyErr").textContent = "数字で入力してください";
    return;
  } else {
    document.getElementById("currentCurrencyErr").textContent = "";
  }
  const data = getActiveData();
  if (data.currentCurrency !== Number(v)) {
    data.currentCurrency = Number(v);
    data.history = data.history || [];
    data.history.push({
      date: getTodayString(),
      currency: data.currentCurrency,
      memo: "直接入力"
    });
    setActiveData(data);
    setSessionPrevCurrency(data.currentCurrency);
    renderStatus(data);
  }
});

// --- 即時入力ボタン ---
function renderQuickBtns(btns) {
  const area = document.getElementById("quickBtnsArea");
  area.innerHTML = "";
  btns.forEach((btn, idx) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "quick-btn-two-line";
    
    const labelSpan = document.createElement("span");
    labelSpan.className = "quick-btn-label";
    labelSpan.textContent = btn.label.length > 7 ? btn.label.slice(0, 7) : btn.label;
    
    const amountSpan = document.createElement("span");
    amountSpan.className = "quick-btn-amount";
    amountSpan.textContent = `(+${btn.amount})`;
    
    b.appendChild(labelSpan);
    b.appendChild(amountSpan);
    
    b.onclick = () => {
      if (!checkCookieConsent()) return;
      const data = getActiveData();
      data.currentCurrency = Number(data.currentCurrency) + Number(btn.amount);
      data.history = data.history || [];
      data.history.push({
        date: getTodayString(),
        currency: data.currentCurrency,
        memo: btn.label
      });
      setActiveData(data);
      document.getElementById("currentCurrency").value = data.currentCurrency;
      renderStatus(data);
    };
    area.appendChild(b);
  });
}

// --- 天井計算モーダル ---
document.getElementById("calcBtn").onclick = function() {
  const label = getActiveData().currencyLabel || "通貨";
  document.getElementById("calcCurrencyLabel").textContent = label;
  document.getElementById("calcNowLabel").textContent = label;
  document.getElementById("calcCurrentCurrency").value = getActiveData().currentCurrency || 0;
  
  const modal = document.getElementById("calcModal");
  modal.classList.add("show");
  modal.classList.remove("hidden");
  document.querySelector(".modal-backdrop").classList.remove("hidden");
  document.getElementById("calcResult").textContent = "";
};

function closeCalcModal() {
  const modal = document.getElementById("calcModal");
  modal.classList.remove("show");
  setTimeout(() => {
    modal.classList.add("hidden");
    document.querySelector(".modal-backdrop").classList.add("hidden");
  }, 280);
}

document.getElementById("calcCloseBtn").onclick = closeCalcModal;
document.getElementById("calcExecBtn").onclick = function() {
  const left = Number(document.getElementById('calcLeftCount').value);
  const per = Number(document.getElementById('calcPerCurrency').value);
  const now = Number(document.getElementById('calcCurrentCurrency').value) || 0;
  const label = getActiveData().currencyLabel || "通貨";
  if (isNaN(left) || isNaN(per) || left <= 0 || per <= 0) {
    document.getElementById('calcResult').textContent = '正しい値を入力してください。';
    return;
  }
  const need = left * per;
  const rest = Math.max(need - now, 0);
  const possible = Math.floor(now / per);

  document.getElementById('calcResult').innerHTML =
    `残り必要な${label}数: <strong>${rest}</strong><br>（合計必要: ${need}, 現在: ${now}）<br><br>` +
    `今の${label}数で回せる回数: <strong>${possible}回</strong>`;
};

// --- インポート・エクスポート（省略していた場合） ---
// エクスポート
function exportCSV(data) {
  let csv = `ガチャ禁開始日,${data.startDate || ""}\n`;
  csv += `目標日付,${data.targetDate || ""},目標${data.currencyLabel || "通貨"}数,${data.targetCurrency || ""}\n`;
  csv += `現在の${data.currencyLabel || "通貨"}数,${data.currentCurrency}\n`;
  csv += `通貨ラベル,${data.currencyLabel || "通貨"}\n`;
  csv += `即時入力ボタン,${(data.quickBtns||[]).map(b=>`${b.label}:${b.amount}`).join(";")}\n`;
  csv += `日付,${data.currencyLabel || "通貨"}数,メモ\n`;
  (data.history||[]).forEach(h => {
    csv += `${h.date},${h.currency},${h.memo||""}\n`;
  });
  return csv;
}
function exportJSON(data) {
  return JSON.stringify({
    startDate: data.startDate || "",
    currentCurrency: data.currentCurrency || 0,
    targetDate: data.targetDate || "",
    targetCurrency: data.targetCurrency || "",
    quickBtns: data.quickBtns || QUICK_BTN_TEMPLATE,
    history: data.history || [],
    currencyLabel: data.currencyLabel || "通貨"
  }, null, 2);
}
document.getElementById("exportCSV").onclick = function() {
  if (!checkCookieConsent()) return;
  const data = getActiveData();
  const blob = new Blob([exportCSV(data)], {type: "text/csv"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "gacha_record.csv";
  a.click();
  URL.revokeObjectURL(url);
};
document.getElementById("exportJSON").onclick = function() {
  if (!checkCookieConsent()) return;
  const data = getActiveData();
  const blob = new Blob([exportJSON(data)], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "gacha_record.json";
  a.click();
  URL.revokeObjectURL(url);
};
// インポート
function afterOverwriteData(newData, msg) {
  setActiveData(newData);
  setSessionPrevCurrency(newData.currentCurrency);
  initialDisplay();
  alert(msg || "インポートが完了しました！");
}
document.getElementById("importCSV").onclick = function() {
  if (!checkCookieConsent()) return;
  document.getElementById("csvFileInput").click();
};
document.getElementById("csvFileInput").onchange = function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const lines = evt.target.result.trim().split("\n");
      if (!lines[0].includes("ガチャ禁開始日")) {
        alert("フォーマットエラー：正しいCSVを選択してください。");
        return;
      }
      const startDate = lines[0].split(",")[1].trim();
      const [targetDate,, targetCurrencyLabel,targetCurrency] = lines[1].split(",");
      const currentCurrency = Number(lines[2].split(",")[1].trim());
      let currencyLabel = "通貨";
      let quickBtnsLineIdx = 3;
      if (lines[3].startsWith("通貨ラベル,")) {
        currencyLabel = lines[3].split(",")[1].trim() || "通貨";
        quickBtnsLineIdx = 4;
      }
      const quickBtnsStr = (lines[quickBtnsLineIdx]||"").replace(/^即時入力ボタン,/, "");
      const quickBtns = quickBtnsStr.split(";").map(pair => {
        const [label, amount] = pair.split(":");
        return { label: label || "", amount: Number(amount) || 1 };
      });
      let idx = quickBtnsLineIdx + 2;
      const history = [];
      for (; idx < lines.length; idx++) {
        const [date, currency, memo] = lines[idx].split(",");
        if (date && currency) {
          history.push({ date: date.trim(), currency: Number(currency.trim()), memo: memo ? memo.trim() : "" });
        }
      }
      if (!confirm("現在の記録を上書きします。よろしいですか？")) return;
      const data = {
        startDate,
        targetDate: targetDate ? targetDate.trim() : "",
        targetCurrency: targetCurrency ? targetCurrency.trim() : "",
        currentCurrency,
        quickBtns,
        history,
        currencyLabel
      };
      afterOverwriteData(data, "インポートが完了しました！");
    } catch {
      alert("インポートに失敗しました。CSV形式を確認してください。");
    }
  };
  reader.readAsText(file, "UTF-8");
};
document.getElementById("importJSON").onclick = function() {
  if (!checkCookieConsent()) return;
  document.getElementById("jsonFileInput").click();
};
document.getElementById("jsonFileInput").onchange = function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const data = JSON.parse(evt.target.result);
      if (
        !data.startDate ||
        typeof data.currentCurrency !== "number" ||
        !Array.isArray(data.history)
      ) {
        alert("フォーマットエラー：正しいJSONを選択してください。");
        return;
      }
      if (!confirm("現在の記録を上書きします。よろしいですか？")) return;
      afterOverwriteData({
        startDate: data.startDate,
        currentCurrency: data.currentCurrency,
        targetDate: data.targetDate || "",
        targetCurrency: data.targetCurrency || "",
        quickBtns: data.quickBtns || QUICK_BTN_TEMPLATE,
        history: data.history,
        currencyLabel: data.currencyLabel || "通貨"
      }, "インポートが完了しました！");
    } catch {
      alert("インポートに失敗しました。JSON形式を確認してください。");
    }
  };
  reader.readAsText(file, "UTF-8");
};

// --- 日付クイックボタン ---
function setupDateQuickButtons() {
  document.querySelectorAll('.date-quick-btn').forEach(btn => {
    btn.onclick = function() {
      const days = parseInt(this.dataset.days);
      const targetId = this.dataset.target || 'startDate';
      const today = new Date();
      const targetDate = new Date(today.getTime() - (days * 24 * 60 * 60 * 1000));
      const dateString = targetDate.toISOString().split('T')[0];
      document.getElementById(targetId).value = dateString;
    };
  });
}

// --- 初期表示 ---
window.onload = function() {
  initialDisplay();
  setupDateQuickButtons();
  if (getSessionPrevCurrency() === null) {
    initSessionPrevCurrency();
  }
};
