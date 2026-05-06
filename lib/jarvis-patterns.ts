// ============================================================
// JARVIS_PATTERNS — Reference patterns shown to JARVIS in build prompts
// These are battle-tested code snippets that JARVIS must mimic.
// Embedding small focused examples >> long abstract instructions.
// ============================================================

export const AUTH_PATTERN_REFERENCE = `
Below is a working reference pattern. Your output MUST follow this exact structure for any app that needs login:

\`\`\`html
<!-- BOOT: decide which screen to show -->
<script>
document.addEventListener('DOMContentLoaded', function(){
  // Wire up all buttons here, then route:
  if(window.Jarvis && Jarvis.isLoggedIn()){
    loadDashboard();
  } else {
    showOnly('screen-login');
  }
});

// ROUTING — show one screen, hide others
function showOnly(screenId){
  ['screen-login','screen-signup','screen-dash'].forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.style.display = 'none';
  });
  document.getElementById(screenId).style.display = '';
}

// SIGNUP — uses Jarvis.signup, not localStorage
async function doSignup(){
  var email = document.getElementById('signup-email').value.trim();
  var pw = document.getElementById('signup-password').value;
  var name = document.getElementById('signup-name').value.trim();
  var role = document.getElementById('signup-role').value;
  if(!email || !pw){ toast('Email and password required', 'error'); return; }
  if(pw.length < 6){ toast('Password must be 6+ chars', 'error'); return; }
  try {
    await Jarvis.signup(email, pw, name, role);
    toast('Welcome ' + name, 'success');
    await loadDashboard();
  } catch(e){
    var msg = (e.message||'').indexOf('duplicate') !== -1
      ? 'Email already registered. Try signing in.'
      : ('Signup failed: ' + e.message);
    toast(msg, 'error');
  }
}

// LOGIN — uses Jarvis.login, not localStorage
async function doLogin(){
  var email = document.getElementById('login-email').value.trim();
  var pw = document.getElementById('login-password').value;
  if(!email || !pw){ toast('Email and password required', 'error'); return; }
  try {
    await Jarvis.login(email, pw);
    await loadDashboard();
  } catch(e){
    toast('Login failed: ' + e.message, 'error');
  }
}

// LOGOUT
function doLogout(){
  Jarvis.logout();
  showOnly('screen-login');
}

// DASHBOARD — gets current user, branches by role, loads data via Jarvis
async function loadDashboard(){
  var user = Jarvis.getCurrentUser();
  if(!user){ showOnly('screen-login'); return; }
  showOnly('screen-dash');
  // Display user info, render role-specific UI
  document.getElementById('dash-name').textContent = user.full_name;
  if(user.role === 'admin'){
    var allRecords = await Jarvis.loadData('items') || [];
    renderAdminView(allRecords);
  } else {
    var myRecords = (await Jarvis.loadData('items') || [])
      .filter(function(r){ return r.userId === user.id; });
    renderUserView(myRecords);
  }
}

// SAVE — uses Jarvis.saveData (upsert by record_key)
async function saveItem(data){
  var key = 'item-' + Date.now();
  await Jarvis.saveData('items', key, data);  // table='items', key=unique, value=any object
  await loadDashboard();  // refresh
}

// TOAST helper for errors/success
function toast(msg, type){
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + (type||'info') + ' show';
  setTimeout(function(){ t.classList.remove('show'); }, 3500);
}
</script>
\`\`\`

Copy this exact pattern. Adapt the table names ('items' → 'staff', 'gifts', 'orders', etc.) for your app.
`;

// ============================================================
// VALIDATOR — Layer 2: Catch broken builds before user sees them
// ============================================================
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateBuild(html: string, requiresAuth: boolean): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic sanity
  if (!html || html.length < 200) {
    errors.push('Output is too short to be a real app');
    return { valid: false, errors, warnings };
  }
  if (!html.includes('<html') && !html.includes('<!DOCTYPE')) {
    errors.push('Output does not look like an HTML document');
  }

  if (requiresAuth) {
    // ── Critical: must use Jarvis backend, not localStorage hacks ──
    const hasJarvisAuth = /Jarvis\.(signup|login|logout|getCurrentUser|isLoggedIn)\s*\(/.test(html);
    if (!hasJarvisAuth) {
      errors.push('App requires auth but does NOT call Jarvis.signup/login/logout — must use the injected backend');
    }

    // ── Forbidden: hardcoded demo credentials ──
    const demoCredsPatterns = [
      /demo@example\.com/i,
      /password\s*[=:]\s*['"]demo123['"]/i,
      /['"]demo123['"]/,
      /admin@admin\.com/i,
    ];
    for (const pat of demoCredsPatterns) {
      if (pat.test(html)) {
        errors.push(`Hardcoded demo credentials detected (${pat}) — auth must use real Jarvis.signup/login`);
        break;
      }
    }

    // ── Forbidden: localStorage for user/auth/credentials ──
    // We allow localStorage for things like dark mode, but NOT for user accounts
    const badLocalStoragePatterns = [
      /localStorage\.(setItem|getItem)\s*\(\s*['"](users|accounts|credentials|currentUser|loggedInUser)['"]/i,
      /JSON\.stringify\s*\(\s*users\s*\)/,
      /['"]users['"]\s*,\s*JSON\.stringify/,
    ];
    for (const pat of badLocalStoragePatterns) {
      if (pat.test(html)) {
        errors.push('localStorage used for user/account/credentials storage — must use Jarvis.saveData/loadData instead');
        break;
      }
    }

    // ── Required: signup form should call doSignup or Jarvis.signup ──
    const hasSignupHandler = /(?:onclick|addEventListener|onsubmit)[\s\S]{0,40}(?:doSignup|Jarvis\.signup)/i.test(html);
    if (!hasSignupHandler) {
      warnings.push('Could not detect a signup handler wired to a button — verify signup flow works');
    }
  }

  // ── Soft warnings: not blocking but worth flagging ──
  if (html.length > 100000) {
    warnings.push('App is very large (>100KB) — consider simplifying for faster loading');
  }
  if (!html.includes('toast') && !html.includes('alert(')) {
    warnings.push('No error display mechanism detected — users won\'t see error messages');
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ============================================================
// Detect whether a user prompt requires auth
// Used to decide whether to apply auth-specific validation
// ============================================================
export function promptRequiresAuth(prompt: string, answers: string): boolean {
  const combined = (prompt + ' ' + answers).toLowerCase();
  const authKeywords = [
    'login', 'log in', 'log-in', 'logon',
    'sign up', 'signup', 'sign-up', 'register',
    'authentication', 'auth', 'account',
    'multi-user', 'multiple users', 'users can',
    'admin', 'staff', 'role', 'permission',
    'private', 'profile',
  ];
  return authKeywords.some(kw => combined.includes(kw));
}
