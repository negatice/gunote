// ══════════════════════════════════════════════════════════════
//  CatatanKu – Finance JS (API-backed)
// ══════════════════════════════════════════════════════════════

const INCOME_CATS = [
  { id: 'salary',      label: '💰 Gaji' },
  { id: 'freelance',   label: '🧑‍💻 Freelance' },
  { id: 'invest',      label: '📈 Investasi' },
  { id: 'bonus',       label: '🎁 Bonus' },
  { id: 'business',    label: '🏪 Bisnis' },
  { id: 'transfer_in', label: '💸 Transfer' },
  { id: 'other_in',    label: '🎲 Lainnya' },
];

const EXPENSE_CATS = [
  { id: 'food',         label: '🍔 Makanan' },
  { id: 'transport',    label: '🚗 Transportasi' },
  { id: 'shopping',     label: '🛒 Belanja' },
  { id: 'health',       label: '🏥 Kesehatan' },
  { id: 'entertain',    label: '🎮 Hiburan' },
  { id: 'bills',        label: '💡 Tagihan' },
  { id: 'education',    label: '📚 Pendidikan' },
  { id: 'fashion',      label: '👗 Fashion' },
  { id: 'home',         label: '🏠 Rumah' },
  { id: 'installment',  label: '💳 Cicilan' },
  { id: 'other_out',    label: '🎲 Lainnya' },
];

const CAT_COLORS_EXPENSE = [
  '#e53935','#fb8c00','#fdd835','#43a047','#00acc1',
  '#3949ab','#8e24aa','#d81b60','#6d4c41','#546e7a','#aaa'
];
const CAT_COLORS_INCOME = [
  '#00a86b','#1e88e5','#f4511e','#8e24aa','#00838f','#c0ca33','#ffa000'
];

// ─── State ───────────────────────────────────────────────────
const state = {
  transactions: [],
  period: 'monthly',
  offset: 0,
  catView: 'expense',
  editId: null,
  deleteId: null,
  selectedCat: null,
  txType: 'expense',
};

// ─── Theme ───────────────────────────────────────────────────
function toggleTheme() {
  const d = document.body;
  d.dataset.theme = d.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('fin_theme', d.dataset.theme);
  drawTrendChart();
}
function initTheme() {
  document.body.dataset.theme = localStorage.getItem('fin_theme') || 'light';
}

// ─── Helpers ─────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

function fmtRp(n) {
  if (n === undefined || n === null) return 'Rp 0';
  return 'Rp ' + Math.abs(n).toLocaleString('id-ID');
}

function fmtRpShort(n) {
  n = Math.abs(n);
  if (n >= 1e9) return 'Rp ' + (n / 1e9).toFixed(1) + 'M';
  if (n >= 1e6) return 'Rp ' + (n / 1e6).toFixed(1) + 'jt';
  if (n >= 1e3) return 'Rp ' + (n / 1e3).toFixed(0) + 'rb';
  return 'Rp ' + n;
}

function getCatLabel(type, catId) {
  const cats = type === 'income' ? INCOME_CATS : EXPENSE_CATS;
  return cats.find(c => c.id === catId)?.label || '🎲 Lainnya';
}

function todayStr() { return new Date().toISOString().slice(0, 10); }

// ─── Loading ─────────────────────────────────────────────────
function setLoading(on) {
  const fab = document.querySelector('.fab');
  if (fab) fab.style.opacity = on ? '0.5' : '1';
}

// ─── Load transactions from API ───────────────────────────────
async function loadData() {
  setLoading(true);
  try {
    state.transactions = await API.transactions.getAll();
    state.transactions.sort((a, b) => b.ts - a.ts);
  } catch (e) {
    showToast('❌', 'Gagal memuat data', e.message, true);
    state.transactions = [];
  } finally {
    setLoading(false);
  }
}

// ─── Period Management ───────────────────────────────────────
function setPeriod(period, el) {
  state.period = period;
  state.offset = 0;
  document.querySelectorAll('.period-tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  renderAll();
}

function navPeriod(dir) {
  state.offset += dir;
  if (state.offset > 0) state.offset = 0;
  renderAll();
}

function getPeriodRange(period, offset) {
  const now = new Date();
  let start, end;

  if (period === 'daily') {
    start = new Date(now);
    start.setDate(start.getDate() + offset);
    start.setHours(0, 0, 0, 0);
    end = new Date(start);
    end.setHours(23, 59, 59, 999);

  } else if (period === 'weekly') {
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
    monday.setHours(0, 0, 0, 0);
    start = monday;
    end = new Date(monday);
    end.setDate(monday.getDate() + 6);
    end.setHours(23, 59, 59, 999);

  } else {
    start = new Date(now.getFullYear(), now.getMonth() + offset, 1, 0, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59, 999);
  }

  return { start, end };
}

function getPeriodLabel(period, offset) {
  const { start } = getPeriodRange(period, offset);
  if (period === 'daily') {
    if (offset === 0) return 'Hari Ini';
    if (offset === -1) return 'Kemarin';
    return start.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  if (period === 'weekly') {
    const { end } = getPeriodRange(period, offset);
    if (offset === 0) return 'Minggu Ini';
    const s = start.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    const e = end.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    return `${s} – ${e}`;
  }
  return start.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

function getFilteredTx(start, end) {
  const s = start.getTime(), e = end.getTime();
  return state.transactions.filter(t => t.ts >= s && t.ts <= e);
}

function getSummary(txs) {
  let income = 0, expense = 0;
  txs.forEach(t => { if (t.type === 'income') income += t.amount; else expense += t.amount; });
  return { income, expense, net: income - expense, count: txs.length };
}

// ─── Trend Chart ─────────────────────────────────────────────
function getTrendData() {
  const { period, offset } = state;
  const N = period === 'monthly' ? 6 : (period === 'weekly' ? 8 : 7);
  const data = [];

  for (let i = N - 1; i >= 0; i--) {
    const o = offset - i;
    const { start, end } = getPeriodRange(period, o);
    const txs = getFilteredTx(start, end);
    const sum = getSummary(txs);

    let label;
    if (period === 'daily') {
      label = o === 0 ? 'Hari\nIni' : start.toLocaleDateString('id-ID', { weekday: 'narrow', day: 'numeric' });
    } else if (period === 'weekly') {
      label = 'Mg ' + start.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    } else {
      label = start.toLocaleDateString('id-ID', { month: 'short' });
    }

    data.push({ label, income: sum.income, expense: sum.expense, isCurrent: i === 0 });
  }
  return data;
}

function chartColors() {
  const dark = document.body.dataset.theme === 'dark';
  return {
    grid:    dark ? '#2a3942' : '#e9edef',
    label:   dark ? '#8696a0' : '#8a9aa5',
    income:  '#00a86b',
    expense: '#e53935',
    bg:      dark ? '#202c33' : '#ffffff',
    current: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
  };
}

function drawTrendChart() {
  const canvas = document.getElementById('trendChart');
  if (!canvas) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const W = rect.width, H = rect.height;
  const PAD = { top: 10, right: 12, bottom: 36, left: 52 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;
  const C = chartColors();
  const data = getTrendData();
  const N = data.length;
  if (!N) return;

  ctx.clearRect(0, 0, W, H);
  const maxVal = Math.max(...data.flatMap(d => [d.income, d.expense]), 1);
  const niceMax = niceNumber(maxVal * 1.15);

  const gridCount = 4;
  for (let i = 0; i <= gridCount; i++) {
    const val = (niceMax / gridCount) * i;
    const y = PAD.top + ch - (ch * val / niceMax);
    ctx.beginPath();
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    ctx.setLineDash(i === 0 ? [] : [3, 4]);
    ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + cw, y);
    ctx.stroke();
    ctx.setLineDash([]);
    if (i > 0) {
      ctx.textAlign = 'right';
      ctx.font = '500 10px system-ui';
      ctx.fillStyle = C.label;
      ctx.fillText(fmtRpShort(val), PAD.left - 5, y + 4);
    }
  }

  const groupW = cw / N;
  const barW = Math.min(groupW * 0.3, 22);
  const gap = 3;

  ctx.fillStyle = C.current;
  ctx.beginPath();
  ctx.roundRect(PAD.left + (N - 1) * groupW, PAD.top, groupW, ch, 6);
  ctx.fill();

  data.forEach((d, i) => {
    const cx = PAD.left + (i + 0.5) * groupW;
    if (d.income > 0) {
      const bh = ch * d.income / niceMax;
      ctx.fillStyle = d.isCurrent ? C.income : C.income + '99';
      ctx.beginPath();
      ctx.roundRect(cx - barW - gap / 2, PAD.top + ch - bh, barW, bh, [4, 4, 0, 0]);
      ctx.fill();
    }
    if (d.expense > 0) {
      const bh = ch * d.expense / niceMax;
      ctx.fillStyle = d.isCurrent ? C.expense : C.expense + '99';
      ctx.beginPath();
      ctx.roundRect(cx + gap / 2, PAD.top + ch - bh, barW, bh, [4, 4, 0, 0]);
      ctx.fill();
    }
  });

  ctx.textAlign = 'center';
  data.forEach((d, i) => {
    const cx = PAD.left + (i + 0.5) * groupW;
    const lines = d.label.split('\n');
    lines.forEach((line, li) => {
      ctx.fillStyle = d.isCurrent ? (document.body.dataset.theme === 'dark' ? '#e9edef' : '#202c33') : C.label;
      ctx.font = d.isCurrent ? '700 10px system-ui' : '500 10px system-ui';
      ctx.fillText(line, cx, PAD.top + ch + 14 + li * 12);
    });
  });

  ctx.beginPath();
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 1;
  ctx.moveTo(PAD.left, PAD.top + ch);
  ctx.lineTo(PAD.left + cw, PAD.top + ch);
  ctx.stroke();
}

function niceNumber(n) {
  if (n <= 0) return 1000000;
  const exp = Math.floor(Math.log10(n));
  const f = n / Math.pow(10, exp);
  let nice;
  if (f <= 1) nice = 1;
  else if (f <= 2) nice = 2;
  else if (f <= 5) nice = 5;
  else nice = 10;
  return nice * Math.pow(10, exp);
}

// ─── Category Bars ────────────────────────────────────────────
function renderCategoryBars(txs) {
  const el = document.getElementById('categoryBars');
  const type = state.catView;
  const cats = type === 'income' ? INCOME_CATS : EXPENSE_CATS;
  const colors = type === 'income' ? CAT_COLORS_INCOME : CAT_COLORS_EXPENSE;

  const filtered = txs.filter(t => t.type === type);
  if (!filtered.length) {
    el.innerHTML = `<div class="cat-empty">Tidak ada data ${type === 'income' ? 'pendapatan' : 'pengeluaran'}</div>`;
    return;
  }

  const groups = {};
  filtered.forEach(t => { groups[t.category] = (groups[t.category] || 0) + t.amount; });
  const total = Object.values(groups).reduce((a, b) => a + b, 0);
  const sorted = Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 7);

  el.innerHTML = sorted.map(([catId, amount], i) => {
    const pct = total > 0 ? Math.round(amount / total * 100) : 0;
    const cat = cats.find(c => c.id === catId) || { label: '🎲 Lainnya' };
    return `
      <div class="cat-bar-item">
        <div class="cat-bar-info">
          <span class="cat-bar-label">${cat.label}</span>
          <span>
            <span class="cat-bar-amount">${fmtRp(amount)}</span>
            <span class="cat-bar-pct">${pct}%</span>
          </span>
        </div>
        <div class="cat-bar-track">
          <div class="cat-bar-fill" style="width:${pct}%;background:${colors[i % colors.length]}"></div>
        </div>
      </div>`;
  }).join('');
}

function setCatView(type, el) {
  state.catView = type;
  document.getElementById('catExpBtn').className = 'cat-toggle-btn' + (type === 'expense' ? ' active-expense' : '');
  document.getElementById('catIncBtn').className = 'cat-toggle-btn' + (type === 'income' ? ' active-income' : '');
  const { start, end } = getPeriodRange(state.period, state.offset);
  renderCategoryBars(getFilteredTx(start, end));
}

// ─── Transaction List ─────────────────────────────────────────
function populateCatFilter() {
  const sel = document.getElementById('txCatFilter');
  const all = [...INCOME_CATS, ...EXPENSE_CATS];
  const seen = new Set();
  const usedCats = state.transactions.map(t => t.category).filter(c => { if (seen.has(c)) return false; seen.add(c); return true; });
  sel.innerHTML = '<option value="all">Semua Kategori</option>' +
    usedCats.map(catId => {
      const cat = all.find(c => c.id === catId);
      return cat ? `<option value="${catId}">${cat.label}</option>` : '';
    }).join('');
}

function renderTxList() {
  const { start, end } = getPeriodRange(state.period, state.offset);
  let txs = getFilteredTx(start, end);

  const q = (document.getElementById('txSearch')?.value || '').toLowerCase();
  const typeF = document.getElementById('txTypeFilter')?.value || 'all';
  const catF = document.getElementById('txCatFilter')?.value || 'all';

  if (q) txs = txs.filter(t => {
    const label = getCatLabel(t.type, t.category).toLowerCase();
    return label.includes(q) || (t.desc || '').toLowerCase().includes(q) || fmtRp(t.amount).includes(q);
  });
  if (typeF !== 'all') txs = txs.filter(t => t.type === typeF);
  if (catF !== 'all') txs = txs.filter(t => t.category === catF);

  const el = document.getElementById('txList');
  if (!txs.length) {
    el.innerHTML = `<div class="tx-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg><p>Tidak ada transaksi</p></div>`;
    return;
  }

  const groups = {};
  txs.forEach(t => { if (!groups[t.date]) groups[t.date] = []; groups[t.date].push(t); });

  const today = todayStr();
  const yDate = new Date(); yDate.setDate(yDate.getDate() - 1);
  const yStr = yDate.toISOString().slice(0, 10);

  el.innerHTML = Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => {
      const d = new Date(date + 'T12:00:00');
      let dateLabel = d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      if (date === today) dateLabel = 'Hari Ini · ' + d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' });
      if (date === yStr) dateLabel = 'Kemarin · ' + d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' });

      const dayTotal = items.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
      const dayTotalStr = (dayTotal >= 0 ? '+' : '-') + fmtRp(Math.abs(dayTotal));
      const dayColor = dayTotal >= 0 ? 'var(--income-color)' : 'var(--expense-color)';

      const rows = items.map(t => {
        const label = getCatLabel(t.type, t.category);
        const timeStr = new Date(t.ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const amtClass = t.type === 'income' ? 'income' : 'expense';
        const bgClass = t.type === 'income' ? 'income-bg' : 'expense-bg';
        return `
          <div class="tx-item" onclick="openEditTx('${t.id}')">
            <div class="tx-cat-icon ${bgClass}">${label.split(' ')[0]}</div>
            <div class="tx-info">
              <div class="tx-cat-label">${label.slice(label.indexOf(' ') + 1)}</div>
              <div class="tx-desc">${t.desc || '–'}</div>
              <div class="tx-time">${timeStr}</div>
            </div>
            <div class="tx-amount-col">
              <div class="tx-amount ${amtClass}">${t.type === 'income' ? '+' : '-'}${fmtRp(t.amount)}</div>
            </div>
            <button class="tx-del-btn" onclick="event.stopPropagation();openDeleteTx('${t.id}')" title="Hapus">🗑️</button>
          </div>`;
      }).join('');

      return `
        <div class="tx-date-group">
          <div class="tx-date-label">
            <span>${dateLabel}</span>
            <span style="float:right;color:${dayColor};font-weight:700">${dayTotalStr}</span>
          </div>
          ${rows}
        </div>`;
    }).join('');
}

// ─── Balance Hero ─────────────────────────────────────────────
function renderBalance() {
  const allIncome = state.transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const allExpense = state.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const net = allIncome - allExpense;

  const el = document.getElementById('balanceAmount');
  el.textContent = fmtRp(net);
  el.className = 'balance-amount' + (net >= 0 ? ' positive' : ' negative');

  document.getElementById('heroIncome').textContent = fmtRp(allIncome);
  document.getElementById('heroExpense').textContent = fmtRp(allExpense);

  const savingsRate = allIncome > 0 ? Math.max(0, Math.min(100, Math.round((allIncome - allExpense) / allIncome * 100))) : 0;
  document.getElementById('savingsBar').style.width = savingsRate + '%';
  document.getElementById('savingsPct').textContent = savingsRate + '%';
}

// ─── Summary Cards ────────────────────────────────────────────
function renderSummaryCards(txs) {
  const cur = getSummary(txs);
  const { start: ps, end: pe } = getPeriodRange(state.period, state.offset - 1);
  const prev = getSummary(getFilteredTx(ps, pe));

  document.getElementById('incomeTotal').textContent = fmtRp(cur.income);
  document.getElementById('incomeCount').textContent = txs.filter(t => t.type === 'income').length + ' transaksi';
  document.getElementById('expenseTotal').textContent = fmtRp(cur.expense);
  document.getElementById('expenseCount').textContent = txs.filter(t => t.type === 'expense').length + ' transaksi';

  const net = cur.income - cur.expense;
  document.getElementById('netTotal').textContent = (net >= 0 ? '+' : '') + fmtRp(net);
  document.getElementById('netTotal').style.color = net >= 0 ? 'var(--income-color)' : 'var(--expense-color)';
  document.getElementById('txCountTotal').textContent = cur.count;

  renderChangeBadge('incomeChange', cur.income, prev.income);
  renderChangeBadge('expenseChange', cur.expense, prev.expense, true);
}

function renderChangeBadge(elId, cur, prev, invertColors = false) {
  const el = document.getElementById(elId);
  if (!prev) { el.textContent = ''; return; }
  const pct = Math.round((cur - prev) / prev * 100);
  const up = pct > 0;
  el.textContent = `${up ? '↑' : '↓'} ${Math.abs(pct)}%`;
  el.className = 'sc-change ' + ((up !== invertColors) ? 'up' : 'down');
}

// ─── Render All ───────────────────────────────────────────────
function renderAll() {
  document.getElementById('periodLabel').textContent = getPeriodLabel(state.period, state.offset);
  document.getElementById('navNext').disabled = state.offset >= 0;

  const { start, end } = getPeriodRange(state.period, state.offset);
  const txs = getFilteredTx(start, end);

  renderBalance();
  renderSummaryCards(txs);
  drawTrendChart();
  renderCategoryBars(txs);
  renderTxList();
  populateCatFilter();
}

// ─── Add / Edit Transaction Modal ─────────────────────────────
function openAddTx() {
  state.editId = null;
  state.txType = 'expense';
  state.selectedCat = null;
  document.getElementById('txModalTitle').textContent = '➕ Tambah Transaksi';
  document.getElementById('txSaveBtn').textContent = 'Simpan';
  document.getElementById('txAmount').value = '';
  document.getElementById('txDesc').value = '';
  document.getElementById('txDate').value = todayStr();
  setTxType('expense');
  document.getElementById('txModal').style.display = 'flex';
  setTimeout(() => document.getElementById('txAmount').focus(), 300);
}

function openEditTx(id) {
  const t = state.transactions.find(x => x.id === id);
  if (!t) return;
  state.editId = id;
  state.txType = t.type;
  state.selectedCat = t.category;
  document.getElementById('txModalTitle').textContent = '✏️ Edit Transaksi';
  document.getElementById('txSaveBtn').textContent = 'Update';
  document.getElementById('txAmount').value = t.amount;
  document.getElementById('txDesc').value = t.desc || '';
  document.getElementById('txDate').value = t.date;
  setTxType(t.type, t.category);
  document.getElementById('txModal').style.display = 'flex';
}

function closeTxModal() { document.getElementById('txModal').style.display = 'none'; }

function setTxType(type, preselected) {
  state.txType = type;
  state.selectedCat = preselected || null;
  document.getElementById('typeIncome').className = 'type-btn' + (type === 'income' ? ' active-income' : '');
  document.getElementById('typeExpense').className = 'type-btn' + (type === 'expense' ? ' active-expense' : '');
  renderCatGrid();
}

function renderCatGrid() {
  const cats = state.txType === 'income' ? INCOME_CATS : EXPENSE_CATS;
  const selClass = state.txType === 'income' ? 'selected-income' : 'selected-expense';
  document.getElementById('catGrid').innerHTML = cats.map(c =>
    `<button class="cat-chip ${state.selectedCat === c.id ? selClass : ''}" onclick="selectCat('${c.id}')">${c.label}</button>`
  ).join('');
}

function selectCat(catId) {
  state.selectedCat = catId;
  renderCatGrid();
}

async function saveTx() {
  const amountRaw = parseFloat(document.getElementById('txAmount').value);
  if (!amountRaw || amountRaw <= 0) { showToast('⚠️', 'Jumlah harus diisi!', '', true); return; }
  if (!state.selectedCat) { showToast('⚠️', 'Pilih kategori!', '', true); return; }
  const dateVal = document.getElementById('txDate').value;
  if (!dateVal) { showToast('⚠️', 'Pilih tanggal!', '', true); return; }

  const dt = new Date(dateVal + 'T12:00:00');
  const payload = {
    type: state.txType,
    amount: Math.round(amountRaw),
    category: state.selectedCat,
    desc: document.getElementById('txDesc').value.trim(),
    date: dateVal,
    ts: dt.getTime(),
  };

  const btn = document.getElementById('txSaveBtn');
  btn.disabled = true; btn.textContent = 'Menyimpan...';

  try {
    if (state.editId) {
      const updated = await API.transactions.update(state.editId, payload);
      const idx = state.transactions.findIndex(x => x.id === state.editId);
      if (idx !== -1) state.transactions[idx] = updated;
      showToast('✅', 'Transaksi diperbarui', getCatLabel(state.txType, state.selectedCat));
    } else {
      const created = await API.transactions.create(payload);
      state.transactions.unshift(created);
      showToast('✅', state.txType === 'income' ? 'Pendapatan dicatat' : 'Pengeluaran dicatat', getCatLabel(state.txType, state.selectedCat));
    }
    state.transactions.sort((a, b) => b.ts - a.ts);
    closeTxModal();
    renderAll();
  } catch (e) {
    showToast('❌', 'Gagal menyimpan', e.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = state.editId ? 'Update' : 'Simpan';
  }
}

// ─── Delete ───────────────────────────────────────────────────
function openDeleteTx(id) {
  state.deleteId = id;
  document.getElementById('confirmOverlay').style.display = 'flex';
}
function closeConfirm() { document.getElementById('confirmOverlay').style.display = 'none'; }

async function confirmDelete() {
  closeConfirm();
  try {
    await API.transactions.remove(state.deleteId);
    state.transactions = state.transactions.filter(t => t.id !== state.deleteId);
    renderAll();
    showToast('🗑️', 'Transaksi dihapus', '');
  } catch (e) {
    showToast('❌', 'Gagal menghapus', e.message, true);
  }
}

// ─── Export CSV ───────────────────────────────────────────────
function exportCSV() {
  const { start, end } = getPeriodRange(state.period, state.offset);
  const txs = getFilteredTx(start, end);
  if (!txs.length) { showToast('⚠️', 'Tidak ada data untuk diekspor', '', true); return; }

  const header = ['Tanggal', 'Tipe', 'Kategori', 'Keterangan', 'Jumlah'].join(';');
  const rows = txs.map(t => [
    t.date,
    t.type === 'income' ? 'Pendapatan' : 'Pengeluaran',
    getCatLabel(t.type, t.category).replace(/[^\w\s]/g, '').trim(),
    t.desc || '',
    t.amount,
  ].join(';'));

  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `keuangan_${state.period}_${getPeriodLabel(state.period, state.offset).replace(/\s+/g, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📥', 'File CSV diunduh!', txs.length + ' transaksi');
}

// ─── Toast ────────────────────────────────────────────────────
function showToast(icon, title, sub, isError = false) {
  const id = 'toast_' + uid();
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' error' : '');
  el.id = id;
  el.innerHTML = `<div class="toast-icon">${icon}</div><div class="toast-msg"><strong>${title}</strong>${sub ? '<br>' + sub : ''}</div><button class="toast-close" onclick="removeToast('${id}')">×</button>`;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => removeToast(id), 4000);
}
function removeToast(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.transition = 'all .3s';
  el.style.opacity = '0';
  el.style.transform = 'translateX(110%)';
  setTimeout(() => el.remove(), 300);
}

// ─── Events ──────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeTxModal(); closeConfirm(); }
});
let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(drawTrendChart, 150); });

// ─── Init ─────────────────────────────────────────────────────
async function init() {
  initTheme();
  await requireAuth();
  await loadData();
  setPeriod('monthly', document.querySelector('[data-period="monthly"]'));
}

init();
