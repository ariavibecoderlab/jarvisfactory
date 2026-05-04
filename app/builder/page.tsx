'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function Builder() {
  const [user, setUser] = useState<any>(null)
  const [jarvis, setJarvis] = useState<any>(null)
  const [prompt, setPrompt] = useState('')
  const [phase, setPhase] = useState<'idle'|'planning'|'questioning'|'approving'|'building'|'done'>('idle')
  const [messages, setMessages] = useState<any[]>([])
  const [builtCode, setBuiltCode] = useState('')
  const [activeTab, setActiveTab] = useState<'code'|'preview'>('code')
  const [pendingPlan, setPendingPlan] = useState<any>(null)
  const [qAnswers, setQAnswers] = useState<Record<number,string>>({})
  const [buildTime, setBuildTime] = useState('—')
  const [tokens, setTokens] = useState('—')
  const [logs, setLogs] = useState<{t:string,msg:string,type:string}[]>([
    {t:'00:00:00',msg:`JARVISFACTORY v1.0 — Plan → Question → Approve → Build`,type:'info'},
    {t:'00:00:00',msg:'Claude Sonnet 4.6 backend ready.',type:'ok'}
  ])
  const timerRef = useRef<any>(null)
  const startRef = useRef<number>(0)
  const chatRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      setUser(user)
      const { data: jarvis } = await supabase.from('jarvis_profiles').select('*').eq('user_id', user.id).single()
      setJarvis(jarvis)
      addChat(`Good day. I'm <strong style="color:#00e5b0">${jarvis?.jarvis_name||'JARVIS'}</strong> — your personal AI developer.<br><br>I specialise in <strong>${jarvis?.industry||'your industry'}</strong> apps. Before writing any code, I will:<br><span style="color:#00e5b0">①</span> Ask clarifying questions<br><span style="color:#8b7cf8">②</span> Present a full build plan with time & cost<br><span style="color:#ffd166">③</span> Build only after you approve<br><br>What do you want to build today?`)
    }
    load()
  }, [])

  useEffect(() => {
    if(chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  useEffect(() => {
    if(termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight
  }, [logs])

  function ts() {
    const n=new Date(); return[n.getHours(),n.getMinutes(),n.getSeconds()].map(x=>String(x).padStart(2,'0')).join(':')
  }
  function addLog(msg:string,type='info') { setLogs(l => [...l,{t:ts(),msg,type}]) }
  function addChat(html:string,isUser=false) { setMessages(m=>[...m,{html,isUser,id:Date.now()}]) }

  function phaseLabel() {
    return {idle:'IDLE',planning:'PLANNING',questioning:'Q&A',approving:'REVIEW',building:'BUILDING',done:'DONE'}[phase]
  }

  function getApiKey() { return localStorage.getItem('jf_anthropic_key')||'' }

  async function callClaude(sys:string,msg:string,maxTok=10000) {
    const key = getApiKey()
    if(!key) throw new Error('No Anthropic API key. Add it in settings.')
    const r = await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:maxTok,system:sys,messages:[{role:'user',content:msg}]})
    })
    const d = await r.json()
    if(!r.ok) throw new Error(d.error?.message||`API error ${r.status}`)
    return d.content[0].text
  }

  async function launch() {
    if(!prompt.trim()) return
    const key = getApiKey()
    if(!key) {
      const k = window.prompt('Enter your Anthropic API key (sk-ant-...):')
      if(k) localStorage.setItem('jf_anthropic_key',k)
      else return
    }

    addChat(prompt, true)
    setPhase('planning')
    addLog(`NEW PROJECT: ${prompt.substring(0,60)}...`,'build')
    addLog('Analysing requirements...','plan')

    const thinkId = Date.now()
    setMessages(m=>[...m,{html:'<div style="display:flex;gap:4px;align-items:center"><span style="width:6px;height:6px;border-radius:50%;background:#00e5b0;animation:bob 1s infinite"></span><span style="width:6px;height:6px;border-radius:50%;background:#8b7cf8;animation:bob 1s 0.15s infinite"></span><span style="width:6px;height:6px;border-radius:50%;background:#ff6b9d;animation:bob 1s 0.3s infinite"></span></div>',isUser:false,id:thinkId,isThinking:true}])

    try {
      const sys = `You are ${jarvis?.jarvis_name||'JARVIS'}, an elite AI developer specialising in ${jarvis?.industry||'general'} apps.
Generate 2-3 clarifying questions with options for this app request.
Return ONLY valid JSON (no markdown):
{"questions":[{"q":"Question?","options":["A","B","C"]}],"app_name":"Name","summary":"One sentence","features":["f1","f2","f3"]}`

      const raw = await callClaude(sys, `Client request: ${prompt}`, 1500)
      let data; try{data=JSON.parse(raw.replace(/```json|```/g,'').trim())}catch(e){throw new Error('Parse failed. Try again.')}
      setPendingPlan(data); setPhase('questioning'); addLog('Questions ready.','plan')
      setMessages(m=>m.map(msg=>msg.id===thinkId ? {
        ...msg, isThinking:false,
        html:`<div style="background:#1e1e30;border:1px solid rgba(255,209,102,0.2);border-radius:10px;padding:14px">
          <div style="font-family:'Space Mono',monospace;font-size:10px;color:#ffd166;margin-bottom:12px;text-transform:uppercase;letter-spacing:1px">🔍 Quick Questions</div>
          <p style="font-size:11px;color:#8888aa;margin-bottom:12px">Help me build exactly what you need:</p>
          ${data.questions.map((q:any,i:number)=>`
            <div style="margin-bottom:10px">
              <div style="font-size:12px;margin-bottom:6px">${i+1}. ${q.q}</div>
              <div style="display:flex;flex-wrap:wrap;gap:5px">
                ${q.options.map((o:string)=>`<button onclick="window.selectQ(${i},'${o.replace(/'/g,"\\'")}',this)" style="padding:4px 10px;background:#161625;border:1px solid #2e2e48;border-radius:20px;font-size:11px;color:#8888aa;cursor:pointer;font-family:'Space Mono',monospace">${o}</button>`).join('')}
              </div>
            </div>`).join('')}
          <button onclick="window.submitQ()" style="width:100%;margin-top:10px;padding:8px;background:#8b7cf8;color:#fff;border:none;border-radius:7px;font-family:'Space Mono',monospace;font-size:11px;font-weight:700;cursor:pointer">Submit & See Build Plan →</button>
        </div>`
      } : msg))

      // Expose global handlers
      ;(window as any).selectQ = (i:number,val:string,btn:HTMLElement) => {
        btn.closest('div')?.querySelectorAll('button').forEach((b:any)=>{b.style.borderColor='#2e2e48';b.style.color='#8888aa';b.style.background='#161625'})
        btn.style.borderColor='#8b7cf8'; btn.style.color='#8b7cf8'; btn.style.background='rgba(139,124,248,0.1)'
        setQAnswers(prev=>({...prev,[i]:val}))
      }
      ;(window as any).submitQ = () => submitAnswers()

    } catch(err:any) {
      setMessages(m=>m.map(msg=>msg.id===thinkId?{...msg,isThinking:false,html:`❌ ${err.message}`}:msg))
      addLog('ERROR: '+err.message,'err'); setPhase('idle')
    }
  }

  async function submitAnswers() {
    if(!pendingPlan) return
    setPhase('approving')
    const answers = pendingPlan.questions.map((q:any,i:number)=>`${q.q}: ${qAnswers[i]||q.options[0]}`).join('\n')
    addLog('Generating final build plan...','plan')
    const thinkId = Date.now()
    setMessages(m=>[...m,{html:'<div style="display:flex;gap:4px"><span style="width:6px;height:6px;border-radius:50%;background:#00e5b0;animation:bob 1s infinite"></span><span style="width:6px;height:6px;border-radius:50%;background:#8b7cf8;animation:bob 1s 0.15s infinite"></span><span style="width:6px;height:6px;border-radius:50%;background:#ff6b9d;animation:bob 1s 0.3s infinite"></span></div>',isUser:false,id:thinkId,isThinking:true}])

    try {
      const sys = `You are JARVIS. Generate a final build plan as JSON (no markdown):
{"app_name":"Name","summary":"Description","features":["f1","f2","f3","f4","f5","f6"],"tech":"HTML+CSS+JS","est_time":"60-120 seconds","est_tokens":"5000-8000","complexity":"Medium","note":"approach"}`
      const raw = await callClaude(sys,`Request: ${prompt}\nAnswers:\n${answers}`,1500)
      let plan; try{plan=JSON.parse(raw.replace(/```json|```/g,'').trim())}catch(e){plan=pendingPlan}
      setPendingPlan((prev:any)=>({...prev,final:plan}))
      addLog('Plan ready. Awaiting approval...','plan')

      setMessages(m=>m.map(msg=>msg.id===thinkId ? {
        ...msg, isThinking:false,
        html:`<div style="background:#1e1e30;border:1px solid #2e2e48;border-radius:10px;padding:14px">
          <div style="font-family:'Space Mono',monospace;font-size:10px;color:#00e5b0;margin-bottom:10px;text-transform:uppercase;letter-spacing:1px">📋 Build Plan — ${plan.app_name}</div>
          <div style="display:flex;justify-content:space-between;margin-bottom:5px;font-size:11px;color:#8888aa"><span>Complexity</span><strong style="color:#f0f0fa">${plan.complexity}</strong></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:5px;font-size:11px;color:#8888aa"><span>Est. Time</span><strong style="color:#ffd166">${plan.est_time}</strong></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:5px;font-size:11px;color:#8888aa"><span>Est. Tokens</span><strong style="color:#f0f0fa">${plan.est_tokens}</strong></div>
          <div style="height:1px;background:#252538;margin:10px 0"></div>
          <div style="font-size:11px;color:#8888aa;margin-bottom:8px">${plan.summary}</div>
          ${plan.features?.map((f:string)=>`<div style="font-size:11px;color:#8888aa;margin-bottom:4px;display:flex;gap:6px"><span style="color:#00e5b0;font-family:'Space Mono',monospace">✓</span>${f}</div>`).join('')}
          <div style="height:1px;background:#252538;margin:10px 0"></div>
          <div style="font-size:10px;color:#5a5a78;font-family:'Space Mono',monospace;margin-bottom:12px">${plan.note}</div>
          <div style="display:flex;gap:8px">
            <button onclick="window.rejectPlan()" style="flex:1;padding:9px;background:transparent;color:#8888aa;border:1px solid #2e2e48;border-radius:7px;font-family:'Space Mono',monospace;font-size:11px;cursor:pointer">✕ Revise</button>
            <button onclick="window.approvePlan()" style="flex:1;padding:9px;background:#00e5b0;color:#000;border:none;border-radius:7px;font-family:'Space Mono',monospace;font-size:11px;font-weight:700;cursor:pointer">✓ Approve & Build</button>
          </div>
        </div>`
      } : msg))

      ;(window as any).rejectPlan = () => { setPhase('idle'); addChat("No problem — update your description and let's start fresh.") }
      ;(window as any).approvePlan = () => buildApp(plan)

    } catch(err:any) {
      setMessages(m=>m.map(msg=>msg.id===thinkId?{...msg,isThinking:false,html:`❌ ${err.message}`}:msg))
      addLog('ERROR: '+err.message,'err'); setPhase('idle')
    }
  }

  async function buildApp(plan:any) {
    setPhase('building')
    addChat('✅ Plan approved! Building your app now...')
    addLog('Code generation started...','ok')
    startRef.current = Date.now()
    timerRef.current = setInterval(()=>{setBuildTime(((Date.now()-startRef.current)/1000).toFixed(1)+'s')},100)

    const thinkId = Date.now()
    setMessages(m=>[...m,{html:'<div style="display:flex;gap:4px"><span style="width:6px;height:6px;border-radius:50%;background:#00e5b0;animation:bob 1s infinite"></span><span style="width:6px;height:6px;border-radius:50%;background:#8b7cf8;animation:bob 1s 0.15s infinite"></span><span style="width:6px;height:6px;border-radius:50%;background:#ff6b9d;animation:bob 1s 0.3s infinite"></span></div>',isUser:false,id:thinkId,isThinking:true}])

    try {
      const answers = pendingPlan?.questions?.map((q:any,i:number)=>`${q.q}: ${qAnswers[i]||q.options[0]}`).join(', ')||''
      const sys = `You are ${jarvis?.jarvis_name||'JARVIS'}. Build a complete, beautiful, fully-functional single-file HTML app.
RULES:
- Return ONLY raw HTML. No markdown, no backticks, no explanation.
- All CSS and JS inline in one file.
- Beautiful professional UI, smooth animations, cohesive design.
- FULLY FUNCTIONAL — all buttons work, data saves to localStorage.
- Mobile responsive. Use Google Fonts.
- Malaysian context: RM currency, DuitNow where relevant.
- Islamic context where applicable.
- Build REAL functionality — not placeholders.
- Looks like a real product someone would pay for.`

      const html = await callClaude(sys,`Build: ${prompt}\nPreferences: ${answers}`)
      clearInterval(timerRef.current)

      const code = html.replace(/^```html\n?/,'').replace(/\n?```$/,'').trim()
      const tok = Math.round(code.length/4)
      setBuiltCode(code)
      setTokens(tok.toLocaleString())
      setPhase('done')
      addLog(`DONE. ~${tok} tokens, ${((Date.now()-startRef.current)/1000).toFixed(1)}s`,'ok')

      // Save to Supabase
      if(user) {
        await supabase.from('apps').insert({
          user_id: user.id,
          name: plan.app_name || 'My App',
          description: plan.summary || prompt.substring(0,200),
          html_code: code,
          tokens_used: tok,
          build_time: ((Date.now()-startRef.current)/1000).toFixed(1),
          created_at: new Date().toISOString()
        })
      }

      setMessages(m=>m.map(msg=>msg.id===thinkId?{
        ...msg,isThinking:false,
        html:`🚀 <strong>Build complete!</strong><br><br><strong style="color:#00e5b0">${tok.toLocaleString()} tokens</strong> · <strong style="color:#ffd166">${((Date.now()-startRef.current)/1000).toFixed(1)}s</strong><br><br>Switch to <strong>⬡ Preview</strong> tab to test it. The app has been saved to your dashboard.`
      }:msg))

      setTimeout(()=>setActiveTab('preview'),800)

    } catch(err:any) {
      clearInterval(timerRef.current)
      setMessages(m=>m.map(msg=>msg.id===thinkId?{...msg,isThinking:false,html:`❌ ${err.message}`}:msg))
      addLog('ERROR: '+err.message,'err'); setPhase('idle')
    }
  }

  function download() {
    if(!builtCode) return
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([builtCode],{type:'text/html'}))
    a.download='jarvis-app.html'; a.click(); addLog('App downloaded.','ok')
  }

  const c: Record<string,React.CSSProperties> = {
    page:{height:'100vh',display:'flex',flexDirection:'column',background:'#05050d',fontFamily:"'DM Sans',sans-serif",overflow:'hidden'},
    nav:{height:50,background:'#0a0a18',borderBottom:'1px solid #1a1a35',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 18px',flexShrink:0},
    logo:{fontFamily:"'Space Mono',monospace",fontSize:14,color:'#00e5b0',fontWeight:700},
    main:{display:'flex',flex:1,overflow:'hidden'},
    left:{width:260,background:'#0a0a18',borderRight:'1px solid #1a1a35',display:'flex',flexDirection:'column',flexShrink:0},
    pTitle:{padding:'10px 14px',fontSize:10,fontFamily:"'Space Mono',monospace",color:'#5a5a78',textTransform:'uppercase' as const,letterSpacing:1.5,borderBottom:'1px solid #1a1a35',display:'flex',justifyContent:'space-between'},
    phaseTag:{fontSize:9,padding:'2px 7px',borderRadius:10,fontFamily:"'Space Mono',monospace",background:'rgba(90,90,120,0.3)',color:'#8888aa'},
    promptArea:{flex:1,padding:12,overflowY:'auto',display:'flex',flexDirection:'column',gap:10},
    textarea:{width:'100%',background:'#161625',border:'1px solid #2e2e48',borderRadius:8,color:'#f0f0fa',fontFamily:"'DM Sans',sans-serif",fontSize:13,padding:10,resize:'none',height:100,lineHeight:1.6,outline:'none',boxSizing:'border-box' as const},
    launchBtn:{margin:'0 12px 12px',padding:11,background:'#00e5b0',color:'#000',border:'none',borderRadius:8,fontFamily:"'Space Mono',monospace",fontSize:12,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6},
    center:{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'},
    tabs:{display:'flex',background:'#0a0a18',borderBottom:'1px solid #1a1a35',padding:'0 14px',flexShrink:0},
    tab:{padding:'9px 14px',fontSize:11,fontFamily:"'Space Mono',monospace",color:'#5a5a78',cursor:'pointer',borderBottom:'2px solid transparent'},
    codeWrap:{flex:1,background:'#05050d',padding:16,overflow:'auto'},
    previewWrap:{flex:1,background:'#fff',overflow:'hidden',display:'flex',flexDirection:'column'},
    term:{height:150,background:'#04040c',borderTop:'1px solid #1a1a35',flexShrink:0,display:'flex',flexDirection:'column'},
    termH:{padding:'6px 14px',borderBottom:'1px solid #1a1a35',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0},
    termB:{flex:1,overflow:'auto',padding:'6px 14px',fontFamily:"'Space Mono',monospace",fontSize:10.5,lineHeight:1.9},
    right:{width:320,background:'#0a0a18',borderLeft:'1px solid #1a1a35',display:'flex',flexDirection:'column',flexShrink:0},
    chatH:{padding:'10px 14px',borderBottom:'1px solid #1a1a35',display:'flex',justifyContent:'space-between',alignItems:'center'},
    chatBody:{flex:1,overflowY:'auto',padding:12,display:'flex',flexDirection:'column',gap:10},
    msg:{display:'flex',gap:8,alignItems:'flex-start'},
    av:{width:24,height:24,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,flexShrink:0,fontFamily:"'Space Mono',monospace"},
    bubble:{fontSize:12,lineHeight:1.7,color:'#f0f0fa',background:'#161625',padding:'9px 11px',borderRadius:8,border:'1px solid #252538',wordBreak:'break-word' as const,flex:1},
  }

  return (
    <div style={c.page}>
      <style>{`@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}`}</style>
      <nav style={c.nav}>
        <div style={c.logo}>JARVISFACTORY.AI</div>
        <div style={{display:'flex',gap:12,alignItems:'center'}}>
          <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:'#8888aa'}}>
            {jarvis?.jarvis_name||'JARVIS'} · {jarvis?.industry||''}
          </span>
          <button style={{padding:'5px 12px',background:'transparent',border:'1px solid #1a1a35',borderRadius:6,color:'#8888aa',fontFamily:"'Space Mono',monospace",fontSize:11,cursor:'pointer'}} onClick={()=>router.push('/dashboard')}>← Dashboard</button>
        </div>
      </nav>

      <div style={c.main}>
        {/* LEFT */}
        <div style={c.left}>
          <div style={c.pTitle}><span>Describe App</span><span style={c.phaseTag}>{phaseLabel()}</span></div>
          <div style={c.promptArea}>
            <textarea style={c.textarea} placeholder="Describe your app in plain language..." value={prompt} onChange={e=>setPrompt(e.target.value)}/>
            <div style={{fontSize:10,color:'#5a5a78',fontFamily:"'Space Mono',monospace",textTransform:'uppercase' as const,letterSpacing:1}}>Quick starts</div>
            {['DRE Coffee loyalty app with points & referral','Brainy Bunch student progress tracker','Muslim ibadah daily tracker with streaks','Staff birthday gifts manager with reminders'].map(p=>(
              <button key={p} onClick={()=>setPrompt(p)} style={{padding:'8px 10px',background:'#161625',border:'1px solid #1a1a35',borderRadius:6,color:'#8888aa',fontSize:11,textAlign:'left' as const,cursor:'pointer',lineHeight:1.4}}>{p}</button>
            ))}
            <div style={{background:'#0d0d1e',border:'1px solid #1a1a35',borderRadius:8,padding:12}}>
              <div style={{fontSize:9,fontFamily:"'Space Mono',monospace",color:'#5a5a78',textTransform:'uppercase' as const,letterSpacing:1,marginBottom:8}}>Metrics</div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#8888aa',marginBottom:4}}><span>Tokens</span><span style={{color:'#f0f0fa'}}>{tokens}</span></div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#8888aa'}}><span>Build Time</span><span style={{color:'#f0f0fa'}}>{buildTime}</span></div>
            </div>
          </div>
          <button style={{...c.launchBtn,opacity:phase!=='idle'&&phase!=='done'?0.5:1}} onClick={launch} disabled={phase!=='idle'&&phase!=='done'}>
            <span>⚡</span>{phase==='done'?'Rebuild':'Launch '+( jarvis?.jarvis_name||'JARVIS')}
          </button>
          {builtCode && <button onClick={download} style={{margin:'-6px 12px 12px',padding:9,background:'#161625',color:'#8888aa',border:'1px solid #1a1a35',borderRadius:8,fontFamily:"'Space Mono',monospace",fontSize:11,cursor:'pointer'}}>⬇ Download HTML</button>}
        </div>

        {/* CENTER */}
        <div style={c.center}>
          <div style={c.tabs}>
            <div style={{...c.tab,color:activeTab==='code'?'#00e5b0':'#5a5a78',borderBottomColor:activeTab==='code'?'#00e5b0':'transparent'}} onClick={()=>setActiveTab('code')}>index.html</div>
            <div style={{...c.tab,color:activeTab==='preview'?'#00e5b0':'#5a5a78',borderBottomColor:activeTab==='preview'?'#00e5b0':'transparent'}} onClick={()=>setActiveTab('preview')}>⬡ Preview</div>
          </div>

          {activeTab==='code' ? (
            <div style={c.codeWrap}>
              {!builtCode ? (
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:14,color:'#5a5a78'}}>
                  <div style={{fontSize:40,opacity:0.2}}>⬡</div>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:13}}>// Waiting for instructions</div>
                  <div style={{fontSize:12,textAlign:'center',maxWidth:280,lineHeight:1.7}}>{jarvis?.jarvis_name||'JARVIS'} will plan first, ask questions, show you the build plan with time & cost — then build only after you approve.</div>
                </div>
              ) : <pre style={{fontFamily:"'Space Mono',monospace",fontSize:11.5,lineHeight:1.8,color:'#7ec8a0',whiteSpace:'pre-wrap',wordBreak:'break-all'}}>{builtCode}</pre>}
            </div>
          ) : (
            <div style={c.previewWrap}>
              {!builtCode ? (
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',background:'#0a0a18',gap:12,color:'#5a5a78'}}>
                  <div style={{fontSize:40,opacity:0.2}}>◻</div>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:13}}>Preview loads after build</div>
                </div>
              ) : <iframe style={{flex:1,border:'none',width:'100%',height:'100%'}} srcDoc={builtCode}/>}
            </div>
          )}

          {/* TERMINAL */}
          <div style={c.term}>
            <div style={c.termH}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{display:'flex',gap:4}}><div style={{width:10,height:10,borderRadius:'50%',background:'#ff5f57'}}/><div style={{width:10,height:10,borderRadius:'50%',background:'#febc2e'}}/><div style={{width:10,height:10,borderRadius:'50%',background:'#28c840'}}/></div>
                <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:'#5a5a78',letterSpacing:1}}>TERMINAL</span>
              </div>
              <button onClick={()=>setLogs([])} style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:'#5a5a78',background:'none',border:'none',cursor:'pointer'}}>Clear</button>
            </div>
            <div style={c.termB} ref={termRef}>
              {logs.map((l,i)=>(
                <div key={i} style={{display:'block'}}>
                  <span style={{color:'#5a5a78',marginRight:10}}>{l.t}</span>
                  <span style={{color:{info:'#00e5b0',ok:'#06d6a0',err:'#ff4d6d',warn:'#ffd166',build:'#8b7cf8',plan:'#ffd166'}[l.type]||'#00e5b0'}}>{l.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: CHAT */}
        <div style={c.right}>
          <div style={c.chatH}>
            <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:'#8888aa'}}>🤖 <span style={{color:'#00e5b0'}}>{jarvis?.jarvis_name||'JARVIS'}</span></span>
            <span style={{fontSize:10,color:'#5a5a78',fontFamily:"'Space Mono',monospace"}}>{messages.length} messages</span>
          </div>
          <div style={c.chatBody} ref={chatRef}>
            {messages.map(msg=>(
              <div key={msg.id} style={c.msg}>
                <div style={{...c.av,background:msg.isUser?'rgba(139,124,248,0.12)':'rgba(0,229,176,0.12)',color:msg.isUser?'#8b7cf8':'#00e5b0',border:`1px solid ${msg.isUser?'rgba(139,124,248,0.25)':'rgba(0,229,176,0.25)'}`}}>{msg.isUser?'U':'J'}</div>
                <div>
                  <div style={{fontSize:9,fontFamily:"'Space Mono',monospace",color:'#5a5a78',marginBottom:3,textTransform:'uppercase' as const,letterSpacing:0.5}}>{msg.isUser?'You':jarvis?.jarvis_name||'JARVIS'} · Now</div>
                  <div style={{...c.bubble,borderColor:msg.isUser?'rgba(139,124,248,0.15)':'rgba(0,229,176,0.1)'}} dangerouslySetInnerHTML={{__html:msg.html}}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
