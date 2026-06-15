/*!
 * RoboInventory v2.0 — pages.js
 * Built by Abashesh Ranabhat
 * GitHub: https://github.com/Alpha107
 * © 2026 Abashesh Ranabhat. All rights reserved.
 */

// ── Shared inventory cache & datalist builder ──────────────────────────────────
let _cachedComponents = null;

async function getInventoryComponents(forceRefresh = false) {
  if (!_cachedComponents || forceRefresh) {
    _cachedComponents = await api('/api/components');
  }
  return _cachedComponents || [];
}

function buildDatalist(id) {
  const comps = _cachedComponents || [];
  return `<datalist id="${id}">${comps.map(c => `<option value="${escHtml(c.name)}">`).join('')}</datalist>`;
}

function invalidateInventoryCache() { _cachedComponents = null; }

// ── Faulty Items ───────────────────────────────────────────────────────────────
pages.faulty = async () => {
  const data = await api('/api/faulty');
  if (!data) return;
  window._faulty = data;
  const statusColor = { active: 'badge-red', repaired: 'badge-green', discarded: 'badge-yellow' };

  document.getElementById('pageContainer').innerHTML = `
  <div class="section-header">
    <div class="section-title">⚠️ Faulty Items Log</div>
    <div class="section-actions">
      <div class="search-bar"><span>🔍</span><input id="faultySearch" placeholder="Search..." oninput="filterTable('faultySearch','faultyBody')"></div>
      <button class="btn btn-primary" onclick="showFaultyModal(null)">➕ Log Faulty Item</button>
    </div>
  </div>

  <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:24px">
    <div class="kpi-card orange" style="border-color:rgba(239,68,68,0.35)">
      <div class="kpi-icon">🔧</div>
      <div class="kpi-value" style="color:var(--danger)">${data.filter(d=>d.status==='active').reduce((s,d)=>s+d.quantity,0)}</div>
      <div class="kpi-label">Currently Faulty</div>
    </div>
    <div class="kpi-card green">
      <div class="kpi-icon">✅</div>
      <div class="kpi-value">${data.filter(d=>d.status==='repaired').reduce((s,d)=>s+d.quantity,0)}</div>
      <div class="kpi-label">Repaired</div>
    </div>
    <div class="kpi-card orange">
      <div class="kpi-icon">🗑️</div>
      <div class="kpi-value">${data.filter(d=>d.status==='discarded').reduce((s,d)=>s+d.quantity,0)}</div>
      <div class="kpi-label">Discarded</div>
    </div>
  </div>

  <div class="table-card"><div class="table-wrap">
    <table>
      <thead><tr>
        <th>S.N</th><th>Date</th><th>Component</th><th>Qty Faulty</th>
        <th>Reason</th><th>Reported By</th><th>Status</th><th>Actions</th>
      </tr></thead>
      <tbody id="faultyBody">
        ${data.length ? data.map((f, i) => `<tr>
          <td class="td-muted">${i+1}</td>
          <td class="td-muted">${fmtDate(f.date)}</td>
          <td><strong>${escHtml(f.component_name)}</strong></td>
          <td><span class="badge badge-red">${f.quantity}</span></td>
          <td class="td-muted">${escHtml(f.reason || '—')}</td>
          <td class="td-muted">${escHtml(f.reported_by || '—')}</td>
          <td>
            <span class="badge ${statusColor[f.status]||'badge-gray'}"
              style="cursor:${f.status !== 'discarded' ? 'pointer' : 'default'}"
              onclick="cycleFaultyStatus(${f.id},'${f.status}')"
              title="${f.status !== 'discarded' ? 'Click to advance status' : 'Discarded — edit to change'}">
              ${f.status.charAt(0).toUpperCase()+f.status.slice(1)}
            </span>
          </td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="showFaultyModal(${f.id})">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="deleteFaulty(${f.id})">🗑️</button>
          </td>
        </tr>`).join('')
        : '<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">⚠️</div><p>No faulty items logged</p></div></td></tr>'}
      </tbody>
    </table>
  </div></div>`;
};

async function cycleFaultyStatus(id, currentStatus) {
  // One-way cycle: active → repaired → discarded (no return from discarded)
  const cycle = { active: 'repaired', repaired: 'discarded' };
  const next = cycle[currentStatus];
  if (!next) return;
  const entry = (window._faulty || []).find(f => f.id === id);
  if (!entry) return;
  const r = await api(`/api/faulty/${id}`, 'PUT', { ...entry, status: next });
  if (!r) return;
  invalidateInventoryCache();
  toast(`Status → ${next}`);
  pages.faulty();
}

async function showFaultyModal(id) {
  const f = id ? (window._faulty || []).find(x => x.id === id) : null;
  await getInventoryComponents(true);
  const dl = buildDatalist('faultyCompList');

  openModal(f ? 'Edit Faulty Entry' : 'Log Faulty Item', `
  ${dl}
  <form onsubmit="saveFaulty(event,${f ? f.id : 'null'})">
    <div class="form-row">
      <div class="form-group"><label class="form-label">Date *</label>
        <input class="form-control" id="ft_date" type="date" value="${f ? f.date : today()}" required></div>
      <div class="form-group"><label class="form-label">Reported By</label>
        <input class="form-control" id="ft_reporter" value="${f ? escHtml(f.reported_by||'') : ''}" placeholder="Person who found the fault"></div>
    </div>
    <div class="form-group">
      <label class="form-label">Component Name *
        <span style="font-size:11px;color:var(--accent);margin-left:6px;font-weight:400;text-transform:none">✨ From inventory</span>
      </label>
      <input class="form-control" id="ft_name" list="faultyCompList"
        value="${f ? escHtml(f.component_name) : ''}" required autocomplete="off"
        placeholder="Type to search inventory...">
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label" style="color:var(--danger)">⚠️ Quantity Faulty *</label>
        <input class="form-control" id="ft_qty" type="number" min="1" value="${f ? f.quantity : 1}" required></div>
      <div class="form-group"><label class="form-label">Status</label>
        <select class="form-control" id="ft_status">
          ${['active','repaired','discarded'].map(s =>
            `<option value="${s}" ${(f ? f.status : 'active') === s ? 'selected' : ''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
          ).join('')}
        </select></div>
    </div>
    <div class="form-group"><label class="form-label">Reason / Description</label>
      <input class="form-control" id="ft_reason" value="${f ? escHtml(f.reason||'') : ''}"
        placeholder="e.g. Short circuit, physical damage, overheating..."></div>
    <div style="background:#e8f4ed;border:1px solid #c6d9cb;border-radius:8px;padding:12px;margin-bottom:16px;font-size:13px;color:var(--muted)">
      ℹ️ <strong>Active</strong> faulty items decrease Available stock automatically.
      Changing status to <strong>Repaired</strong> or <strong>Discarded</strong> restores that stock.
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="submit" class="btn btn-primary" id="ftSaveBtn">${f ? 'Update' : 'Log Faulty Item'}</button>
    </div>
  </form>`);
}

async function saveFaulty(e, id) {
  e.preventDefault();
  const btn = document.getElementById('ftSaveBtn');
  setLoading(btn, true);
  const body = {
    component_name: document.getElementById('ft_name').value,
    quantity:      +document.getElementById('ft_qty').value,
    reason:         document.getElementById('ft_reason').value,
    reported_by:    document.getElementById('ft_reporter').value,
    date:           document.getElementById('ft_date').value,
    status:         document.getElementById('ft_status').value
  };
  const r = await api(id ? `/api/faulty/${id}` : '/api/faulty', id ? 'PUT' : 'POST', body);
  setLoading(btn, false, id ? 'Update' : 'Log Faulty Item');
  if (!r) return;
  invalidateInventoryCache();
  closeModal(); toast(id ? 'Faulty entry updated!' : 'Faulty item logged!');
  pages.faulty();
}

async function deleteFaulty(id) {
  if (!await confirmDialog('Delete this faulty entry? The inventory will be updated accordingly.')) return;
  const r = await api(`/api/faulty/${id}`, 'DELETE');
  if (!r) return;
  invalidateInventoryCache();
  toast('Deleted and inventory restored!');
  pages.faulty();
}

// ── Projects (Ongoing / Upcoming / Completed) ─────────────────────────────────
async function loadProjects(status) {
  const data = await api(`/api/projects?status=${status}`);
  if (!data) return;
  window._projects = data;
  const labels = { ongoing: '⚙️ Ongoing Projects', upcoming: '🗓️ Upcoming Projects', completed: '✅ Completed Projects' };
  const badgeMap = { ongoing: 'badge-blue', upcoming: 'badge-yellow', completed: 'badge-green' };

  document.getElementById('pageContainer').innerHTML = `
  <div class="section-header">
    <div class="section-title">${labels[status]}</div>
    <button class="btn btn-primary" onclick="showProjectModal(null,'${status}')">➕ New Project</button>
  </div>
  ${data.length ? `<div class="projects-grid">${data.map(p => `
    <div class="project-card">
      <div class="project-card-header">
        <div>
          <div class="project-name">${escHtml(p.project_name)}</div>
          <div class="project-made-by">👤 ${escHtml(p.made_by || 'Not assigned')}</div>
        </div>
        <span class="badge ${badgeMap[p.status]}">${p.status}</span>
      </div>
      ${p.remark ? `<div style="font-size:13px;color:var(--muted2);margin-bottom:10px">📝 ${escHtml(p.remark)}</div>` : ''}
      ${p.components.length ? `<div class="project-components">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:var(--muted);margin-bottom:6px">Components Used</div>
        ${p.components.map(c => `<div class="project-comp-item"><span>${escHtml(c.component)}</span><span class="badge badge-gray">×${c.quantity}</span></div>`).join('')}
      </div>` : '<div style="font-size:13px;color:var(--muted)">No components listed</div>'}
      <div class="project-actions">
        <button class="btn btn-secondary btn-sm" onclick="showProjectModal(${p.id},'${status}')">✏️ Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteProject(${p.id})">🗑️</button>
        ${status !== 'completed' ? `<button class="btn btn-success btn-sm" onclick="updateProjectStatus(${p.id},'completed')">✅ Complete</button>` : ''}
        ${status === 'upcoming' ? `<button class="btn btn-secondary btn-sm" onclick="updateProjectStatus(${p.id},'ongoing')">▶️ Start</button>` : ''}
      </div>
    </div>`).join('')}</div>`
  : `<div class="empty-state"><div class="empty-icon">${status === 'ongoing' ? '⚙️' : status === 'upcoming' ? '🗓️' : '🏆'}</div><p>No ${status} projects yet</p></div>`}`;
}

pages.ongoing = () => loadProjects('ongoing');
pages.upcoming = () => loadProjects('upcoming');
pages.completed = () => loadProjects('completed');

async function showProjectModal(id, defaultStatus) {
  const p = id ? (window._projects || []).find(x => x.id === id) : null;
  await getInventoryComponents(true);
  const dl = buildDatalist('projCompList');

  let comps = p ? p.components.map(c => ({...c})) : [];
  window._pjComps = comps;

  const renderComps = () => window._pjComps.map((c, i) => `
    <div class="material-row" id="pcomp_${i}">
      <input class="form-control" placeholder="Type component name..." list="projCompList"
        value="${escHtml(c.component)}" autocomplete="off"
        oninput="_pjComps[${i}].component=this.value">
      <input class="form-control" type="number" min="1" value="${c.quantity}" style="width:70px"
        oninput="_pjComps[${i}].quantity=+this.value">
      <button type="button" class="btn btn-danger btn-sm btn-icon" onclick="removePjComp(${i})">✕</button>
    </div>`).join('');

  window.removePjComp = (i) => { window._pjComps.splice(i, 1); document.getElementById('pjCompsList').innerHTML = renderComps(); };
  window.addPjComp   = ()  => { window._pjComps.push({ component: '', quantity: 1 }); document.getElementById('pjCompsList').innerHTML = renderComps(); };

  openModal(p ? 'Edit Project' : 'New Project', `
  ${dl}
  <form onsubmit="saveProject(event,${p ? p.id : 'null'})">
    <div class="form-row">
      <div class="form-group"><label class="form-label">Project Name *</label>
        <input class="form-control" id="pj_name" value="${p ? escHtml(p.project_name) : ''}" required placeholder="Project name"></div>
      <div class="form-group"><label class="form-label">Status</label>
        <select class="form-control" id="pj_status">
          ${['ongoing','upcoming','completed'].map(s => `<option value="${s}" ${(p ? p.status : defaultStatus) === s ? 'selected' : ''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
        </select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Made By</label>
        <input class="form-control" id="pj_made" value="${p ? escHtml(p.made_by||'') : ''}" placeholder="Team members"></div>
      <div class="form-group"><label class="form-label">Remark</label>
        <input class="form-control" id="pj_remark" value="${p ? escHtml(p.remark||'') : ''}" placeholder="Notes"></div>
    </div>
    <div class="form-group">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <label class="form-label" style="margin:0">Components Used
          <span style="font-size:11px;color:var(--accent);margin-left:6px;font-weight:400;text-transform:none">✨ Inventory dropdown</span>
        </label>
        <button type="button" class="btn btn-secondary btn-sm" onclick="addPjComp()">+ Add Row</button>
      </div>
      <div id="pjCompsList">${renderComps()}</div>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="submit" class="btn btn-primary" id="pjSaveBtn">${p ? 'Update' : 'Create'} Project</button>
    </div>
  </form>`);
}

async function saveProject(e, id) {
  e.preventDefault();
  const btn = document.getElementById('pjSaveBtn');
  setLoading(btn, true);
  const status = document.getElementById('pj_status').value;
  const body = {
    project_name: document.getElementById('pj_name').value,
    made_by:      document.getElementById('pj_made').value,
    status,
    remark:       document.getElementById('pj_remark').value,
    components:   (window._pjComps || []).filter(c => c.component)
  };
  const r = await api(id ? `/api/projects/${id}` : '/api/projects', id ? 'PUT' : 'POST', body);
  setLoading(btn, false, id ? 'Update Project' : 'Create Project');
  if (!r) return;
  invalidateInventoryCache();
  closeModal(); toast('Project saved!'); pages[status]();
}

async function deleteProject(id) {
  if (!await confirmDialog('Delete this project? This cannot be undone.')) return;
  const r = await api(`/api/projects/${id}`, 'DELETE');
  if (!r) return;
  invalidateInventoryCache();
  toast('Deleted!'); pages[currentPage]();
}

async function updateProjectStatus(id, newStatus) {
  const p = (window._projects || []).find(x => x.id === id);
  if (!p) return;
  const r = await api(`/api/projects/${id}`, 'PUT', { ...p, status: newStatus, components: p.components });
  if (!r) return;
  invalidateInventoryCache();
  toast('Status updated!'); pages[currentPage]();
}

// PROJECTS PACKAGE
pages.packages = async () => {
  const data = await api('/api/packages');
  if (!data) return;
  window._packages = data;
  document.getElementById('pageContainer').innerHTML = `
  <div class="section-header">
    <div class="section-title">📦 Projects Package</div>
    <button class="btn btn-primary" onclick="showPackageModal(null)">➕ New Package</button>
  </div>
  ${data.length ? `<div class="projects-grid">${data.map(p => `
    <div class="project-card">
      <div class="project-card-header">
        <div>
          <div class="project-name">${escHtml(p.project_name)}</div>
          <div class="project-made-by">📚 ${escHtml(p.course || '—')}</div>
        </div>
        <span class="badge badge-purple">${escHtml(p.level || 'N/A')}</span>
      </div>
      ${p.materials.length ? `<div class="project-components">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:var(--muted);margin-bottom:6px">Required Materials</div>
        ${p.materials.map(m => `<div class="project-comp-item"><span>${escHtml(m.material)}</span><div style="display:flex;gap:8px;align-items:center"><span class="badge badge-gray">×${m.quantity}</span>${m.price ? `<span style="color:var(--accent3);font-size:12px">${npr(m.price)}</span>` : ''}</div></div>`).join('')}
        <div style="display:flex;justify-content:flex-end;padding-top:10px;border-top:1px solid var(--border);margin-top:6px">
          <span style="font-weight:700;color:var(--accent3)">${npr(p.total)} total</span>
        </div>
      </div>` : '<div style="font-size:13px;color:var(--muted)">No materials listed</div>'}
      <div class="project-actions">
        <button class="btn btn-secondary btn-sm" onclick="showPackageModal(${p.id})">✏️ Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deletePackage(${p.id})">🗑️</button>
      </div>
    </div>`).join('')}</div>`
  : '<div class="empty-state"><div class="empty-icon">📦</div><p>No packages yet</p></div>'}`;
};

async function showPackageModal(id) {
  const p = id ? (window._packages || []).find(x => x.id === id) : null;
  await getInventoryComponents(true);
  const dl = buildDatalist('pkgMatList');

  let mats = p ? p.materials.map(m => ({...m})) : [];
  window._pkgMats = mats;

  const renderMats = () => window._pkgMats.map((m, i) => `
    <div class="material-row" style="grid-template-columns:2fr 60px 80px auto">
      <input class="form-control" placeholder="Type material name..." list="pkgMatList"
        value="${escHtml(m.material)}" autocomplete="off"
        oninput="_pkgMats[${i}].material=this.value">
      <input class="form-control" type="number" min="1" value="${m.quantity}" placeholder="Qty"
        oninput="_pkgMats[${i}].quantity=+this.value">
      <input class="form-control" type="number" min="0" value="${m.price}" placeholder="Price"
        oninput="_pkgMats[${i}].price=+this.value">
      <button type="button" class="btn btn-danger btn-sm btn-icon" onclick="removePkgMat(${i})">✕</button>
    </div>`).join('');

  window.removePkgMat = i => { window._pkgMats.splice(i, 1); document.getElementById('pkgMatsList').innerHTML = renderMats(); };
  window.addPkgMat    = () => { window._pkgMats.push({ material: '', quantity: 1, price: 0 }); document.getElementById('pkgMatsList').innerHTML = renderMats(); };

  openModal(p ? 'Edit Package' : 'New Project Package', `
  ${dl}
  <form onsubmit="savePackage(event,${p ? p.id : 'null'})">
    <div class="form-group"><label class="form-label">Project Name *</label>
      <input class="form-control" id="pkg_name" value="${p ? escHtml(p.project_name) : ''}" required></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Level</label>
        <input class="form-control" id="pkg_level" value="${p ? escHtml(p.level||'') : ''}" placeholder="e.g. Intermediate"></div>
      <div class="form-group"><label class="form-label">Course</label>
        <input class="form-control" id="pkg_course" value="${p ? escHtml(p.course||'') : ''}" placeholder="e.g. 30 Days Intermediate"></div>
    </div>
    <div class="form-group">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <label class="form-label" style="margin:0">Required Materials
          <span style="font-size:11px;color:var(--accent);margin-left:6px;font-weight:400;text-transform:none">✨ Inventory dropdown</span>
        </label>
        <button type="button" class="btn btn-secondary btn-sm" onclick="addPkgMat()">+ Add Row</button>
      </div>
      <div style="display:grid;grid-template-columns:2fr 60px 80px auto;gap:6px;margin-bottom:4px">
        <small style="color:var(--muted)">Material</small><small style="color:var(--muted)">Qty</small><small style="color:var(--muted)">Price (NPR)</small><span></span>
      </div>
      <div id="pkgMatsList">${renderMats()}</div>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="submit" class="btn btn-primary" id="pkgSaveBtn">${p ? 'Update' : 'Create'}</button>
    </div>
  </form>`);
}

async function savePackage(e, id) {
  e.preventDefault();
  const btn = document.getElementById('pkgSaveBtn');
  setLoading(btn, true);
  const body = {
    project_name: document.getElementById('pkg_name').value,
    level:        document.getElementById('pkg_level').value,
    course:       document.getElementById('pkg_course').value,
    materials:    (window._pkgMats || []).filter(m => m.material)
  };
  const r = await api(id ? `/api/packages/${id}` : '/api/packages', id ? 'PUT' : 'POST', body);
  setLoading(btn, false, id ? 'Update' : 'Create');
  if (!r) return;
  closeModal(); toast('Package saved!'); pages.packages();
}

async function deletePackage(id) {
  if (!await confirmDialog('Delete this package?')) return;
  const r = await api(`/api/packages/${id}`, 'DELETE');
  if (!r) return;
  toast('Deleted!'); pages.packages();
}

// USAGE TIMELINE
pages.usage = async () => {
  const data = await api('/api/usage');
  if (!data) return;
  window._usage = data;

  const from = document.getElementById('us_from')?.value || '';
  const to   = document.getElementById('us_to')?.value   || '';
  const filtered = data.filter(u => {
    if (from && u.date < from) return false;
    if (to   && u.date > to)   return false;
    return true;
  });

  document.getElementById('pageContainer').innerHTML = `
  <div class="section-header">
    <div class="section-title">📋 Usage Timeline</div>
    <button class="btn btn-primary" onclick="showUsageModal(null)">➕ Add Entry</button>
  </div>
  <div style="display:flex;gap:10px;align-items:center;margin-bottom:14px;flex-wrap:wrap">
    <label style="font-size:12px;color:var(--muted2)">From:</label>
    <input type="date" class="form-control" id="us_from" value="${from}" style="width:150px" onchange="pages.usage()">
    <label style="font-size:12px;color:var(--muted2)">To:</label>
    <input type="date" class="form-control" id="us_to" value="${to}" style="width:150px" onchange="pages.usage()">
    ${from||to ? `<button class="btn btn-secondary btn-sm" onclick="pages.usage()">✕ Clear</button>` : ''}
    <span style="font-size:13px;color:var(--muted2);margin-left:auto">Showing ${filtered.length} of ${data.length} entries</span>
  </div>
  <div class="table-card"><div class="table-wrap">
    <table><thead><tr>
      <th>S.N</th><th>Date</th><th>Instructor</th><th>Components Taken</th>
      <th>Remarks</th><th>Return Status</th><th>Actions</th>
    </tr></thead>
    <tbody>
      ${filtered.length ? filtered.map((u, i) => {
        const allReturned = u.components.length > 0 && u.components.every(c => c.returned);
        const anyUnreturned = u.components.some(c => !c.returned);
        const statusBadge = allReturned
          ? '<span class="badge badge-green">✅ All Returned</span>'
          : anyUnreturned && u.components.some(c => c.returned)
            ? '<span class="badge badge-yellow">⚠️ Partial</span>'
            : '<span class="badge badge-red">❌ Pending</span>';
        return `<tr>
          <td class="td-muted">${i+1}</td>
          <td class="td-muted">${fmtDate(u.date)}</td>
          <td><strong>${escHtml(u.instructor || '—')}</strong></td>
          <td style="min-width:220px">
            ${u.components.length ? u.components.map(c => `
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
                <span style="font-size:13px;flex:1">${escHtml(c.component)} <strong>×${c.quantity}</strong></span>
                <span class="badge ${c.returned ? 'badge-green' : 'badge-red'}"
                  style="cursor:pointer;font-size:10px" onclick="toggleReturn(${c.id})"
                  title="Click to toggle return status">
                  ${c.returned ? '✅ Returned' : '❌ Not Returned'}
                </span>
              </div>`).join('') : '<span class="td-muted">—</span>'}
            ${anyUnreturned ? `
              <button class="btn btn-success btn-sm" style="margin-top:6px;font-size:11px"
                onclick="returnAllItems(${u.id})">↩️ Return All</button>` : ''}
          </td>
          <td class="td-muted">${escHtml(u.remarks || '—')}</td>
          <td>${statusBadge}</td>
          <td style="white-space:nowrap">
            <button class="btn btn-secondary btn-sm" onclick="showUsageModal(${u.id})">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="deleteUsage(${u.id})">🗑️</button>
          </td>
        </tr>`;
      }).join('') : '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📋</div><p>No usage records yet</p></div></td></tr>'}
    </tbody></table>
  </div></div>`;
};

async function toggleReturn(ucid) {
  const r = await api(`/api/usage/return/${ucid}`, 'PUT');
  if (!r) return;
  invalidateInventoryCache();
  pages.usage();
}

async function returnAllItems(usageId) {
  if (!await confirmDialog('Mark ALL items in this entry as returned?', 'Return All')) return;
  const r = await api(`/api/usage/${usageId}/return-all`, 'PUT');
  if (!r) return;
  invalidateInventoryCache();
  toast('All items marked as returned!');
  pages.usage();
}

async function showUsageModal(id) {
  const u = id ? (window._usage || []).find(x => x.id === id) : null;
  await getInventoryComponents(true);
  const dl = buildDatalist('usageCompList');

  let uComps = u ? u.components.map(c => ({...c})) : [];
  window._uComps = uComps;

  const renderUComps = () => window._uComps.map((c, i) => `
    <div class="material-row" style="grid-template-columns:1fr 70px auto">
      <input class="form-control" placeholder="Type component name..." list="usageCompList"
        value="${escHtml(c.component)}" autocomplete="off"
        oninput="_uComps[${i}].component=this.value">
      <input class="form-control" type="number" min="1" value="${c.quantity}"
        oninput="_uComps[${i}].quantity=+this.value">
      <button type="button" class="btn btn-danger btn-sm btn-icon" onclick="removeUComp(${i})">✕</button>
    </div>`).join('');

  window.removeUComp = i => { window._uComps.splice(i, 1); document.getElementById('uCompsList').innerHTML = renderUComps(); };
  window.addUComp    = () => { window._uComps.push({ component: '', quantity: 1, returned: 0 }); document.getElementById('uCompsList').innerHTML = renderUComps(); };

  openModal(u ? 'Edit Usage Entry' : 'Add Usage Entry', `
  ${dl}
  <form onsubmit="saveUsage(event,${u ? u.id : 'null'})">
    <div class="form-row">
      <div class="form-group"><label class="form-label">Date</label>
        <input class="form-control" id="us_date" type="date" value="${u ? u.date : today()}"></div>
      <div class="form-group"><label class="form-label">Instructor / Person</label>
        <input class="form-control" id="us_instructor" value="${u ? escHtml(u.instructor||'') : ''}" placeholder="Full name"></div>
    </div>
    <div class="form-group"><label class="form-label">Remarks</label>
      <input class="form-control" id="us_remarks" value="${u ? escHtml(u.remarks||'') : ''}" placeholder="e.g. Taken for Self Practice"></div>
    <div class="form-group">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <label class="form-label" style="margin:0">Components Taken
          <span style="font-size:11px;color:var(--accent);margin-left:6px;font-weight:400;text-transform:none">✨ Inventory dropdown</span>
        </label>
        <button type="button" class="btn btn-secondary btn-sm" onclick="addUComp()">+ Add Row</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 70px auto;gap:6px;margin-bottom:6px">
        <small style="color:var(--muted)">Component Name</small>
        <small style="color:var(--muted)">Qty</small><span></span>
      </div>
      <div id="uCompsList">${renderUComps()}</div>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="submit" class="btn btn-primary" id="usSaveBtn">${u ? 'Update' : 'Add Entry'}</button>
    </div>
  </form>`);
}

async function saveUsage(e, id) {
  e.preventDefault();
  const btn = document.getElementById('usSaveBtn');
  setLoading(btn, true);
  const body = {
    date:       document.getElementById('us_date').value,
    instructor: document.getElementById('us_instructor').value,
    remarks:    document.getElementById('us_remarks').value,
    components: (window._uComps || []).filter(c => c.component)
  };
  const r = await api(id ? `/api/usage/${id}` : '/api/usage', id ? 'PUT' : 'POST', body);
  setLoading(btn, false, id ? 'Update' : 'Add Entry');
  if (!r) return;
  invalidateInventoryCache();
  closeModal(); toast('Saved!'); pages.usage();
}

async function deleteUsage(id) {
  if (!await confirmDialog('Delete this usage record?')) return;
  const r = await api(`/api/usage/${id}`, 'DELETE');
  if (!r) return;
  invalidateInventoryCache();
  toast('Deleted!'); pages.usage();
}

// ── SOLD TO SCHOOL ─────────────────────────────────────────────────────────────
pages.schools = async () => {
  const data = await api('/api/schools');
  if (!data) return;
  window._schools = data;
  document.getElementById('pageContainer').innerHTML = `
  <div class="section-header">
    <div class="section-title">🏫 Sold to School</div>
    <button class="btn btn-primary" onclick="showSchoolModal(null)">➕ Log Sale</button>
  </div>
  <div class="table-card"><div class="table-wrap">
    <table><thead><tr>
      <th>S.N</th><th>Date</th><th>Contact</th><th>School</th>
      <th>Total Value</th><th>Remarks</th><th>Actions</th>
    </tr></thead>
    <tbody>
      ${data.length ? data.map((s, i) => `<tr>
        <td class="td-muted">${i+1}</td>
        <td class="td-muted">${fmtDate(s.date)}</td>
        <td>${escHtml(s.supplier || '—')}</td>
        <td><strong>${escHtml(s.school_name)}</strong></td>
        <td><span style="color:var(--accent3);font-weight:600">रु${(s.total||0).toLocaleString()}</span></td>
        <td class="td-muted">${escHtml(s.remarks || '—')}</td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="viewSchoolItems(${s.id})">🔍 View Items</button>
          <button class="btn btn-secondary btn-sm" onclick="showSchoolModal(${s.id})">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteSchoolSale(${s.id})">🗑️</button>
        </td>
      </tr>`).join('') : '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🏫</div><p>No school sales logged yet</p></div></td></tr>'}
    </tbody></table>
  </div></div>`;
};

window.viewSchoolItems = (id) => {
  const s = (window._schools || []).find(x => x.id === id);
  if (!s) return;
  openModal(`Items Sold to ${escHtml(s.school_name)}`, `
    <div style="margin-bottom:16px;color:var(--muted)">Sale Date: ${fmtDate(s.date)}</div>
    <div style="display:grid;grid-template-columns:3fr 1fr 2fr;gap:10px;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--border)">
      <strong style="color:var(--muted)">Component</strong>
      <strong style="color:var(--muted)">Qty</strong>
      <strong style="color:var(--muted)">Unit Price</strong>
    </div>
    ${s.items.length ? s.items.map(i => `
      <div style="display:grid;grid-template-columns:3fr 1fr 2fr;gap:10px;margin-bottom:8px">
        <span>${escHtml(i.component)}</span>
        <span class="badge badge-gray">×${i.quantity}</span>
        <span style="color:var(--accent3)">रु${i.price}</span>
      </div>`).join('') : '<div class="td-muted">No items</div>'}
    <div style="text-align:right;margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
      <strong>Total: <span style="color:var(--accent3)">रु${s.total}</span></strong>
    </div>
    <div class="modal-footer" style="margin-top:20px">
      <button type="button" class="btn btn-secondary" onclick="closeModal()">Close</button>
    </div>`);
};

let _cachedPrices = null;

async function showSchoolModal(id) {
  const s = id ? (window._schools || []).find(x => x.id === id) : null;
  await getInventoryComponents(true);
  const dl = buildDatalist('schoolCompList');
  if (!_cachedPrices) _cachedPrices = await api('/api/pricing');

  let sItems = s ? s.items.map(i => ({...i})) : [];
  window._schoolItems = sItems;

  window._schoolAutoFill = (index, name) => {
    window._schoolItems[index].component = name;
    const match = (_cachedPrices || []).find(p => p.material.toLowerCase() === name.toLowerCase());
    if (match && window._schoolItems[index].price === 0) {
      window._schoolItems[index].price = match.retail_cost;
      const el = document.getElementById(`school_price_${index}`);
      if (el) el.value = match.retail_cost;
    }
  };

  const renderSItems = () => window._schoolItems.map((c, i) => `
    <div class="material-row" style="grid-template-columns:2fr 60px 80px auto">
      <input class="form-control" placeholder="Type component name..." list="schoolCompList"
        value="${escHtml(c.component)}" autocomplete="off"
        oninput="_schoolAutoFill(${i}, this.value)">
      <input class="form-control" type="number" min="1" value="${c.quantity}" placeholder="Qty"
        oninput="_schoolItems[${i}].quantity=+this.value">
      <input class="form-control" id="school_price_${i}" type="number" min="0" value="${c.price}" placeholder="Price"
        oninput="_schoolItems[${i}].price=+this.value">
      <button type="button" class="btn btn-danger btn-sm btn-icon" onclick="removeSchoolItem(${i})">✕</button>
    </div>`).join('');

  window.removeSchoolItem  = i => { window._schoolItems.splice(i, 1); document.getElementById('scompsList').innerHTML = renderSItems(); };
  window.addSchoolItem     = () => { window._schoolItems.push({ component: '', quantity: 1, price: 0 }); document.getElementById('scompsList').innerHTML = renderSItems(); };

  openModal(s ? 'Edit Sale' : 'Log Sale to School', `
  ${dl}
  <form onsubmit="saveSchoolSale(event,${s ? s.id : 'null'})">
    <div class="form-row">
      <div class="form-group"><label class="form-label">Date *</label>
        <input class="form-control" id="ss_date" type="date" value="${s ? s.date : today()}" required></div>
      <div class="form-group"><label class="form-label">Consumer School *</label>
        <input class="form-control" id="ss_school" value="${s ? escHtml(s.school_name||'') : ''}" placeholder="School name" required></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Contact Person</label>
        <input class="form-control" id="ss_supplier" value="${s ? escHtml(s.supplier||'') : ''}" placeholder="Contact name (optional)"></div>
      <div class="form-group"><label class="form-label">Remarks</label>
        <input class="form-control" id="ss_remarks" value="${s ? escHtml(s.remarks||'') : ''}" placeholder="Optional note"></div>
    </div>
    <div class="form-group">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <label class="form-label" style="margin:0">Items Sold
          <span style="font-size:11px;color:var(--accent);margin-left:6px;font-weight:400;text-transform:none">✨ Auto-fills from Retail Pricing</span>
        </label>
        <button type="button" class="btn btn-secondary btn-sm" onclick="addSchoolItem()">+ Add Row</button>
      </div>
      <div style="display:grid;grid-template-columns:2fr 60px 80px auto;gap:6px;margin-bottom:4px">
        <small style="color:var(--muted)">Component</small>
        <small style="color:var(--muted)">Qty</small>
        <small style="color:var(--muted)">Unit Price</small><span></span>
      </div>
      <div id="scompsList">${renderSItems()}</div>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button type="submit" class="btn btn-primary" id="ssSaveBtn">${s ? 'Update' : 'Log Sale'}</button>
    </div>
  </form>`);
}

async function saveSchoolSale(e, id) {
  e.preventDefault();
  const btn = document.getElementById('ssSaveBtn');
  setLoading(btn, true);
  const body = {
    date:        document.getElementById('ss_date').value,
    school_name: document.getElementById('ss_school').value,
    supplier:    document.getElementById('ss_supplier').value,
    remarks:     document.getElementById('ss_remarks').value,
    items:       (window._schoolItems || []).filter(c => c.component)
  };
  const r = await api(id ? `/api/schools/${id}` : '/api/schools', id ? 'PUT' : 'POST', body);
  setLoading(btn, false, id ? 'Update' : 'Log Sale');
  if (!r) return;
  invalidateInventoryCache();
  closeModal(); toast('Sale logged successfully!'); pages.schools();
}

async function deleteSchoolSale(id) {
  if (!await confirmDialog('Delete this sale? Sold items will be returned to inventory.')) return;
  const r = await api(`/api/schools/${id}`, 'DELETE');
  if (!r) return;
  invalidateInventoryCache();
  toast('Sale deleted!'); pages.schools();
}

// SETTINGS
pages.settings = () => {
  document.getElementById('pageContainer').innerHTML = `
  <div class="section-title" style="margin-bottom:24px">⚙️ Settings</div>
  <div class="chart-card" style="max-width:480px">
    <div class="chart-title">🔒 Change Password</div>
    <form onsubmit="changePassword(event)">
      <div class="form-group"><label class="form-label">Current Password</label>
        <input class="form-control" id="cp_old" type="password" required placeholder="Current password"></div>
      <div class="form-group"><label class="form-label">New Password</label>
        <input class="form-control" id="cp_new" type="password" required placeholder="New password"></div>
      <div class="form-group"><label class="form-label">Confirm New Password</label>
        <input class="form-control" id="cp_confirm" type="password" required placeholder="Confirm new password"></div>
      <button type="submit" class="btn btn-primary" id="cpSaveBtn">🔒 Update Password</button>
    </form>
  </div>
  <div class="chart-card" style="max-width:480px;margin-top:20px">
    <div class="chart-title">🗄️ Database Backup</div>
    <p style="font-size:13px;color:var(--muted2);margin-bottom:14px">Download a full backup of the inventory database.</p>
    <button class="btn btn-secondary" onclick="window.location='/api/admin/backup'">⬇️ Download Backup (.db)</button>
  </div>
  <div class="chart-card" style="max-width:480px;margin-top:20px">
    <div class="chart-title">ℹ️ System Info</div>
    <div style="color:var(--muted2);font-size:14px;line-height:2">
      <div>🤖 <strong>App:</strong> RoboInventory</div>
      <div>👨‍💻 <strong>Developer:</strong> Abashesh Ranabhat</div>
      <div>🗄️ <strong>Database:</strong> SQLite (inventory.db)</div>
      <div>🐍 <strong>Backend:</strong> Python Flask</div>
      <div>📅 <strong>Version:</strong> 2.0.0</div>
    </div>
  </div>`;
};

async function changePassword(e) {
  e.preventDefault();
  const btn = document.getElementById('cpSaveBtn');
  setLoading(btn, true);
  const np = document.getElementById('cp_new').value;
  const cp = document.getElementById('cp_confirm').value;
  if (np !== cp) { setLoading(btn, false, '🔒 Update Password'); toast('Passwords do not match!', true); return; }
  const r = await api('/api/change-password', 'POST', {
    old_password: document.getElementById('cp_old').value,
    new_password: np
  });
  setLoading(btn, false, '🔒 Update Password');
  if (!r) return;
  if (r.success) {
    toast('Password updated!');
    document.getElementById('cp_old').value = '';
    document.getElementById('cp_new').value = '';
    document.getElementById('cp_confirm').value = '';
  } else {
    toast(r.error || 'Failed to update password', true);
  }
}
