/*!
 * RoboInventory v2.0 — requests.js
 * Built by Abashesh Ranabhat
 * GitHub: https://github.com/Alpha107
 * © 2026 Abashesh Ranabhat. All rights reserved.
 */

// ── Admin: Component Requests ──────────────────────────────────────────────────
const APPROVERS = ['Abashesh Ranabhat', 'Surya Bhandari'];

pages.adminRequests = async () => {
  const data = await api('/api/requests');
  if (!data) return;
  window._adminReqs = data;

  const statusBadge = {
    pending:  '<span class="badge badge-yellow">⏳ Pending</span>',
    approved: '<span class="badge badge-green">✅ Approved</span>',
    rejected: '<span class="badge badge-red">❌ Rejected</span>',
  };

  const pc = document.getElementById('pageContainer');
  pc.innerHTML = `
  <div class="section-header">
    <div class="section-title">📬 Component Requests</div>
    <div class="section-actions">
      <div class="search-bar"><span>🔍</span>
        <input id="reqSearch" placeholder="Search…" oninput="filterTable('reqSearch','reqBody')">
      </div>
    </div>
  </div>
  <div class="table-card"><div class="table-wrap">
    <table class="data-table">
      <thead><tr>
        <th>#</th><th>Requested By</th><th>Components</th><th>Purpose</th>
        <th>For Approval By</th><th>Submitted</th><th>Status</th><th>Actions</th>
      </tr></thead>
      <tbody id="reqBody">
        ${data.length ? data.map((r, i) => {
          const items = parseItems(r.items);
          const summary = items.map(it => `${escHtml(it.name)} ×${it.qty}`).join(', ');
          return `<tr>
            <td class="td-muted">${i+1}</td>
            <td><strong>${escHtml(r.requester_name)}</strong><br><span class="td-muted">${escHtml(r.requester_username)}</span></td>
            <td style="max-width:200px;font-size:12px">${summary}</td>
            <td>${escHtml(r.purpose)}</td>
            <td>${escHtml(r.designated_approver)}</td>
            <td class="td-muted">${fmtDate(r.created_at)}</td>
            <td>${statusBadge[r.status] || r.status}</td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="viewRequest(${r.id})">👁️</button>
              ${r.status === 'pending' ? `
                <button class="btn btn-primary btn-sm" onclick="approveRequest(${r.id})">✅</button>
                <button class="btn btn-danger btn-sm"  onclick="rejectRequest(${r.id})">❌</button>` : ''}
              <button class="btn btn-danger btn-sm" onclick="deleteRequest(${r.id})">🗑️</button>
            </td>
          </tr>`;
        }).join('') : '<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">📬</div><p>No requests yet</p></div></td></tr>'}
      </tbody>
    </table>
  </div></div>`;
};

function parseItems(raw) {
  try { return JSON.parse(raw) || []; } catch { return []; }
}

function viewRequest(id) {
  const r = (window._adminReqs || []).find(x => x.id === id) ||
            (window._myReqs    || []).find(x => x.id === id);
  if (!r) return;
  const items = parseItems(r.items);
  const statusColor = { pending:'badge-yellow', approved:'badge-green', rejected:'badge-red' };
  openModal('Request Details', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;font-size:13px">
      <div><span style="color:var(--muted)">Requested by</span><br><strong>${escHtml(r.requester_name)}</strong></div>
      <div><span style="color:var(--muted)">Status</span><br><span class="badge ${statusColor[r.status]||''}">${r.status}</span></div>
      <div><span style="color:var(--muted)">Purpose</span><br>${escHtml(r.purpose)}</div>
      <div><span style="color:var(--muted)">Designated Approver</span><br>${escHtml(r.designated_approver)}</div>
      ${r.remarks ? `<div style="grid-column:span 2"><span style="color:var(--muted)">Remarks</span><br>${escHtml(r.remarks)}</div>` : ''}
      ${r.processed_by ? `<div><span style="color:var(--muted)">Processed by</span><br>${escHtml(r.processed_by)}</div>` : ''}
      ${r.admin_note   ? `<div><span style="color:var(--muted)">Admin note</span><br><span style="color:var(--danger)">${escHtml(r.admin_note)}</span></div>` : ''}
    </div>
    <div style="font-weight:600;margin-bottom:8px;font-size:13px">Requested Components</div>
    <div class="table-card" style="padding:0;margin-bottom:20px">
      <table class="data-table" style="font-size:13px">
        <thead><tr><th>#</th><th>Component</th><th>Qty</th></tr></thead>
        <tbody>${items.map((it,i)=>`<tr><td class="td-muted">${i+1}</td><td>${escHtml(it.name)}</td><td><span class="badge badge-gray">${it.qty}</span></td></tr>`).join('')}</tbody>
      </table>
    </div>
    <div class="modal-footer" style="margin-top:0">
      ${r.status==='pending' ? `
        <button class="btn btn-primary" onclick="closeModal();approveRequest(${r.id})">✅ Approve</button>
        <button class="btn btn-danger"  onclick="closeModal();rejectRequest(${r.id})">❌ Reject</button>` : ''}
      <button class="btn btn-secondary" onclick="closeModal()">Close</button>
    </div>`, true);
}

async function approveRequest(id) {
  if (!await confirmDialog('Approve this request? Components will be moved to "Taken for Use" in inventory.', 'Approve')) return;
  const r = await api(`/api/requests/${id}`, 'PUT', { action: 'approve' });
  if (!r) return;
  toast('Request approved — inventory updated');
  pages.adminRequests();
  updateSidebarBadges();
}

async function rejectRequest(id) {
  openModal('Reject Request', `
    <p style="font-size:14px;color:var(--muted2);margin-bottom:16px">Provide a reason for rejection (optional but recommended).</p>
    <div class="form-group">
      <label class="form-label">Rejection Note</label>
      <textarea class="form-control" id="rejectNote" rows="3" placeholder="Reason for rejection…"></textarea>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" id="rejectBtn" onclick="submitReject(${id})">❌ Reject</button>
    </div>`);
}

async function submitReject(id) {
  const note = (document.getElementById('rejectNote')?.value || '').trim();
  const btn  = document.getElementById('rejectBtn');
  setLoading(btn, true, 'Reject');
  const r = await api(`/api/requests/${id}`, 'PUT', { action: 'reject', admin_note: note });
  setLoading(btn, false, 'Reject');
  if (!r) return;
  closeModal();
  toast('Request rejected');
  pages.adminRequests();
  updateSidebarBadges();
}

async function deleteRequest(id) {
  if (!await confirmDialog('Delete this request record?')) return;
  const r = await api(`/api/requests/${id}`, 'DELETE');
  if (!r) return;
  toast('Request deleted');
  pages.adminRequests();
}

// ── User: My Requests ──────────────────────────────────────────────────────────
pages.myRequests = async () => {
  const data = await api('/api/requests');
  if (!data) return;
  window._myReqs = data;

  const statusBadge = {
    pending:  '<span class="badge badge-yellow">⏳ Pending</span>',
    approved: '<span class="badge badge-green">✅ Approved</span>',
    rejected: '<span class="badge badge-red">❌ Rejected</span>',
  };

  document.getElementById('pageContainer').innerHTML = `
  <div class="section-header">
    <div class="section-title">📋 My Requests</div>
    <div class="section-actions">
      <button class="btn btn-primary" onclick="navigate('newRequest',document.querySelector('[data-page=newRequest]'))">➕ New Request</button>
    </div>
  </div>
  <div class="table-card"><div class="table-wrap">
    <table class="data-table">
      <thead><tr>
        <th>#</th><th>Components</th><th>Purpose</th><th>For Approval By</th>
        <th>Date</th><th>Status</th><th>Note</th><th></th>
      </tr></thead>
      <tbody>
        ${data.length ? data.map((r, i) => {
          const items = parseItems(r.items);
          const summary = items.map(it => `${escHtml(it.name)} ×${it.qty}`).join(', ');
          return `<tr>
            <td class="td-muted">${i+1}</td>
            <td style="font-size:12px;max-width:180px">${summary}</td>
            <td>${escHtml(r.purpose)}</td>
            <td>${escHtml(r.designated_approver)}</td>
            <td class="td-muted">${fmtDate(r.created_at)}</td>
            <td>${statusBadge[r.status] || r.status}</td>
            <td style="color:var(--danger);font-size:12px">${escHtml(r.admin_note||'')}</td>
            <td><button class="btn btn-secondary btn-sm" onclick="viewRequest(${r.id})">👁️</button></td>
          </tr>`;
        }).join('') : '<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">📬</div><p>No requests yet — submit one!</p></div></td></tr>'}
      </tbody>
    </table>
  </div></div>`;
};

// ── User: New Request form ─────────────────────────────────────────────────────
let _reqSeq = 0;

pages.newRequest = async () => {
  const comps = await api('/api/components');
  window._reqComps = comps || [];
  _reqSeq = 0;
  const datalist = `<datalist id="reqCompList">${(comps||[]).map(c=>`<option value="${escHtml(c.name)}">`).join('')}</datalist>`;

  document.getElementById('pageContainer').innerHTML = `
  <div class="section-title" style="margin-bottom:20px">➕ New Component Request</div>
  ${datalist}
  <form onsubmit="submitRequest(event)">
    <div class="table-card" style="padding:24px;margin-bottom:16px">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Your Name</label>
          <input class="form-control" value="${escHtml(window._fullName||'')}" disabled>
        </div>
        <div class="form-group">
          <label class="form-label">Designated Approver <span style="color:var(--danger)">*</span></label>
          <select class="form-control" id="req_approver">
            ${APPROVERS.map(a=>`<option value="${escHtml(a)}">${escHtml(a)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Purpose / Project <span style="color:var(--danger)">*</span></label>
        <input class="form-control" id="req_purpose" required placeholder="e.g. RC Car project prototype">
      </div>
      <div class="form-group">
        <label class="form-label">Remarks</label>
        <textarea class="form-control" id="req_remarks" rows="2" placeholder="Any additional notes…"></textarea>
      </div>
    </div>

    <div class="section-title" style="margin-bottom:12px;font-size:15px">Components Needed</div>
    <div id="reqItemsContainer"></div>
    <button type="button" class="btn btn-secondary" style="margin-bottom:20px" onclick="addReqItem()">➕ Add Component</button>

    <div class="modal-footer" style="margin-top:0;padding:0">
      <button type="submit" class="btn btn-primary" id="reqSubmitBtn">📬 Submit Request</button>
    </div>
  </form>`;

  addReqItem();
};

function addReqItem() {
  const idx = ++_reqSeq;
  const div = document.createElement('div');
  div.id = `reqItem_${idx}`;
  div.className = 'table-card';
  div.style.cssText = 'padding:16px;margin-bottom:12px;display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:end';
  div.innerHTML = `
    <div class="form-group" style="margin:0">
      <label class="form-label">Component Name <span style="color:var(--danger)">*</span></label>
      <input class="form-control" id="req_name_${idx}" list="reqCompList" required placeholder="Type or select…">
    </div>
    <div class="form-group" style="margin:0;min-width:90px">
      <label class="form-label">Quantity</label>
      <input class="form-control" id="req_qty_${idx}" type="number" min="1" value="1" required>
    </div>
    ${_reqSeq > 1 ? `<button type="button" class="btn btn-danger btn-sm" style="align-self:flex-end;margin-bottom:1px" onclick="document.getElementById('reqItem_${idx}').remove()">✕</button>` : '<div></div>'}`;
  document.getElementById('reqItemsContainer').appendChild(div);
}

async function submitRequest(e) {
  e.preventDefault();
  const btn = document.getElementById('reqSubmitBtn');
  setLoading(btn, true, '📬 Submit Request');

  const items = [];
  document.querySelectorAll('[id^="req_name_"]').forEach(el => {
    const idx = el.id.split('_').pop();
    const name = el.value.trim();
    const qty  = parseInt(document.getElementById(`req_qty_${idx}`)?.value) || 1;
    if (name) items.push({ name, qty });
  });

  if (!items.length) {
    toast('Add at least one component', true);
    setLoading(btn, false, '📬 Submit Request');
    return;
  }

  const body = {
    items,
    purpose:             document.getElementById('req_purpose').value.trim(),
    remarks:             document.getElementById('req_remarks').value.trim(),
    designated_approver: document.getElementById('req_approver').value,
  };

  const r = await api('/api/requests', 'POST', body);
  setLoading(btn, false, '📬 Submit Request');
  if (!r) return;
  toast('Request submitted! Awaiting admin approval.');
  navigate('myRequests', document.querySelector('[data-page="myRequests"]'));
}

// ── Admin: User Management ─────────────────────────────────────────────────────
pages.users = async () => {
  const data = await api('/api/users');
  if (!data) return;
  window._users = data;

  const roleColor = { admin: 'badge-red', user: 'badge-green' };

  document.getElementById('pageContainer').innerHTML = `
  <div class="section-header">
    <div class="section-title">👥 User Management</div>
    <div class="section-actions">
      <button class="btn btn-primary" onclick="showUserModal(null)">➕ Add User</button>
    </div>
  </div>
  <div class="table-card"><div class="table-wrap">
    <table class="data-table">
      <thead><tr>
        <th>#</th><th>Full Name</th><th>Username</th><th>Role</th><th>Created</th><th>Actions</th>
      </tr></thead>
      <tbody>
        ${data.map((u, i) => `<tr>
          <td class="td-muted">${i+1}</td>
          <td><strong>${escHtml(u.full_name||u.username)}</strong></td>
          <td class="td-muted">${escHtml(u.username)}</td>
          <td><span class="badge ${roleColor[u.role]||'badge-gray'}">${u.role}</span></td>
          <td class="td-muted">${fmtDate(u.created_at)}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="showUserModal(${u.id})">✏️</button>
            <button class="btn btn-danger btn-sm"    onclick="deleteUser(${u.id})">🗑️</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div></div>`;
};

function showUserModal(id) {
  const u = id ? (window._users||[]).find(x => x.id === id) : null;
  openModal(u ? 'Edit User' : 'Add User', `
    <form onsubmit="saveUser(event,${id||'null'})">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Full Name</label>
          <input class="form-control" id="uf_name" value="${escHtml(u?.full_name||'')}" placeholder="Full name">
        </div>
        <div class="form-group">
          <label class="form-label">Username <span style="color:var(--danger)">*</span></label>
          <input class="form-control" id="uf_user" value="${escHtml(u?.username||'')}" required placeholder="username" ${u?'disabled':''}>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">${u ? 'New Password' : 'Password'} ${u ? '' : '<span style="color:var(--danger)">*</span>'}</label>
          <input class="form-control" id="uf_pass" type="password" ${u?'':'required'} placeholder="${u?'Leave blank to keep current':'Set password'}">
        </div>
        <div class="form-group">
          <label class="form-label">Role</label>
          <select class="form-control" id="uf_role">
            <option value="user"  ${(!u||u.role==='user') ?'selected':''}>User</option>
            <option value="admin" ${(u?.role==='admin')   ?'selected':''}>Admin</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary" id="ufSaveBtn">Save</button>
      </div>
    </form>`);
}

async function saveUser(e, id) {
  e.preventDefault();
  const btn  = document.getElementById('ufSaveBtn');
  setLoading(btn, true);
  const body = {
    username:     document.getElementById('uf_user').value.trim(),
    full_name:    document.getElementById('uf_name').value.trim(),
    role:         document.getElementById('uf_role').value,
    new_password: document.getElementById('uf_pass').value,
  };
  if (!id) body.password = body.new_password;
  const url = id ? `/api/users/${id}` : '/api/users';
  const method = id ? 'PUT' : 'POST';
  const r = await api(url, method, body);
  setLoading(btn, false);
  if (!r) return;
  closeModal();
  toast(id ? 'User updated' : 'User created');
  pages.users();
}

async function deleteUser(id) {
  if (!await confirmDialog('Delete this user? They will no longer be able to log in.')) return;
  const r = await api(`/api/users/${id}`, 'DELETE');
  if (!r) return;
  toast('User deleted');
  pages.users();
}

// ── Admin: Activity Log ────────────────────────────────────────────────────────
pages.activityLog = async () => {
  const data = await api('/api/logs');
  if (!data) return;

  const actionIcon = {
    login:              '🔑',
    request_submitted:  '📬',
    request_approved:   '✅',
    request_rejected:   '❌',
    request_deleted:    '🗑️',
    user_created:       '👤',
    user_updated:       '✏️',
    user_deleted:       '🗑️',
  };

  document.getElementById('pageContainer').innerHTML = `
  <div class="section-header">
    <div class="section-title">📜 Activity Log</div>
    <div class="section-actions">
      <div class="search-bar"><span>🔍</span>
        <input id="logSearch" placeholder="Search actor / action / details…" oninput="filterTable('logSearch','logBody')">
      </div>
    </div>
  </div>
  <div style="font-size:13px;color:var(--muted2);margin-bottom:16px">Last ${data.logs.length} events</div>
  <div class="table-card"><div class="table-wrap">
    <table class="data-table">
      <thead><tr>
        <th>#</th><th>Time</th><th>Actor</th><th>Action</th><th>Details</th><th>IP</th>
      </tr></thead>
      <tbody id="logBody">
        ${data.logs.length ? data.logs.map((l, i) => `<tr>
          <td class="td-muted">${i+1}</td>
          <td class="td-muted" style="white-space:nowrap">${escHtml(l.created_at?.slice(0,16).replace('T',' '))}</td>
          <td><strong>${escHtml(l.actor)}</strong></td>
          <td>${actionIcon[l.action]||'•'} <span style="font-size:12px">${escHtml(l.action)}</span></td>
          <td style="font-size:12px;color:var(--muted2)">${escHtml(l.details)}</td>
          <td class="td-muted" style="font-size:11px">${escHtml(l.ip_address)}</td>
        </tr>`).join('') : '<tr><td colspan="6"><div class="empty-state"><p>No activity yet</p></div></td></tr>'}
      </tbody>
    </table>
  </div></div>`;
};
