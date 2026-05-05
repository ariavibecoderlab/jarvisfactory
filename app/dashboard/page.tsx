'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [jarvis, setJarvis] = useState<any>(null)
  const [apps, setApps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      setUser(user)

      const [{ data: profile }, { data: jarvis }, { data: apps }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('jarvis_profiles').select('*').eq('user_id', user.id).single(),
        supabase.from('apps').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      ])

      setProfile(profile)
      setJarvis(jarvis)
      setApps(apps || [])
      setLoading(false)
    }
    load()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  const c: Record<string, React.CSSProperties> = {
    page: { minHeight:'100vh', background:'#05050d', fontFamily:"'DM Sans',sans-serif" },
    nav: { background:'#0a0a18', borderBottom:'1px solid #1a1a35', padding:'0 32px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between' },
    logo: { fontFamily:"'Space Mono',monospace", fontSize:14, color:'#00e5b0', fontWeight:700 },
    main: { padding:'40px 32px', maxWidth:1200, margin:'0 auto' },
    welcome: { marginBottom:40 },
    welcomeTitle: { fontFamily:"'Bebas Neue',sans-serif", fontSize:40, letterSpacing:1, marginBottom:6 },
    welcomeSub: { fontSize:15, color:'#8888aa' },
    grid: { display:'grid', gridTemplateColumns:'280px 1fr', gap:24, alignItems:'start' },
    jarvisCard: { background:'#0a0a18', border:'1px solid rgba(0,229,176,0.2)', borderRadius:14, padding:24 },
    jarvisAv: { width:64, height:64, background:'rgba(0,229,176,0.1)', border:'2px solid rgba(0,229,176,0.3)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, marginBottom:16 },
    jarvisName: { fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:'#00e5b0', letterSpacing:1 },
    jarvisInfo: { fontSize:12, color:'#8888aa', fontFamily:"'Space Mono',monospace", lineHeight:1.8, marginTop:8 },
    buildBtn: { width:'100%', marginTop:20, padding:'12px 0', background:'#00e5b0', color:'#000', border:'none', borderRadius:8, fontFamily:"'Space Mono',monospace", fontSize:12, fontWeight:700, cursor:'pointer' },
    appsWrap: {},
    appsHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 },
    appsTitle: { fontFamily:"'Space Mono',monospace", fontSize:13, fontWeight:700 },
    newAppBtn: { padding:'8px 18px', background:'#00e5b0', color:'#000', border:'none', borderRadius:6, fontFamily:"'Space Mono',monospace", fontSize:11, fontWeight:700, cursor:'pointer' },
    appsGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:16 },
    appCard: { background:'#0a0a18', border:'1px solid #1a1a35', borderRadius:12, padding:20, cursor:'pointer', transition:'all 0.2s' },
    appName: { fontSize:16, fontWeight:600, marginBottom:6 },
    appDesc: { fontSize:12, color:'#8888aa', marginBottom:14, lineHeight:1.6 },
    appMeta: { display:'flex', justifyContent:'space-between', alignItems:'center' },
    appDate: { fontSize:11, color:'#5a5a78', fontFamily:"'Space Mono',monospace" },
    appStatus: { fontSize:10, padding:'3px 8px', borderRadius:10, fontFamily:"'Space Mono',monospace" },
    emptyState: { background:'#0a0a18', border:'1px dashed #1a1a35', borderRadius:12, padding:'60px 40px', textAlign:'center' as const, gridColumn:'1/-1' },
    emptyIcon: { fontSize:48, marginBottom:16, opacity:0.3 },
    emptyTitle: { fontFamily:"'Space Mono',monospace", fontSize:14, color:'#8888aa', marginBottom:8 },
    emptySub: { fontSize:13, color:'#5a5a78', lineHeight:1.7, maxWidth:300, margin:'0 auto 24px' },
    statsRow: { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:24 },
    statCard: { background:'#0a0a18', border:'1px solid #1a1a35', borderRadius:10, padding:'16px 20px' },
    statNum: { fontFamily:"'Bebas Neue',sans-serif", fontSize:32, color:'#00e5b0', lineHeight:1 },
    statLabel: { fontSize:11, color:'#8888aa', fontFamily:"'Space Mono',monospace", marginTop:4 },
    signOutBtn: { padding:'6px 14px', background:'transparent', border:'1px solid #1a1a35', borderRadius:6, color:'#8888aa', fontFamily:"'Space Mono',monospace", fontSize:11, cursor:'pointer' },
  }

  if (loading) return (
    <div style={{...c.page, display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div style={{fontFamily:"'Space Mono',monospace", color:'#00e5b0', fontSize:14}}>Loading your JARVIS...</div>
    </div>
  )

  return (
    <div style={c.page}>
      <nav style={c.nav}>
        <div style={c.logo}>JARVISFACTORY.AI</div>
        <div style={{display:'flex',gap:12,alignItems:'center'}}>
          <span style={{fontSize:13,color:'#8888aa'}}>{user?.email}</span>
          <button style={c.signOutBtn} onClick={signOut}>Sign Out</button>
        </div>
      </nav>

      <div style={c.main}>
        <div style={c.welcome}>
          <div style={c.welcomeTitle}>Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}! 👋</div>
          <div style={c.welcomeSub}>Your {jarvis?.jarvis_name || 'JARVIS'} is ready to build.</div>
        </div>

        <div style={c.grid}>
          {/* LEFT: JARVIS Card */}
          <div>
            <div style={c.jarvisCard}>
              <div style={c.jarvisAv}>🤖</div>
              <div style={c.jarvisName}>{jarvis?.jarvis_name || 'JARVIS'}</div>
              <div style={{fontSize:11,color:'#00e5b0',fontFamily:"'Space Mono',monospace",marginTop:4}}>Your AI Developer</div>
              <div style={c.jarvisInfo}>
                Industry: {jarvis?.industry || '—'}<br/>
                Speciality: {jarvis?.goal || '—'}<br/>
                Language: {jarvis?.language || 'English'}<br/>
                Level: {jarvis?.tech_level || '—'}
              </div>
              <button style={c.buildBtn} onClick={() => router.push('/builder')}>
                ⚡ Build New App
              </button>
            </div>

            <div style={{...c.statsRow, gridTemplateColumns:'1fr', marginTop:16}}>
              <div style={c.statCard}>
                <div style={c.statNum}>{apps.length}</div>
                <div style={c.statLabel}>Apps Built</div>
              </div>
              <div style={{...c.statCard,marginTop:12}}>
                <div style={c.statNum}>RM 0</div>
                <div style={c.statLabel}>Credits Used</div>
              </div>
            </div>
          </div>

          {/* RIGHT: Apps */}
          <div style={c.appsWrap}>
            <div style={c.appsHeader}>
              <div style={c.appsTitle}>My Apps ({apps.length})</div>
              <button style={c.newAppBtn} onClick={() => router.push('/builder')}>+ New App</button>
            </div>

            <div style={c.appsGrid}>
              {apps.length === 0 ? (
                <div style={c.emptyState}>
                  <div style={c.emptyIcon}>⬡</div>
                  <div style={c.emptyTitle}>No apps yet</div>
                  <div style={c.emptySub}>Tell your {jarvis?.jarvis_name || 'JARVIS'} what to build. It will plan, estimate, and build your first app.</div>
                  <button style={{padding:'11px 24px',background:'#00e5b0',color:'#000',border:'none',borderRadius:8,fontFamily:"'Space Mono',monospace",fontSize:12,fontWeight:700,cursor:'pointer'}} onClick={() => router.push('/builder')}>
                    Build My First App →
                  </button>
                </div>
              ) : apps.map(app => (
                <div key={app.id} style={c.appCard} onClick={()=>router.push(`/builder?app=${app.id}`)}>
                  <div style={c.appName}>{app.name}</div>
                  <div style={c.appDesc}>{app.description?.substring(0,80)}...</div>
                  <div style={c.appMeta}>
                    <div style={c.appDate}>{new Date(app.created_at).toLocaleDateString()}</div>
                    <div style={{...c.appStatus, background:'rgba(0,229,176,0.1)', color:'#00e5b0'}}>● Open →</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
