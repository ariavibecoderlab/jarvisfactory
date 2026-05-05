// ============================================================
// JARVIS_BACKEND - Auth + Data library for JARVIS-built apps
// Auto-injected into every app. Provides Supabase-backed:
//   - signup(email, password, fullName, role?)
//   - login(email, password)
//   - logout()
//   - getCurrentUser()
//   - saveData(table, key, value)
//   - loadData(table, key?)
//   - deleteData(table, key)
// All data is scoped to this app's app_id.
// ============================================================
export const JARVIS_BACKEND_LIB = `
<script>
(function(){
  var SUPABASE_URL = '__SUPABASE_URL__';
  var SUPABASE_ANON = '__SUPABASE_ANON__';
  var APP_ID = '__APP_ID__';

  function uuid(){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;var v=c=='x'?r:(r&0x3|0x8);return v.toString(16);});}

  // Simple SHA-256 for password hashing (browser-native)
  async function sha256(str){
    var buf = new TextEncoder().encode(str);
    var hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
  }

  async function api(path, method, body){
    var opts = {
      method: method || 'GET',
      headers: {
        'apikey': SUPABASE_ANON,
        'Authorization': 'Bearer ' + SUPABASE_ANON,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    };
    if(body) opts.body = JSON.stringify(body);
    var r = await fetch(SUPABASE_URL + '/rest/v1/' + path, opts);
    var data = await r.json().catch(function(){return null;});
    if(!r.ok) throw new Error((data && data.message) || ('HTTP ' + r.status));
    return data;
  }

  var Jarvis = {
    APP_ID: APP_ID,

    // ── AUTH ──
    signup: async function(email, password, fullName, role){
      if(!email || !password) throw new Error('Email and password required');
      var hash = await sha256(password);
      var rows = await api('app_users', 'POST', {
        app_id: APP_ID,
        email: email.toLowerCase().trim(),
        password_hash: hash,
        full_name: fullName || '',
        role: role || 'user'
      });
      var user = rows[0];
      var session = await this._createSession(user.id);
      this._saveSession(session.token, user);
      return { success: true, user: user };
    },

    login: async function(email, password){
      var hash = await sha256(password);
      var rows = await api('app_users?app_id=eq.' + APP_ID + '&email=eq.' + encodeURIComponent(email.toLowerCase().trim()) + '&password_hash=eq.' + hash, 'GET');
      if(!rows || !rows.length) throw new Error('Invalid email or password');
      var user = rows[0];
      var session = await this._createSession(user.id);
      this._saveSession(session.token, user);
      return { success: true, user: user };
    },

    logout: function(){
      localStorage.removeItem('jarvis_session_' + APP_ID);
      localStorage.removeItem('jarvis_user_' + APP_ID);
    },

    getCurrentUser: function(){
      var raw = localStorage.getItem('jarvis_user_' + APP_ID);
      if(!raw) return null;
      try { return JSON.parse(raw); } catch(e){ return null; }
    },

    isLoggedIn: function(){
      return !!this.getCurrentUser();
    },

    _createSession: async function(userId){
      var token = uuid() + uuid();
      var expires = new Date(Date.now() + 30*24*3600*1000).toISOString(); // 30 days
      var rows = await api('app_sessions', 'POST', {
        app_id: APP_ID, app_user_id: userId, token: token, expires_at: expires
      });
      return rows[0];
    },

    _saveSession: function(token, user){
      localStorage.setItem('jarvis_session_' + APP_ID, token);
      localStorage.setItem('jarvis_user_' + APP_ID, JSON.stringify(user));
    },

    // ── DATA ──
    // saveData('staff', 'staff-123', { name: 'Ali', birthday: '...' })
    saveData: async function(table, key, value){
      var user = this.getCurrentUser();
      var payload = {
        app_id: APP_ID,
        app_user_id: user ? user.id : null,
        table_name: table,
        record_key: key,
        value: value
      };
      // Upsert via PostgREST
      var r = await fetch(SUPABASE_URL + '/rest/v1/app_data?on_conflict=app_id,table_name,record_key', {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON,
          'Authorization': 'Bearer ' + SUPABASE_ANON,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify(payload)
      });
      if(!r.ok){ var e = await r.json().catch(function(){return{};}); throw new Error(e.message || 'Save failed'); }
      return await r.json();
    },

    // loadData('staff') => all rows; loadData('staff', 'staff-123') => one row
    loadData: async function(table, key){
      var url = 'app_data?app_id=eq.' + APP_ID + '&table_name=eq.' + encodeURIComponent(table);
      if(key) url += '&record_key=eq.' + encodeURIComponent(key);
      url += '&order=created_at.desc';
      var rows = await api(url, 'GET');
      if(key) return rows && rows.length ? rows[0].value : null;
      return rows.map(function(r){return Object.assign({_key: r.record_key}, r.value);});
    },

    deleteData: async function(table, key){
      await api('app_data?app_id=eq.' + APP_ID + '&table_name=eq.' + encodeURIComponent(table) + '&record_key=eq.' + encodeURIComponent(key), 'DELETE');
      return { success: true };
    },

    // ── ADMIN: list all users of this app (call from admin pages only) ──
    listUsers: async function(){
      var rows = await api('app_users?app_id=eq.' + APP_ID + '&order=created_at.desc&select=id,email,full_name,role,created_at', 'GET');
      return rows;
    }
  };

  window.Jarvis = Jarvis;
})();
</script>`;
