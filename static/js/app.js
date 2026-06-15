/*!
 * RoboInventory v2.0
 * Built by Abashesh Ranabhat
 * GitHub: https://github.com/Alpha107
 * © 2026 Abashesh Ranabhat. All rights reserved.
 */

// ── Globals ──────────────────────────────────────────────────────────────────
let currentPage = 'dashboard';
let charts = {};

// ── Init ──────────────────────────────────────────────────────────────────────
async function updateSidebarBadges() {
  const isAdmin = window._role === 'admin';
  const fetches = [
    fetch('/api/faulty',              { credentials: 'include' }).then(r => r.ok ? r.json() : []),
    fetch('/api/components/reorder',  { credentials: 'include' }).then(r => r.ok ? r.json() : []),
    isAdmin
      ? fetch('/api/requests/pending-count', { credentials: 'include' }).then(r => r.ok ? r.json() : {count:0})
      : Promise.resolve({count: 0}),
  ];
  const [faulty, reorder, pending] = await Promise.all(fetches);
  const faultyCount   = (faulty  || []).filter(f => f.status === 'active').length;
  const reorderCount  = (reorder || []).length;
  const pendingCount  = (pending || {}).count || 0;
  const set = (id, n) => { const el = document.getElementById(id); if (el) { el.textContent = n; el.style.display = n > 0 ? 'inline-block' : 'none'; } };
  set('sidebarFaultyBadge',   faultyCount);
  set('sidebarReorderBadge',  reorderCount);
  set('sidebarRequestsBadge', pendingCount);
}

function buildSidebar(role) {
  const nav = document.getElementById('sidebarNav');
  if (role === 'admin') {
    nav.innerHTML = `
      <a href="#" class="nav-item active" data-page="dashboard" onclick="navigate('dashboard',this)"><span class="nav-icon">📊</span><span>Dashboard</span></a>
      <div class="nav-section">INVENTORY</div>
      <a href="#" class="nav-item" data-page="components" onclick="navigate('components',this)"><span class="nav-icon">🔧</span><span>Components</span></a>
      <a href="#" class="nav-item" data-page="reorder" onclick="navigate('reorder',this)"><span class="nav-icon">🔴</span><span>Reorder List</span><span class="nav-badge pulse" id="sidebarReorderBadge" style="display:none">0</span></a>
      <a href="#" class="nav-item" data-page="pricing" onclick="navigate('pricing',this)"><span class="nav-icon">💰</span><span>Retail Pricing</span></a>
      <a href="#" class="nav-item" data-page="purchases" onclick="navigate('purchases',this)"><span class="nav-icon">🛒</span><span>Material Purchase</span></a>
      <div class="nav-section">PROJECTS</div>
      <a href="#" class="nav-item" data-page="ongoing" onclick="navigate('ongoing',this)"><span class="nav-icon">⚙️</span><span>Ongoing Projects</span></a>
      <a href="#" class="nav-item" data-page="upcoming" onclick="navigate('upcoming',this)"><span class="nav-icon">🗓️</span><span>Upcoming Projects</span></a>
      <a href="#" class="nav-item" data-page="completed" onclick="navigate('completed',this)"><span class="nav-icon">✅</span><span>Completed Projects</span></a>
      <a href="#" class="nav-item" data-page="packages" onclick="navigate('packages',this)"><span class="nav-icon">📦</span><span>Projects Package</span></a>
      <div class="nav-section">TRACKING</div>
      <a href="#" class="nav-item" data-page="usage" onclick="navigate('usage',this)"><span class="nav-icon">📋</span><span>Usage Timeline</span></a>
      <a href="#" class="nav-item" data-page="faulty" onclick="navigate('faulty',this)"><span class="nav-icon">⚠️</span><span>Faulty Items</span><span class="nav-badge pulse" id="sidebarFaultyBadge" style="display:none">0</span></a>
      <a href="#" class="nav-item" data-page="schools" onclick="navigate('schools',this)"><span class="nav-icon">🏫</span><span>Sold to School</span></a>
      <div class="nav-section">ADMIN</div>
      <a href="#" class="nav-item" data-page="adminRequests" onclick="navigate('adminRequests',this)"><span class="nav-icon">📬</span><span>Requests</span><span class="nav-badge pulse" id="sidebarRequestsBadge" style="display:none">0</span></a>
      <a href="#" class="nav-item" data-page="users" onclick="navigate('users',this)"><span class="nav-icon">👥</span><span>Users</span></a>
      <a href="#" class="nav-item" data-page="activityLog" onclick="navigate('activityLog',this)"><span class="nav-icon">📜</span><span>Activity Log</span></a>
      <a href="#" class="nav-item" data-page="settings" onclick="navigate('settings',this)"><span class="nav-icon">⚙️</span><span>Settings</span></a>
      <a href="#" class="nav-item logout-item" onclick="doLogout()"><span class="nav-icon">🚪</span><span>Logout</span></a>`;
  } else {
    nav.innerHTML = `
      <a href="#" class="nav-item active" data-page="inventoryView" onclick="navigate('inventoryView',this)"><span class="nav-icon">🔧</span><span>View Inventory</span></a>
      <div class="nav-section">REQUESTS</div>
      <a href="#" class="nav-item" data-page="myRequests" onclick="navigate('myRequests',this)"><span class="nav-icon">📋</span><span>My Requests</span></a>
      <a href="#" class="nav-item" data-page="newRequest" onclick="navigate('newRequest',this)"><span class="nav-icon">➕</span><span>New Request</span></a>
      <a href="#" class="nav-item logout-item" onclick="doLogout()"><span class="nav-icon">🚪</span><span>Logout</span></a>`;
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  try {
    const r = await api('/api/me');
    if (!r) return;
    window._csrfToken  = r.csrf_token;
    window._role       = r.role;
    window._fullName   = r.full_name;
    const displayName = r.full_name || r.username;
    document.getElementById('usernameDisplay').textContent = displayName;
    const av = document.getElementById('userAvatarInitial');
    if (av) av.textContent = displayName.charAt(0).toUpperCase();
    buildSidebar(r.role);
    const startPage = r.role === 'admin' ? 'dashboard' : 'inventoryView';
    navigate(startPage, document.querySelector(`[data-page="${startPage}"]`));
    updateSidebarBadges();
  } catch(e) { console.error('[init error]', e); window.location.href = '/'; }
});

// ── Utilities ─────────────────────────────────────────────────────────────────
function escHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function api(url, method = 'GET', body = null) {
  const opts = { method, credentials: 'include', headers: {} };
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  if (method !== 'GET' && window._csrfToken) {
    opts.headers['X-CSRF-Token'] = window._csrfToken;
  }
  const r = await fetch(url, opts);
  if (r.status === 401) { window.location.href = '/'; return null; }
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    toast(data?.error || `Request failed (${r.status})`, true);
    return null;
  }
  return data;
}

function toast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(() => t.className = 'toast', 3500);
}

function openModal(title, html, wide = false) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = html;
  document.querySelector('.modal-box').classList.toggle('wide', wide);
  document.getElementById('modalOverlay').classList.add('open');
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.querySelector('.modal-box').classList.remove('wide');
  if (window._confirmResolve) {
    const r = window._confirmResolve; window._confirmResolve = null; r(false);
  }
}

function confirmDialog(message, dangerLabel = 'Delete') {
  return new Promise(resolve => {
    window._confirmResolve = resolve;
    openModal('Confirm Action', `
      <div style="text-align:center;margin-bottom:16px;font-size:36px">⚠️</div>
      <p style="font-size:14px;color:var(--muted2);line-height:1.7;text-align:center;margin-bottom:24px">${escHtml(message)}</p>
      <div class="modal-footer" style="margin-top:0;justify-content:center">
        <button class="btn btn-secondary" onclick="window._confirmNo()">Cancel</button>
        <button class="btn btn-danger" onclick="window._confirmYes()">${escHtml(dangerLabel)}</button>
      </div>`);
  });
}
window._confirmYes = () => { const r=window._confirmResolve; window._confirmResolve=null; closeModal(); if(r) r(true); };
window._confirmNo  = () => { const r=window._confirmResolve; window._confirmResolve=null; closeModal(); if(r) r(false); };

function showSkeleton(cols = 7, rows = 5) {
  const cells = `<td style="padding:10px 14px"><div class="skeleton" style="height:13px;border-radius:4px"></div></td>`.repeat(cols);
  const bodyRows = `<tr style="border-bottom:1px solid rgba(0,0,0,0.06)">${cells}</tr>`.repeat(rows);
  return `<div class="page-fade">
    <div class="skeleton" style="height:38px;border-radius:10px;margin-bottom:18px"></div>
    <div class="table-card">
      <div class="table-wrap">
        <table class="data-table"><tbody>${bodyRows}</tbody></table>
      </div>
    </div>
  </div>`;
}

function setLoading(btn, loading, label = 'Save') {
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? 'Saving…' : label;
}

function toggleSidebar() {
  const s = document.getElementById('sidebar');
  const ov = document.getElementById('sidebarOverlay');
  if (window.innerWidth <= 768) {
    const opening = !s.classList.contains('open');
    s.classList.toggle('open');
    if (ov) ov.classList.toggle('show', opening);
  } else {
    const m = document.querySelector('.main-content');
    s.classList.toggle('hidden');
    m.classList.toggle('full');
  }
}

function navigate(page, el) {
  event && event.preventDefault();
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');
  currentPage = page;
  // Close mobile sidebar
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
    const ov = document.getElementById('sidebarOverlay');
    if (ov) ov.classList.remove('show');
  }
  const titles = {
    dashboard: 'Dashboard', components: 'Robotics Inventory',
    pricing: 'Retail Pricing', purchases: 'Material Purchase',
    ongoing: 'Ongoing Projects', upcoming: 'Upcoming Projects',
    completed: 'Completed Projects', packages: 'Projects Package',
    usage: 'Usage Timeline', faulty: 'Faulty Items',
    schools: 'Sold to School', settings: 'Settings', reorder: 'Reorder List',
    adminRequests: 'Component Requests', users: 'User Management',
    activityLog: 'Activity Log', inventoryView: 'Inventory',
    myRequests: 'My Requests', newRequest: 'New Request'
  };
  document.getElementById('pageTitle').textContent = titles[page] || page;
  const pc = document.getElementById('pageContainer');
  pc.innerHTML = showSkeleton();
  pages[page]();
  setTimeout(updateSidebarBadges, 800);
}

async function doLogout() {
  await api('/api/logout', 'POST');
  window.location.href = '/';
}

async function showDashboardList(type, title) {
  let items = [];
  if (type === 'components') {
    const data = await api('/api/components');
    items = (data || []).map(c => c.name);
  } else if (type === 'low-stock') {
    const data = await api('/api/components');
    items = (data || []).filter(c => (c.available ?? (c.total_purchased - c.used - c.taken_for_use - (c.faulty||0) - (c.sold||0))) < 5).map(c => c.name);
  } else if (type === 'faulty') {
    const data = await api('/api/faulty');
    items = [...new Set((data || []).filter(f => f.status === 'active').map(f => f.component_name))];
  }

  const listHtml = items.length
    ? `<ul style="list-style:none;padding:0;margin:0">${items.map(name => `
        <li style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;align-items:center;gap:10px">
          <span style="color:var(--accent)">•</span> ${escHtml(name)}
        </li>`).join('')}</ul>`
    : `<div class="empty-state"><p>No items to display</p></div>`;

  openModal(title, `
    <div style="max-height:400px;overflow-y:auto;margin:-10px -10px 0 -10px">${listHtml}</div>
    <div class="modal-footer" style="margin-top:10px">
      <button class="btn btn-secondary" onclick="closeModal()">Close</button>
    </div>`);
}

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-NP') : '—'; }
function npr(n) { return 'रु ' + (parseFloat(n)||0).toLocaleString('en-IN'); }

// ── Pages ─────────────────────────────────────────────────────────────────────
const pages = {};

// ── Read-only Inventory for regular users ──────────────────────────────────────
pages.inventoryView = async () => {
  const data = await api('/api/components');
  if (!data) return;
  const pc = document.getElementById('pageContainer');
  pc.innerHTML = `
  <div class="section-header">
    <div class="section-title">🔧 Component Inventory</div>
    <div class="section-actions">
      <div class="search-bar"><span>🔍</span><input placeholder="Search…" oninput="filterComponents(this.value)"></div>
    </div>
  </div>
  <div style="font-size:13px;color:var(--muted2);margin-bottom:16px">
    Read-only view. To use components, submit a <strong>New Request</strong>.
  </div>
  <div class="table-card"><div class="table-wrap">
    <table class="data-table">
      <thead><tr>
        <th>#</th><th>Component</th><th>Total</th><th>Available</th><th>Faulty</th><th>Remark</th>
      </tr></thead>
      <tbody id="compBody">
        ${data.length ? data.map((c,i) => {
          const avail = c.available ?? (c.total_purchased - c.used - c.taken_for_use - (c.faulty||0) - (c.sold||0));
          const ms = c.min_stock || 5;
          const badge = c.total_purchased > 0 && avail <= ms ? 'badge-red' : avail < ms*2 ? 'badge-yellow' : 'badge-green';
          const low = (c.min_stock||0) > 0 && avail <= (c.min_stock||0);
          return `<tr class="${low?'row-low-stock':''}">
            <td class="td-muted">${i+1}</td>
            <td><strong>${escHtml(c.name)}</strong></td>
            <td>${c.total_purchased||0}</td>
            <td><span class="badge ${badge}">${avail}</span></td>
            <td>${(c.faulty||0)>0?`<span class="badge badge-red">${c.faulty}</span>`:`<span style="color:var(--muted)">0</span>`}</td>
            <td class="td-muted">${escHtml(c.remark||'—')}</td>
          </tr>`;
        }).join('') : '<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">🔧</div><p>No components yet</p></div></td></tr>'}
      </tbody>
    </table>
  </div></div>`;
};

// DASHBOARD
pages.dashboard = async () => {
  const d = await api('/api/dashboard');
  if (!d) return;
  const pc = document.getElementById('pageContainer');
  pc.innerHTML = `
  <div class="kpi-grid">
    <div class="kpi-card blue" style="cursor:pointer" onclick="showDashboardList('components','Component Types')"><div class="kpi-icon-wrap">🔧</div><div class="kpi-value">${d.total_components}</div><div class="kpi-label">Component Types</div></div>
    <div class="kpi-card green"><div class="kpi-icon-wrap">💰</div><div class="kpi-value">रु${(d.total_inventory_value||0).toLocaleString()}</div><div class="kpi-label">Total Catalog Value</div></div>
    <div class="kpi-card purple"><div class="kpi-icon-wrap">🗂️</div><div class="kpi-value">${d.total_projects}</div><div class="kpi-label">Total Projects</div></div>
    <div class="kpi-card orange" style="cursor:pointer" onclick="showDashboardList('low-stock','Low Stock Items')"><div class="kpi-icon-wrap">⚠️</div><div class="kpi-value">${d.low_stock}</div><div class="kpi-label">Low Stock Items</div></div>
    <div class="kpi-card blue"><div class="kpi-icon-wrap">📦</div><div class="kpi-value">${d.total_items_purchased}</div><div class="kpi-label">Total Purchased</div></div>
    <div class="kpi-card green"><div class="kpi-icon-wrap">✅</div><div class="kpi-value">${d.total_available}</div><div class="kpi-label">Total Available</div></div>
    <div class="kpi-card purple"><div class="kpi-icon-wrap">🏫</div><div class="kpi-value">${d.total_sold||0}</div><div class="kpi-label">Total Sold</div></div>
    <div class="kpi-card orange" style="cursor:pointer" onclick="showDashboardList('faulty','Faulty Items')"><div class="kpi-icon-wrap">🔧</div><div class="kpi-value" style="color:var(--danger)">${d.total_faulty||0}</div><div class="kpi-label">Faulty Items</div></div>
  </div>
  <div class="charts-row">
    <div class="chart-card"><div class="chart-title">📈 Component Pricing (Top 8)</div><div class="chart-wrap"><canvas id="pricingChart"></canvas></div></div>
    <div class="chart-card"><div class="chart-title">📦 Inventory Status</div><div class="chart-wrap"><canvas id="stockChart"></canvas></div></div>
  </div>
  <div class="activity-card">
    <div class="chart-title">🕐 Recent Usage Activity</div>
    ${d.recent_usage.length ? d.recent_usage.map(u => `
      <div class="activity-item">
        <div class="activity-dot"></div>
        <div class="activity-info">
          <div class="activity-title">${escHtml(u.instructor || 'Unknown')} — ${escHtml(u.items || 'No items')}</div>
          <div class="activity-sub">${escHtml(u.remarks || '')}</div>
        </div>
        <div class="activity-time">${fmtDate(u.date)}</div>
      </div>`).join('') : '<div class="empty-state"><div class="empty-icon">📋</div><p>No usage records yet</p></div>'}
  </div>`;

  const pColors = ['#1a6b3a','#16a34a','#4ade80','#0ea5e9','#7c3aed','#f59e0b','#ef4444','#06b6d4'];
  const gridColor = 'rgba(0,0,0,0.06)';
  const tickColor = '#6b7c70';
  if (d.pricing_chart.length) {
    charts.pricing = new Chart(document.getElementById('pricingChart'), {
      type: 'bar',
      data: { labels: d.pricing_chart.map(x=>x.material), datasets: [{ data: d.pricing_chart.map(x=>x.retail_cost), backgroundColor: pColors, borderRadius: 6 }] },
      options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ x:{ticks:{color:tickColor,font:{size:10}}, grid:{color:gridColor}}, y:{ticks:{color:tickColor}, grid:{color:gridColor}} } }
    });
  }
  if (d.comp_chart.length) {
    charts.stock = new Chart(document.getElementById('stockChart'), {
      type: 'doughnut',
      data: { labels: d.comp_chart.map(x=>x.name), datasets: [{ data: d.comp_chart.map(x=>x.available||0), backgroundColor: pColors, borderWidth: 0, hoverOffset: 6 }] },
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'right', labels:{ color:tickColor, font:{size:11}, boxWidth:12 } } } }
    });
  }
};

// COMPONENTS (Robotics Inventory)
pages.components = async () => {
  const data = await api('/api/components');
  if (!data) return;
  const pc = document.getElementById('pageContainer');

  const nameCounts = {};
  data.forEach(c => { const k = c.name.trim().toLowerCase(); nameCounts[k] = (nameCounts[k] || 0) + 1; });
  const hasDupes = Object.values(nameCounts).some(n => n > 1);
  const dupeBanner = hasDupes ? `
    <div style="background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.35);border-radius:10px;padding:10px 16px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:12px">
      <span style="color:#f59e0b;font-size:13px">⚠️ Duplicate component names detected. Merge them to keep a single accurate record.</span>
      <button class="btn btn-secondary btn-sm" onclick="mergeDuplicates()" style="white-space:nowrap">🔀 Merge Duplicates</button>
    </div>` : '';

  pc.innerHTML = `
  <div class="section-header">
    <div class="section-title">🔧 Robotics Inventory</div>
    <div class="section-actions">
      <div class="search-bar"><span>🔍</span><input id="compSearch" placeholder="Search components..." oninput="filterComponents(this.value)"></div>
      <button class="btn btn-secondary" onclick="window.location='/api/export/components'">⬇️ CSV</button>
      <button class="btn btn-primary" onclick="showAddComponentModal()">➕ Add Component</button>
    </div>
  </div>
  ${dupeBanner}
  <div class="table-card">
    <div class="table-wrap">
      <table id="compTable">
        <thead><tr>
          <th>S.N</th><th>Component</th><th>Total Purchased</th><th>Used</th>
          <th>Available</th><th>Taken for Use</th><th style="color:var(--danger)">⚠️ Faulty</th><th>Sold</th><th>Min Stock</th><th>Remark</th><th>Actions</th>
        </tr></thead>
        <tbody id="compBody">
          ${data.length ? data.map((c,i) => compRow(c,i)).join('') : '<tr><td colspan="11"><div class="empty-state"><div class="empty-icon">🔧</div><p>No components yet</p></div></td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
  window._components = data;
};

async function mergeDuplicates() {
  const r = await api('/api/components/dedup', 'POST');
  if (!r) return;
  toast(r.merged > 0 ? `Merged ${r.merged} duplicate row(s)!` : 'No duplicates found.');
  pages.components();
}

function compRow(c, i) {
  const avail = c.available ?? (c.total_purchased - c.used - c.taken_for_use - (c.faulty||0) - (c.sold||0));
  const ms = c.min_stock || 5;
  const msYellow = c.min_stock ? Math.ceil(ms * 1.5) : 15;
  const badge = c.total_purchased > 0 && avail <= ms ? 'badge-red' : avail < msYellow ? 'badge-yellow' : 'badge-green';
  const faultyBadge = (c.faulty||0) > 0 ? `<span class="badge badge-red">${c.faulty}</span>` : `<span style="color:var(--muted)">0</span>`;
  const minStockBadge = (c.min_stock||0) > 0
    ? `<span class="badge ${avail <= (c.min_stock||0) ? 'badge-red' : 'badge-gray'}">${c.min_stock}</span>`
    : `<span style="color:var(--muted)">—</span>`;
  const lowStock = (c.min_stock||0) > 0 && avail <= (c.min_stock||0);
  return `<tr class="${lowStock ? 'row-low-stock' : ''}">
    <td class="td-muted">${i+1}</td>
    <td><strong>${escHtml(c.name)}</strong></td>
    <td>${c.total_purchased||0}</td>
    <td>${c.used||0}</td>
    <td><span class="badge ${badge}">${avail}</span></td>
    <td>${c.taken_for_use||0}</td>
    <td>${faultyBadge}</td>
    <td>${c.sold||0}</td>
    <td>${minStockBadge}</td>
    <td class="td-muted">${escHtml(c.remark||'—')}</td>
    <td><button class="btn btn-secondary btn-sm" onclick="editComponent(${c.id})">✏️</button> <button class="btn btn-danger btn-sm" onclick="deleteComponent(${c.id})">🗑️</button></td>
  </tr>`;
}

function filterComponents(q) {
  const rows = document.querySelectorAll('#compBody tr');
  rows.forEach(r => { r.style.display = r.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none'; });
}

// ── Multi-add component modal ─────────────────────────────────────────────────
let _bulkEntrySeq = 0;

function showAddComponentModal() {
  _bulkEntrySeq = 0;
  openModal('Add New Component', `
    <form onsubmit="saveBulkComponents(event)">
      <div id="bulk-entries">${_componentBulkEntry(0)}</div>
      <button type="button" class="btn btn-secondary" style="width:100%;margin-top:4px;margin-bottom:4px"
        onclick="addBulkEntry()">➕ Add Another Component</button>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary" id="bulkSaveBtn">Add Component(s)</button>
      </div>
    </form>`, true);
}

function _componentBulkEntry(idx) {
  const isFirst = idx === 0;
  return `<div class="bulk-entry" id="bulk-entry-${idx}" style="border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:10px;position:relative">
    ${!isFirst ? `<button type="button" class="btn btn-danger btn-sm" style="position:absolute;top:10px;right:10px;padding:2px 8px;font-size:13px" onclick="removeBulkEntry(${idx})">✕</button>` : ''}
    <div style="font-size:11px;font-weight:600;color:var(--muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px">Component ${idx + 1}</div>
    <div class="form-group"><label class="form-label">Component Name *</label>
      <input class="form-control" id="be_name_${idx}" required placeholder="e.g. Arduino Uno"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Total Purchased</label>
        <input class="form-control" id="be_total_${idx}" type="number" min="0" value="0"></div>
      <div class="form-group"><label class="form-label">Used</label>
        <input class="form-control" id="be_used_${idx}" type="number" min="0" value="0"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Taken for Use</label>
        <input class="form-control" id="be_taken_${idx}" type="number" min="0" value="0"></div>
      <div class="form-group"><label class="form-label">Sold</label>
        <input class="form-control" id="be_sold_${idx}" type="number" min="0" value="0"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label" style="color:var(--danger)">⚠️ Faulty</label>
        <input class="form-control" id="be_faulty_${idx}" type="number" min="0" value="0"></div>
      <div class="form-group"><label class="form-label">Min Stock Alert</label>
        <input class="form-control" id="be_min_${idx}" type="number" min="0" value="5" placeholder="5–8 recommended"></div>
    </div>
    <div class="form-group"><label class="form-label">Remark</label>
      <input class="form-control" id="be_remark_${idx}" placeholder="Optional note"></div>
  </div>`;
}

function addBulkEntry() {
  _bulkEntrySeq++;
  const container = document.getElementById('bulk-entries');
  const wrapper = document.createElement('div');
  wrapper.innerHTML = _componentBulkEntry(_bulkEntrySeq);
  container.appendChild(wrapper.firstElementChild);
  document.getElementById(`be_name_${_bulkEntrySeq}`).focus();
}

function removeBulkEntry(idx) {
  const el = document.getElementById(`bulk-entry-${idx}`);
  if (el) el.remove();
}

async function saveBulkComponents(e) {
  e.preventDefault();
  const btn = document.getElementById('bulkSaveBtn');
  setLoading(btn, true);
  const entries = document.querySelectorAll('.bulk-entry');
  let savedCount = 0;
  for (const entry of entries) {
    const idx = entry.id.replace('bulk-entry-', '');
    const nameEl = document.getElementById(`be_name_${idx}`);
    if (!nameEl || !nameEl.value.trim()) continue;
    const body = {
      name:            nameEl.value.trim(),
      total_purchased: +document.getElementById(`be_total_${idx}`).value  || 0,
      used:            +document.getElementById(`be_used_${idx}`).value   || 0,
      taken_for_use:   +document.getElementById(`be_taken_${idx}`).value  || 0,
      faulty:          +document.getElementById(`be_faulty_${idx}`).value || 0,
      sold:            +document.getElementById(`be_sold_${idx}`).value   || 0,
      min_stock:       +document.getElementById(`be_min_${idx}`).value    || 0,
      remark:           document.getElementById(`be_remark_${idx}`).value || ''
    };
    const r = await api('/api/components', 'POST', body);
    if (r) savedCount++;
  }
  setLoading(btn, false, 'Add Component(s)');
  if (savedCount > 0) {
    invalidateInventoryCache && invalidateInventoryCache();
    closeModal();
    toast(savedCount === 1 ? 'Component added!' : `${savedCount} components added!`);
    pages.components();
  }
}

function editComponent(id) {
  const c = window._components.find(x => x.id === id);
  if (!c) return;
  openModal('Edit Component', componentForm(c));
}

function componentForm(c) {
  return `<form onsubmit="saveComponent(event,${c.id})">
    <div class="form-group"><label class="form-label">Component Name *</label>
      <input class="form-control" id="cf_name" value="${escHtml(c.name)}" required placeholder="e.g. Arduino Uno"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Total Purchased</label>
        <input class="form-control" id="cf_total" type="number" min="0" value="${c.total_purchased}"></div>
      <div class="form-group"><label class="form-label">Used</label>
        <input class="form-control" id="cf_used" type="number" min="0" value="${c.used}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Taken for Use</label>
        <input class="form-control" id="cf_taken" type="number" min="0" value="${c.taken_for_use}"></div>
      <div class="form-group"><label class="form-label">Sold</label>
        <input class="form-control" id="cf_sold" type="number" min="0" value="${c.sold||0}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label" style="color:var(--danger)">⚠️ Faulty</label>
        <input class="form-control" id="cf_faulty" type="number" min="0" value="${c.faulty||0}"></div>
      <div class="form-group"><label class="form-label">Min Stock Alert</label>
        <input class="form-control" id="cf_min" type="number" min="0" value="${c.min_stock||5}" placeholder="5–8 recommended"></div>
    </div>
    <div class="form-group"><label class="form-label">Remark</label>
      <input class="form-control" id="cf_remark" value="${escHtml(c.remark||'')}" placeholder="Optional note"></div>
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="submit" class="btn btn-primary" id="cfSaveBtn">Update Component</button>
    </div>
  </form>`;
}

async function saveComponent(e, id) {
  e.preventDefault();
  const btn = document.getElementById('cfSaveBtn');
  setLoading(btn, true);
  const body = {
    name:            document.getElementById('cf_name').value,
    total_purchased: +document.getElementById('cf_total').value,
    used:            +document.getElementById('cf_used').value,
    taken_for_use:   +document.getElementById('cf_taken').value,
    faulty:          +document.getElementById('cf_faulty').value,
    sold:            +document.getElementById('cf_sold').value,
    min_stock:       +document.getElementById('cf_min').value,
    remark:           document.getElementById('cf_remark').value
  };
  const r = await api(`/api/components/${id}`, 'PUT', body);
  setLoading(btn, false, 'Update Component');
  if (!r) return;
  invalidateInventoryCache && invalidateInventoryCache();
  closeModal(); toast('Component updated!'); pages.components();
}

async function deleteComponent(id) {
  if (!await confirmDialog('Delete this component? This cannot be undone.')) return;
  const r = await api(`/api/components/${id}`, 'DELETE');
  if (!r) return;
  toast('Deleted!'); pages.components();
}

// REORDER LIST
pages.reorder = async () => {
  const data = await api('/api/components/reorder');
  if (!data) return;
  const pc = document.getElementById('pageContainer');
  pc.innerHTML = `
  <div class="section-header">
    <div class="section-title">🔴 Reorder List</div>
    <div class="section-actions">
      <button class="btn btn-secondary" onclick="window.location='/api/export/components'">⬇️ Export CSV</button>
    </div>
  </div>
  <div style="font-size:13px;color:var(--muted2);margin-bottom:16px">Components where <strong>Available ≤ Min Stock</strong> threshold. Set Min Stock on a component to enable alerts.</div>
  <div class="table-card"><div class="table-wrap">
    <table>
      <thead><tr><th>S.N</th><th>Component</th><th>Available</th><th>Min Stock</th><th>Shortage</th><th>Actions</th></tr></thead>
      <tbody>
        ${data.length ? data.map((c,i) => `<tr>
          <td class="td-muted">${i+1}</td>
          <td><strong>${escHtml(c.name)}</strong></td>
          <td><span class="badge badge-red">${c.available}</span></td>
          <td><span class="badge badge-yellow">${c.min_stock}</span></td>
          <td><span class="badge badge-red">Need ${Math.max(0, c.min_stock - c.available)} more</span></td>
          <td><button class="btn btn-secondary btn-sm" onclick="navigate('components',document.querySelector('[data-page=\\'components\\']'))">Go to Inventory</button></td>
        </tr>`).join('')
        : '<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">✅</div><p>All components are above their minimum stock levels</p></div></td></tr>'}
      </tbody>
    </table>
  </div></div>`;
};

// RETAIL PRICING
pages.pricing = async () => {
  const data = await api('/api/pricing');
  if (!data) return;
  document.getElementById('pageContainer').innerHTML = `
  <div class="section-header">
    <div class="section-title">💰 Retail Pricing</div>
    <div class="section-actions">
      <div class="search-bar"><span>🔍</span><input id="priceSearch" placeholder="Search materials..." oninput="filterTable('priceSearch','priceBody')"></div>
      <button class="btn btn-primary" onclick="showPricingModal(null)">➕ Add Item</button>
    </div>
  </div>
  <div class="table-card"><div class="table-wrap">
    <table><thead><tr><th>S.N</th><th>Material</th><th>Retail Cost (NPR)</th><th>Actions</th></tr></thead>
    <tbody id="priceBody">
      ${data.length ? data.map((p,i) => `<tr>
        <td class="td-muted">${i+1}</td>
        <td><strong>${escHtml(p.material)}</strong></td>
        <td><span style="color:var(--accent3);font-weight:600">रु ${(p.retail_cost||0).toLocaleString()}</span></td>
        <td><button class="btn btn-secondary btn-sm" onclick="showPricingModal(${p.id})">✏️</button> <button class="btn btn-danger btn-sm" onclick="deletePricing(${p.id})">🗑️</button></td>
      </tr>`).join('') : '<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">💰</div><p>No pricing data</p></div></td></tr>'}
    </tbody></table>
  </div></div>`;
  window._pricing = data;
};

function showPricingModal(id) {
  const p = id ? (window._pricing || []).find(x => x.id === id) : null;
  openModal(p ? 'Edit Pricing' : 'Add Pricing Item', `
  <form onsubmit="savePricing(event,${p ? p.id : 'null'})">
    <div class="form-group"><label class="form-label">Material Name *</label>
      <input class="form-control" id="pf_name" value="${p ? escHtml(p.material) : ''}" required placeholder="e.g. Arduino Uno DIP"></div>
    <div class="form-group"><label class="form-label">Retail Cost (NPR)</label>
      <input class="form-control" id="pf_cost" type="number" min="0" step="0.01" value="${p ? p.retail_cost : 0}"></div>
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="submit" class="btn btn-primary" id="pfSaveBtn">${p ? 'Update' : 'Add'}</button>
    </div>
  </form>`);
}

async function savePricing(e, id) {
  e.preventDefault();
  const btn = document.getElementById('pfSaveBtn');
  setLoading(btn, true);
  const body = { material: document.getElementById('pf_name').value, retail_cost: +document.getElementById('pf_cost').value };
  const r = await api(id ? `/api/pricing/${id}` : '/api/pricing', id ? 'PUT' : 'POST', body);
  setLoading(btn, false, id ? 'Update' : 'Add');
  if (!r) return;
  closeModal(); toast('Saved!'); pages.pricing();
}

async function deletePricing(id) {
  if (!await confirmDialog('Delete this pricing entry?')) return;
  const r = await api(`/api/pricing/${id}`, 'DELETE');
  if (!r) return;
  toast('Deleted!'); pages.pricing();
}

// MATERIAL PURCHASE
pages.purchases = async () => {
  const data = await api('/api/purchases');
  if (!data) return;
  window._purchases = data;

  const from = document.getElementById('pu_from')?.value || '';
  const to   = document.getElementById('pu_to')?.value   || '';

  const filtered = data.filter(p => {
    if (from && p.date < from) return false;
    if (to   && p.date > to)   return false;
    return true;
  });

  document.getElementById('pageContainer').innerHTML = `
  <div class="section-header">
    <div class="section-title">🛒 Material Purchase (Bill Entry)</div>
    <div class="section-actions">
      <div class="search-bar"><span>🔍</span><input id="purchSearch" placeholder="Search..." oninput="filterTable('purchSearch','purchBody')"></div>
      <button class="btn btn-secondary" onclick="window.location='/api/export/purchases'">⬇️ CSV</button>
      <button class="btn btn-primary" onclick="showPurchaseModal(null)">➕ Add Purchase</button>
    </div>
  </div>
  <div style="display:flex;gap:10px;align-items:center;margin-bottom:14px;flex-wrap:wrap">
    <label style="font-size:12px;color:var(--muted2)">From:</label>
    <input type="date" class="form-control" id="pu_from" value="${from}" style="width:150px" onchange="pages.purchases()">
    <label style="font-size:12px;color:var(--muted2)">To:</label>
    <input type="date" class="form-control" id="pu_to" value="${to}" style="width:150px" onchange="pages.purchases()">
    ${from||to ? `<button class="btn btn-secondary btn-sm" onclick="clearPurchaseFilter()">✕ Clear</button>` : ''}
    <span style="font-size:13px;color:var(--muted2);margin-left:auto">Showing ${filtered.length} of ${data.length} records</span>
  </div>
  <div class="table-card"><div class="table-wrap">
    <table><thead><tr><th>S.N</th><th>Date</th><th>Item</th><th>Supplier</th><th>Qty</th><th>Unit Price</th><th>Total</th><th>Invoice</th><th>Actions</th></tr></thead>
    <tbody id="purchBody">
      ${filtered.length ? filtered.map((p,i) => `<tr>
        <td class="td-muted">${i+1}</td>
        <td class="td-muted">${fmtDate(p.date)}</td>
        <td><strong>${escHtml(p.item)}</strong></td>
        <td class="td-muted">${escHtml(p.supplier||'—')}</td>
        <td>${p.quantity}</td>
        <td>${npr(p.unit_price)}</td>
        <td style="color:var(--accent3);font-weight:600">${npr(p.total)}</td>
        <td class="td-muted">${escHtml(p.invoice_no||'—')}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="showPurchaseModal(${p.id})">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deletePurchase(${p.id})">🗑️</button>
        </td>
      </tr>`).join('') : '<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">🛒</div><p>No purchase records</p></div></td></tr>'}
    </tbody></table>
  </div></div>`;
};

function clearPurchaseFilter() {
  window._puFrom = ''; window._puTo = '';
  pages.purchases();
}

async function showPurchaseModal(id) {
  const p = id ? (window._purchases || []).find(x => x.id === id) : null;
  const [components, pricing] = await Promise.all([
    api('/api/components'),
    api('/api/pricing')
  ]);
  if (!components || !pricing) return;

  const priceMap = {};
  pricing.forEach(pr => { priceMap[pr.material.toLowerCase()] = pr.retail_cost; });
  const datalistOptions = components.map(c => `<option value="${escHtml(c.name)}">`).join('');

  openModal(p ? 'Edit Purchase' : 'Add Purchase Record', `
  <datalist id="inventoryItems">${datalistOptions}</datalist>
  <form onsubmit="savePurchase(event,${p ? p.id : 'null'})">
    <div class="form-row">
      <div class="form-group"><label class="form-label">Date</label>
        <input class="form-control" id="pu_date" type="date" value="${p ? p.date : today()}"></div>
      <div class="form-group"><label class="form-label">Supplier</label>
        <input class="form-control" id="pu_supplier" value="${p ? escHtml(p.supplier||'') : ''}" placeholder="Supplier name"></div>
    </div>
    <div class="form-group">
      <label class="form-label">Item Name *
        <span style="font-size:11px;color:var(--accent);margin-left:6px;font-weight:400;text-transform:none">✨ Type to search inventory</span>
      </label>
      <input class="form-control" id="pu_item" list="inventoryItems" value="${p ? escHtml(p.item) : ''}"
        required placeholder="Start typing to search inventory items..." autocomplete="off"
        oninput="onPurchaseItemInput(this.value)">
      <div id="pu_item_hint" style="font-size:12px;color:var(--muted);margin-top:5px"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Quantity</label>
        <input class="form-control" id="pu_qty" type="number" min="1" value="${p ? p.quantity : 1}" oninput="updatePurchaseTotal()"></div>
      <div class="form-group"><label class="form-label">Unit Price (NPR)</label>
        <input class="form-control" id="pu_price" type="number" min="0" step="0.01" value="${p ? p.unit_price : 0}" oninput="updatePurchaseTotal()"></div>
    </div>
    <div class="form-group">
      <label class="form-label">Total Amount</label>
      <div id="pu_total_display" style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:10px;padding:10px 14px;font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:700;color:var(--accent3)">
        रु ${p ? (p.total||0).toLocaleString() : '0'}
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Invoice No.</label>
        <input class="form-control" id="pu_invoice" value="${p ? escHtml(p.invoice_no||'') : ''}" placeholder="Optional"></div>
      <div class="form-group"><label class="form-label">Notes</label>
        <input class="form-control" id="pu_notes" value="${p ? escHtml(p.notes||'') : ''}" placeholder="Optional"></div>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="submit" class="btn btn-primary" id="puSaveBtn">${p ? 'Update' : 'Add'} Purchase</button>
    </div>
  </form>`);

  window._purchasePriceMap = priceMap;
  window._purchaseComponents = components;
  if (p) onPurchaseItemInput(p.item);
  updatePurchaseTotal();
}

function onPurchaseItemInput(val) {
  const hint = document.getElementById('pu_item_hint');
  if (!hint) return;
  const comps = window._purchaseComponents || [];
  const match = comps.find(c => c.name.toLowerCase() === val.toLowerCase());
  if (match) {
    const avail = match.available ?? (match.total_purchased - match.used - match.taken_for_use);
    hint.innerHTML = `<span style="color:var(--accent3)">✅ Found in inventory</span> —
      Total: <strong>${match.total_purchased}</strong> &nbsp;|
      Used: <strong>${match.used}</strong> &nbsp;|
      Available: <strong style="color:${avail < 5 ? 'var(--danger)' : 'var(--accent3)'}">${avail}</strong>`;
    const priceField = document.getElementById('pu_price');
    if (priceField && (+priceField.value === 0)) {
      const known = (window._purchasePriceMap || {})[val.toLowerCase()];
      if (known) { priceField.value = known; updatePurchaseTotal(); }
    }
  } else if (val.trim()) {
    hint.innerHTML = `<span style="color:var(--warning)">⚠️ Not in inventory — will be created as new component on save.</span>`;
  } else {
    hint.innerHTML = '';
  }
}

function updatePurchaseTotal() {
  const qty = parseFloat(document.getElementById('pu_qty')?.value) || 0;
  const price = parseFloat(document.getElementById('pu_price')?.value) || 0;
  const el = document.getElementById('pu_total_display');
  if (el) el.textContent = 'रु ' + (qty * price).toLocaleString('en-IN');
}

async function savePurchase(e, id) {
  e.preventDefault();
  const btn = document.getElementById('puSaveBtn');
  setLoading(btn, true);
  const body = {
    date:       document.getElementById('pu_date').value,
    supplier:   document.getElementById('pu_supplier').value,
    item:       document.getElementById('pu_item').value,
    quantity:  +document.getElementById('pu_qty').value,
    unit_price:+document.getElementById('pu_price').value,
    invoice_no: document.getElementById('pu_invoice').value,
    notes:      document.getElementById('pu_notes').value
  };
  const r = await api(id ? `/api/purchases/${id}` : '/api/purchases', id ? 'PUT' : 'POST', body);
  setLoading(btn, false, id ? 'Update Purchase' : 'Add Purchase');
  if (!r) return;
  closeModal(); toast('Saved!'); pages.purchases();
}

async function deletePurchase(id) {
  if (!await confirmDialog('Delete this purchase record? The inventory total will be adjusted.')) return;
  const r = await api(`/api/purchases/${id}`, 'DELETE');
  if (!r) return;
  toast('Deleted!'); pages.purchases();
}

// Generic table filter
function filterTable(inputId, bodyId) {
  const q = document.getElementById(inputId).value.toLowerCase();
  document.querySelectorAll(`#${bodyId} tr`).forEach(r => { r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none'; });
}

// ── Sidebar credit: slide up when cursor nears bottom-left corner ─────────────
document.addEventListener('mousemove', (e) => {
  const credit = document.querySelector('.sidebar-credit');
  const sidebar = document.getElementById('sidebar');
  if (!credit || !sidebar) return;
  const sidebarW = sidebar.offsetWidth;
  const inZone = e.clientX < sidebarW && e.clientY > window.innerHeight - 90;
  credit.classList.toggle('visible', inZone);
});
