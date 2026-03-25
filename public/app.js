// ===== FIREBASE CONFIG =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAeN5W-UFQiJ07LHwb8pVRv3et3Hlomh68",
  authDomain: "sales-race-tracker.firebaseapp.com",
  projectId: "sales-race-tracker",
  storageBucket: "sales-race-tracker.firebasestorage.app",
  messagingSenderId: "562670288039",
  appId: "1:562670288039:web:b0ab0edd9eb203594faf82"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ===== STATE =====
const SELLERS = ['Licoa', 'Rolando', 'Marian', 'Otro'];
let allSales = [];
let goals = { Licoa: 0, Rolando: 0, Marian: 0, Otro: 0, team: 0 };
let charts = {};

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  populateMonthFilter();
  loadGoalsFromStorage();
  await loadSales();
  bindEvents();
});

// ===== MONTH FILTER =====
function populateMonthFilter() {
  const sel = document.getElementById('filterMonth');
  const now = new Date();
  for (let i = 0; i < 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const label = d.toLocaleDateString('es', { month: 'long', year: 'numeric' }).toUpperCase();
    const opt = new Option(label, val);
    if (i === 0) opt.selected = true;
    sel.appendChild(opt);
  }
}

function getCurrentMonth() {
  return document.getElementById('filterMonth').value;
}

// ===== GOALS =====
function loadGoalsFromStorage() {
  const saved = localStorage.getItem('salesRaceGoals');
  if (saved) {
    goals = JSON.parse(saved);
    SELLERS.forEach(s => {
      const inp = document.querySelector(`.goal-input[data-seller="${s}"]`);
      if (inp && goals[s]) inp.value = goals[s];
    });
    const teamInp = document.getElementById('teamGoalInput');
    if (teamInp && goals.team) teamInp.value = goals.team;
  }
}

function saveGoals() {
  SELLERS.forEach(s => {
    const inp = document.querySelector(`.goal-input[data-seller="${s}"]`);
    goals[s] = parseFloat(inp?.value) || 0;
  });
  goals.team = parseFloat(document.getElementById('teamGoalInput').value) || 0;
  localStorage.setItem('salesRaceGoals', JSON.stringify(goals));
  updateRaceTrack();
  showToast('✅ METAS GUARDADAS');
}

// ===== FIREBASE CRUD =====
async function loadSales() {
  try {
    const q = query(collection(db, 'sales'), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    allSales = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
  } catch(e) {
    showToast('❌ Error cargando datos', true);
    console.error(e);
  }
}

async function addSale(sale) {
  const docRef = await addDoc(collection(db, 'sales'), sale);
  allSales.unshift({ id: docRef.id, ...sale });
  renderAll();
  showToast('⚡ VENTA REGISTRADA');
}

async function updateSale(id, sale) {
  await updateDoc(doc(db, 'sales', id), sale);
  const idx = allSales.findIndex(s => s.id === id);
  if (idx !== -1) allSales[idx] = { id, ...sale };
  renderAll();
  showToast('💾 VENTA ACTUALIZADA');
}

async function deleteSale(id) {
  if (!confirm('¿Eliminar esta venta?')) return;
  await deleteDoc(doc(db, 'sales', id));
  allSales = allSales.filter(s => s.id !== id);
  renderAll();
  showToast('🗑️ VENTA ELIMINADA');
}

// ===== FILTERS =====
function getFilteredSales() {
  const month = getCurrentMonth();
  const seller = document.getElementById('filterSeller').value;
  const type = document.getElementById('filterType').value;

  return allSales.filter(s => {
    const sMonth = s.date ? s.date.substring(0,7) : '';
    return (!month || sMonth === month) &&
           (!seller || s.seller === seller) &&
           (!type || s.type === type);
  });
}

// ===== RENDER ALL =====
function renderAll() {
  const filtered = getFilteredSales();
  renderTable(filtered);
  updateRaceTrack();
  updateCharts(filtered);
}

// ===== TABLE =====
function renderTable(sales) {
  const tbody = document.getElementById('salesBody');
  tbody.innerHTML = '';

  if (!sales.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--pixel-gray);font-family:var(--font-mono);font-size:1rem;padding:20px">SIN REGISTROS</td></tr>`;
    return;
  }

  sales.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDate(s.date)}</td>
      <td>${s.type}</td>
      <td class="seller-${s.seller}">${s.seller.toUpperCase()}</td>
      <td style="color:var(--pixel-green)">$${Number(s.amount).toLocaleString('es', {minimumFractionDigits:2})}</td>
      <td>
        <button class="btn-edit" onclick="openEdit('${s.id}')">✏️ EDITAR</button>
        <button class="btn-delete" onclick="deleteSale('${s.id}')">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  const totalsDiv = document.getElementById('tableTotals');
  const totalsByS = {};
  let grand = 0;
  sales.forEach(s => {
    totalsByS[s.seller] = (totalsByS[s.seller] || 0) + Number(s.amount);
    grand += Number(s.amount);
  });

  let html = SELLERS.filter(s => totalsByS[s]).map(s =>
    `<span class="seller-${s}">${s}: $${totalsByS[s].toLocaleString('es',{minimumFractionDigits:2})}</span>`
  ).join(' | ');
  html += ` <strong style="color:var(--pixel-yellow)"> | TOTAL: $${grand.toLocaleString('es',{minimumFractionDigits:2})}</strong>`;
  totalsDiv.innerHTML = html;

  document.getElementById('tableSummary').textContent = `${sales.length} REGISTROS ENCONTRADOS`;
}

function formatDate(d) {
  if (!d) return '-';
  const [y,m,day] = d.split('-');
  return `${day}/${m}/${y}`;
}

// ===== RACE TRACK =====
function updateRaceTrack() {
  const month = getCurrentMonth();
  const monthSales = allSales.filter(s => s.date && s.date.substring(0,7) === month);

  const totals = {};
  SELLERS.forEach(s => totals[s] = 0);
  monthSales.forEach(s => totals[s.seller] = (totals[s.seller]||0) + Number(s.amount));

  let teamTotal = 0;
  SELLERS.forEach(seller => {
    const goal = goals[seller] || 1;
    const amount = totals[seller] || 0;
    const pct = Math.min((amount / goal) * 100, 100);
    teamTotal += amount;

    const car = document.getElementById(`car-${seller}`);
    const amtEl = document.getElementById(`amount-${seller}`);
    const pctEl = document.getElementById(`pct-${seller}`);

    if (car) {
      const road = car.parentElement;
      const maxLeft = road.offsetWidth - 50;
      const leftPx = (pct / 100) * maxLeft;
      car.style.left = leftPx + 'px';
      if (pct >= 100) car.classList.add('car-celebrate');
      else car.classList.remove('car-celebrate');
    }
    if (amtEl) amtEl.textContent = `$${amount.toLocaleString('es',{minimumFractionDigits:0})}`;
    if (pctEl) pctEl.textContent = `${Math.round(pct)}%`;
  });

  const teamGoal = goals.team || 1;
  const teamPct = Math.min((teamTotal / teamGoal) * 100, 100);
  const bar = document.getElementById('teamBar');
  const barLabel = document.getElementById('teamBarLabel');
  const teamTotalEl = document.getElementById('teamTotal');
  const teamGoalEl = document.getElementById('teamGoalDisplay');
  if (bar) bar.style.width = teamPct + '%';
  if (barLabel) barLabel.textContent = Math.round(teamPct) + '%';
  if (teamTotalEl) teamTotalEl.textContent = `$${teamTotal.toLocaleString('es',{minimumFractionDigits:0})}`;
  if (teamGoalEl) teamGoalEl.textContent = `$${(goals.team||0).toLocaleString('es',{minimumFractionDigits:0})}`;
}

// ===== CHARTS =====
function updateCharts(sales) {
  const typeMap = {};
  const typeAmtMap = {};
  const sellerAmtMap = {};

  sales.forEach(s => {
    typeMap[s.type] = (typeMap[s.type]||0) + 1;
    typeAmtMap[s.type] = (typeAmtMap[s.type]||0) + Number(s.amount);
    sellerAmtMap[s.seller] = (sellerAmtMap[s.seller]||0) + Number(s.amount);
  });

  const palette = ['#e94560','#00d4ff','#f5a623','#00ff88','#9b59b6','#ff6b35','#1abc9c','#e74c3c','#3498db'];

  renderChart('chartCount', 'bar', Object.keys(typeMap), Object.values(typeMap), palette, 'Cantidad');
  renderChart('chartAmount', 'doughnut', Object.keys(typeAmtMap),
    Object.values(typeAmtMap).map(v => Math.round(v)), palette, 'Monto $');

  const sLabels = SELLERS.filter(s => sellerAmtMap[s]);
  const sColors = ['#ff3333','#3399ff','#33ff99','#ffdd00'];
  renderChart('chartSeller', 'bar', sLabels,
    sLabels.map(s => Math.round(sellerAmtMap[s]||0)), sColors, 'Total $');
}

function renderChart(id, type, labels, data, colors, label) {
  const ctx = document.getElementById(id);
  if (!ctx) return;

  if (charts[id]) charts[id].destroy();

  charts[id] = new Chart(ctx, {
    type,
    data: {
      labels,
      datasets: [{
        label,
        data,
        backgroundColor: colors,
        borderColor: colors.map(c => c + 'aa'),
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: {
            color: '#e8e8e8',
            font: { family: 'VT323', size: 14 }
          }
        },
        tooltip: {
          titleFont: { family: 'Press Start 2P', size: 9 },
          bodyFont: { family: 'VT323', size: 14 },
          callbacks: {
            label: ctx => ` ${ctx.formattedValue}${label.includes('$') ? ' USD' : ' ventas'}`
          }
        }
      },
      scales: type === 'bar' ? {
        x: { ticks: { color: '#e8e8e8', font: { family: 'VT323', size: 12 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#e8e8e8', font: { family: 'VT323', size: 12 } }, grid: { color: 'rgba(255,255,255,0.05)' } }
      } : undefined
    }
  });
}

// ===== EDIT MODAL =====
window.openEdit = function(id) {
  const s = allSales.find(x => x.id === id);
  if (!s) return;
  document.getElementById('editId').value = id;
  document.getElementById('editDate').value = s.date;
  document.getElementById('editType').value = s.type;
  document.getElementById('editSeller').value = s.seller;
  document.getElementById('editAmount').value = s.amount;
  document.getElementById('editModal').style.display = 'flex';
}

window.deleteSale = deleteSale;

// ===== EVENTS =====
function bindEvents() {
  document.getElementById('saveGoalsBtn').addEventListener('click', saveGoals);

  document.getElementById('filterMonth').addEventListener('change', renderAll);
  document.getElementById('filterSeller').addEventListener('change', () => renderTable(getFilteredSales()));
  document.getElementById('filterType').addEventListener('change', () => renderTable(getFilteredSales()));
  document.getElementById('clearFiltersBtn').addEventListener('click', () => {
    document.getElementById('filterSeller').value = '';
    document.getElementById('filterType').value = '';
    renderAll();
  });

  document.getElementById('addSaleBtn').addEventListener('click', async () => {
    const date = document.getElementById('saleDate').value;
    const type = document.getElementById('saleType').value;
    const seller = document.getElementById('saleSeller').value;
    const amount = parseFloat(document.getElementById('saleAmount').value);

    if (!date || !type || !seller || isNaN(amount) || amount <= 0) {
      showToast('⚠️ COMPLETA TODOS LOS CAMPOS', true); return;
    }

    await addSale({ date, type, seller, amount });
    document.getElementById('saleDate').value = '';
    document.getElementById('saleType').value = '';
    document.getElementById('saleSeller').value = '';
    document.getElementById('saleAmount').value = '';
  });

  document.getElementById('saveEditBtn').addEventListener('click', async () => {
    const id = document.getElementById('editId').value;
    const date = document.getElementById('editDate').value;
    const type = document.getElementById('editType').value;
    const seller = document.getElementById('editSeller').value;
    const amount = parseFloat(document.getElementById('editAmount').value);
    if (!date || !type || !seller || isNaN(amount)) { showToast('⚠️ DATOS INVÁLIDOS', true); return; }
    await updateSale(id, { date, type, seller, amount });
    document.getElementById('editModal').style.display = 'none';
  });

  document.getElementById('cancelEditBtn').addEventListener('click', () => {
    document.getElementById('editModal').style.display = 'none';
  });
}

// ===== TOAST =====
function showToast(msg, isError = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (isError ? ' error' : '');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}
