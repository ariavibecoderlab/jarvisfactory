// JarvisFactory — Proven Working Code Templates
// These are battle-tested JS/CSS blocks JARVIS always injects into every build
// instead of reinventing from scratch each time

export const WORKING_LOGIN = `
const DEMO_USERS = [
  { email: 'demo@example.com', password: 'demo123', role: 'Admin', name: 'Demo User' },
  { email: 'admin@example.com', password: 'admin123', role: 'Admin', name: 'Administrator' },
  { email: 'user@example.com', password: 'user123', role: 'User', name: 'Standard User' },
  { email: 'manager@example.com', password: 'manager123', role: 'Manager', name: 'Manager' }
];
let currentUser = null;
function doLogin(email, password) {
  const found = DEMO_USERS.find(u => u.email.toLowerCase().trim() === email.toLowerCase().trim() && u.password === password.trim());
  if (found) { currentUser = found; localStorage.setItem('jf_user', JSON.stringify(found)); return true; }
  return false;
}
function checkSession() {
  const saved = localStorage.getItem('jf_user');
  if (saved) { try { currentUser = JSON.parse(saved); return true; } catch(e) {} }
  return false;
}
function doLogout() {
  currentUser = null;
  localStorage.removeItem('jf_user');
  document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
  const ls = document.getElementById('loginScreen');
  if(ls) ls.style.display = 'flex';
}
function handleLoginSubmit(e) {
  if(e) e.preventDefault();
  const emailEl = document.getElementById('loginEmail');
  const passEl = document.getElementById('loginPassword');
  const errEl = document.getElementById('loginError');
  if(!emailEl || !passEl) return;
  if (!emailEl.value || !passEl.value) {
    if(errEl) errEl.textContent = 'Please enter email and password.';
    return;
  }
  if (doLogin(emailEl.value, passEl.value)) {
    if(errEl) errEl.textContent = '';
    showMainApp();
  } else {
    if(errEl) errEl.textContent = 'Invalid. Try: demo@example.com / demo123';
    passEl.value = ''; passEl.focus();
  }
}
`

export const WORKING_NAVIGATION = `
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
  const target = document.getElementById(screenId);
  if(target) { target.style.display = 'block'; target.classList.add('animate-in'); }
  document.querySelectorAll('[data-screen]').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector('[data-screen="' + screenId + '"]');
  if(navItem) navItem.classList.add('active');
}
function showTab(tabId) {
  const btn = document.querySelector('[data-tab="' + tabId + '"]');
  const group = btn ? (btn.dataset.tabgroup || 'tab-pane') : 'tab-pane';
  document.querySelectorAll('.' + group).forEach(t => t.style.display = 'none');
  const target = document.getElementById(tabId);
  if(target) { target.style.display = 'block'; target.classList.add('animate-in'); }
  document.querySelectorAll('[data-tab]').forEach(t => t.classList.remove('active'));
  if(btn) btn.classList.add('active');
}
`

export const WORKING_CRUD = `
const DB = {
  get(key) { try { return JSON.parse(localStorage.getItem('jf_' + key) || '[]'); } catch(e) { return []; } },
  set(key, data) { localStorage.setItem('jf_' + key, JSON.stringify(data)); },
  add(key, item) {
    const items = this.get(key);
    item.id = item.id || Date.now().toString() + Math.random().toString(36).substr(2,5);
    item.createdAt = item.createdAt || new Date().toISOString();
    items.unshift(item);
    this.set(key, items);
    return item;
  },
  update(key, id, updates) {
    const items = this.get(key);
    const idx = items.findIndex(i => String(i.id) === String(id));
    if(idx > -1) { items[idx] = {...items[idx], ...updates, updatedAt: new Date().toISOString()}; this.set(key, items); return items[idx]; }
    return null;
  },
  delete(key, id) { this.set(key, this.get(key).filter(i => String(i.id) !== String(id))); },
  search(key, query) {
    if(!query) return this.get(key);
    const q = query.toLowerCase();
    return this.get(key).filter(i => Object.values(i).some(v => String(v).toLowerCase().includes(q)));
  },
  count(key) { return this.get(key).length; }
};
`

export const WORKING_MODAL = `
function openModal(modalId) {
  const m = document.getElementById(modalId);
  if(m) { m.style.display = 'flex'; setTimeout(() => m.classList.add('open'), 10); }
}
function closeModal(modalId) {
  const m = document.getElementById(modalId);
  if(m) { m.classList.remove('open'); setTimeout(() => m.style.display = 'none', 200); }
}
document.addEventListener('click', function(e) {
  if(e.target.classList.contains('modal-overlay')) closeModal(e.target.id);
  if(e.target.classList.contains('modal-close')) {
    const modal = e.target.closest('.modal-overlay');
    if(modal) closeModal(modal.id);
  }
});
`

export const WORKING_TOAST = `
function showToast(message, type) {
  type = type || 'success';
  const old = document.getElementById('jf-toast');
  if(old) old.remove();
  const colors = { success:'#00e5b0', error:'#ff4d6d', warning:'#ffd166', info:'#8b7cf8' };
  const t = document.createElement('div');
  t.id = 'jf-toast';
  t.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;background:#1a1a2e;border:1px solid ' + (colors[type]||colors.success) + ';color:#f0f0fa;padding:12px 20px;border-radius:10px;font-family:DM Sans,sans-serif;font-size:14px;display:flex;align-items:center;gap:10px;max-width:320px;animation:slideIn 0.3s ease;box-shadow:0 4px 20px rgba(0,0,0,0.4)';
  const dot = document.createElement('span');
  dot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:' + (colors[type]||colors.success) + ';flex-shrink:0';
  t.appendChild(dot);
  t.appendChild(document.createTextNode(message));
  document.body.appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity 0.3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
}
`

export const BASE_STYLES = `
*, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
html, body { height:100%; font-family:'DM Sans',sans-serif; background:var(--bg,#05050d); color:var(--text,#f0f0fa); }
.screen { display:none; min-height:100vh; }
.tab-pane { display:none; }
.modal-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:1000; align-items:center; justify-content:center; backdrop-filter:blur(4px); }
.modal-overlay.open { display:flex !important; }
.modal-box { background:var(--surface,#0f0f1a); border:1px solid var(--border,#1a1a35); border-radius:14px; padding:28px; width:90%; max-width:480px; position:relative; animation:fadeIn 0.2s ease; }
.modal-close { position:absolute; top:14px; right:14px; background:none; border:none; color:#8888aa; font-size:20px; cursor:pointer; line-height:1; padding:0; }
.modal-close:hover { color:#f0f0fa; }
.btn { padding:10px 20px; border-radius:8px; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.2s; border:none; display:inline-flex; align-items:center; gap:6px; }
.btn-primary { background:var(--accent,#00e5b0); color:#000; }
.btn-primary:hover { opacity:0.9; transform:translateY(-1px); }
.btn-secondary { background:transparent; border:1px solid var(--border,#1a1a35); color:var(--muted,#8888aa); }
.btn-secondary:hover { border-color:var(--accent,#00e5b0); color:var(--accent,#00e5b0); }
.btn-danger { background:rgba(255,77,109,0.15); color:#ff4d6d; border:1px solid rgba(255,77,109,0.3); }
.btn-danger:hover { background:rgba(255,77,109,0.25); }
.btn-sm { padding:6px 14px; font-size:12px; }
.badge { display:inline-block; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:600; }
.badge-green { background:rgba(0,229,176,0.15); color:#00e5b0; }
.badge-red { background:rgba(255,77,109,0.15); color:#ff4d6d; }
.badge-yellow { background:rgba(255,209,102,0.15); color:#ffd166; }
.badge-purple { background:rgba(139,124,248,0.15); color:#8b7cf8; }
.badge-gray { background:rgba(136,136,170,0.15); color:#8888aa; }
.field-error { color:#ff4d6d; font-size:11px; margin-top:4px; display:block; }
input, select, textarea { font-family:'DM Sans',sans-serif; }
input:focus, select:focus, textarea:focus { outline:none; }
.active { color:var(--accent,#00e5b0) !important; }
[data-screen].active, [data-tab].active { color:var(--accent,#00e5b0); border-color:var(--accent,#00e5b0) !important; }
@keyframes slideIn { from{transform:translateX(20px);opacity:0} to{transform:translateX(0);opacity:1} }
@keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
.animate-in { animation:fadeIn 0.25s ease both; }
::-webkit-scrollbar { width:4px; height:4px; }
::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08); border-radius:2px; }
table { width:100%; border-collapse:collapse; }
th { text-align:left; padding:10px 14px; font-size:11px; font-family:'Space Mono',monospace; text-transform:uppercase; letter-spacing:1px; color:#5a5a78; border-bottom:1px solid var(--border,#1a1a35); }
td { padding:12px 14px; font-size:13px; border-bottom:1px solid rgba(255,255,255,0.04); vertical-align:middle; }
tr:hover td { background:rgba(255,255,255,0.02); }
.card { background:var(--surface,#0f0f1a); border:1px solid var(--border,#1a1a35); border-radius:12px; padding:20px; }
.stat-card { background:var(--surface,#0f0f1a); border:1px solid var(--border,#1a1a35); border-radius:12px; padding:20px; }
.stat-label { font-size:11px; font-family:'Space Mono',monospace; color:#5a5a78; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px; }
.stat-value { font-size:28px; font-weight:700; color:var(--text,#f0f0fa); }
.form-group { margin-bottom:16px; }
.form-label { display:block; font-size:12px; font-family:'Space Mono',monospace; color:#8888aa; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px; }
.form-input { width:100%; padding:10px 14px; background:var(--surface2,#161625); border:1px solid var(--border,#1a1a35); border-radius:8px; color:var(--text,#f0f0fa); font-size:13px; transition:border 0.2s; }
.form-input:focus { border-color:var(--accent,#00e5b0); }
`

export const MASTER_BUILD_SYSTEM = (jarvisName: string, industry: string, brandName: string, brandColour: string): string => {
  const accentColour = brandColour || '#00e5b0'
  const appBrandName = brandName || 'App'

  return `You are ${jarvisName||'JARVIS'}, an expert full-stack developer. Build a complete, fully-working single-file HTML app.

══════════════════════════════════════════════
MANDATORY: INJECT THESE EXACT CODE BLOCKS VERBATIM
══════════════════════════════════════════════

Copy these blocks EXACTLY into your <script> tag. Do NOT rewrite them.

BLOCK 1 — LOGIN (copy exactly):
${WORKING_LOGIN}

BLOCK 2 — NAVIGATION (copy exactly):
${WORKING_NAVIGATION}

BLOCK 3 — DATA STORAGE (copy exactly):
${WORKING_CRUD}

BLOCK 4 — MODALS (copy exactly):
${WORKING_MODAL}

BLOCK 5 — TOAST NOTIFICATIONS (copy exactly):
${WORKING_TOAST}

BLOCK 6 — BASE CSS (copy exactly into <style>):
${BASE_STYLES}

══════════════════════════════════════════════
STRUCTURE RULES
══════════════════════════════════════════════

Return ONLY raw HTML. No markdown, no backticks, no explanation.

HTML STRUCTURE:
1. <head> with Google Fonts (DM Sans + Space Mono) + meta viewport
2. <style> — BASE_STYLES from above + app-specific styles
   - CSS variables: --bg:#05050d; --surface:#0f0f1a; --surface2:#161625; --border:#1a1a35; --accent:${accentColour}; --text:#f0f0fa; --muted:#8888aa
3. <body>:
   a. Login screen: <div id="loginScreen" style="display:flex;..."> with inputs id="loginEmail", id="loginPassword", error div id="loginError"
   b. Main app div (id="mainApp", style="display:none") containing all screens as <div class="screen" id="screenName">
4. <script>:
   a. All 5 JS blocks VERBATIM (login, navigation, crud, modal, toast)
   b. function showMainApp() { document.getElementById('loginScreen').style.display='none'; document.getElementById('mainApp').style.display='block'; showScreen('dashboardScreen'); renderAll(); }
   c. function renderAll() — populate all screens with DB data
   d. Pre-populate data: 5-8 realistic items per DB collection using DB.add()
   e. window.onload = function() { if(checkSession()) showMainApp(); else document.getElementById('loginScreen').style.display='flex'; populateData(); }
   f. populateData() — only adds data if DB is empty (check DB.count first)
   g. App-specific logic for all features

LOGIN SCREEN REQUIREMENTS:
- Beautiful centered card design
- Show: "Demo Login: demo@example.com / demo123" prominently in a yellow info box
- Login button calls handleLoginSubmit()
- Input fields: id="loginEmail" type="email", id="loginPassword" type="password"
- Error message: <span id="loginError" style="color:#ff4d6d;font-size:12px"></span>
- Bismillah if Islamic/Muslim app

APP REQUIREMENTS:
- Every nav item/button must call showScreen() or showTab()
- Every form must call showToast() on success
- Every list/table renders from DB.get()
- Add/edit/delete all work via DB.add/update/delete
- No empty states — pre-populate everything
- Modals for add/edit forms
- Search filters where appropriate
- Stats/counters on dashboard using DB.count()
- Responsive layout
${brandName ? `- Brand: "${appBrandName}", accent: ${accentColour}` : `- Dark theme, accent: ${accentColour}`}
- Malaysian context: RM, DuitNow where relevant
- Islamic elements where appropriate
- Looks like a real paid product`
}
