'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function Builder() {
  const [user, setUser] = useState<any>(null)
  const [jarvis, setJarvis] = useState<any>(null)
  const [prompt, setPrompt] = useState('')
  const [phase, setPhase] = useState<'idle'|'planning'|'questioning'|'approving'|'building'|'done'>('idle')
  const [builtCode, setBuiltCode] = useState('')
  const [activeTab, setActiveTab] = useState<'code'|'preview'>('code')
  const [pendingPlan, setPendingPlan] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [qAnswers, setQAnswers] = useState<Record<number,string>>({})
  const [finalPlan, setFinalPlan] = useState<any>(null)
  const [buildTime, setBuildTime] = useState('—')
  const [tokens, setTokens] = useState('—')
  const [jarvisMsg, setJarvisMsg] = useState('')
  const [userMsg, setUserMsg] = useState('')
  const [chatLog, setChatLog] = useState<{html:string,isUser:boolean}[]>([])
  const [logs, setLogs] = useState<{t:string,msg:string,type:string}[]>([
    {t:'00:00:00',msg:'JARVISFACTORY v1.0 — Plan → Question → Approve → Build',type:'info'},
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
      const { data: j } = await supabase.from('jarvis_profiles').select('*').eq('user_id', user.id).single()
      setJarvis(j)
      setJarvisMsg(`Good day. I'm <strong style="color:#00e5b0">${j?.jarvis_name||'JARVIS'}</strong> — your personal AI developer.<br><br>I specialise in <strong>${j?.industry||'your industry'}</strong> apps. Before writing any code I will ask questions, present a full plan with cost and time estimate, then build only after you approve.<br><br>What do you want to build today?`)
    }
    load()
  }, [])

  useEffect(() => {
    if(chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [chatLog, phase, questions, finalPlan, jarvisMsg])

  useEffect(() => {
    if(termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight
  }, [logs])

  function ts() { const n=new Date(); return[n.getHours(),n.getMinutes(),n.getSeconds()].map(x=>String(x).padStart(2,'0')).join(':') }
  function addLog(msg:string,type='info') { setLogs(l=>[...l,{t:ts(),msg,type}]) }
  function addChat(html:string,isUser=false) { setChatLog(l=>[...l,{html,isUser}]) }

  function getKey() { return localStorage.getItem('jf_anthropic_key')||'' }

  async function callClaude(sys:string,msg:string,maxTok=10000) {
    let key = getKey()
    if(!key) {
      key = window.prompt('Enter your Anthropic API key (sk-ant-...):')||''
      if(key) localStorage.setItem('jf_anthropic_key',key)
      else throw new Error('No API key provided.')
    }
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
    addChat(prompt, true)
    setPhase('planning')
    setQuestions([])
    setQAnswers({})
    setFinalPlan(null)
    addLog(`NEW PROJECT: ${prompt.substring(0,60)}...`,'build')
    addLog('Analysing requirements...','info')
    try {
      const sys = `You are ${jarvis?.jarvis_name||'JARVIS'}, an AI developer specialising in ${jarvis?.industry||'general'} apps.
Generate 3 clarifying questions with options. Return ONLY valid JSON, no markdown:
{"questions":[{"q":"Question?","options":["A","B","C"]}],"app_name":"Name","summary":"One sentence"}`
      const raw = await callClaude(sys, `Client request: ${prompt}`, 1500)
      let data; try{data=JSON.parse(raw.replace(/```json|```/g,'').trim())}catch(e){throw new Error('Parse failed. Try again.')}
      setPendingPlan(data)
      setQuestions(data.questions||[])
      setPhase('questioning')
      addLog('Questions ready. Waiting for answers...','info')
    } catch(err:any) {
      addLog('ERROR: '+err.message,'err')
      addChat('❌ Error: '+err.message)
      setPhase('idle')
    }
  }

  function selectAnswer(qIndex:number, val:string) {
    setQAnswers(prev=>({...prev,[qIndex]:val}))
  }

  async function submitAnswers() {
    const answers = questions.map((q:any,i:number)=>`${q.q}: ${qAnswers[i]||q.options[0]}`).join('\n')
    setPhase('approving')
    addLog('Generating final build plan...','info')
    try {
      const sys = `You are JARVIS. Generate a final build plan as JSON (no markdown):
{"app_name":"Name","summary":"Description","features":["f1","f2","f3","f4","f5"],"tech":"HTML+CSS+JS","est_time":"60-120 seconds","est_tokens":"5000-8000","complexity":"Medium","note":"approach"}`
      const raw = await callClaude(sys,`Request: ${prompt}\nAnswers:\n${answers}`,1500)
      let plan; try{plan=JSON.parse(raw.replace(/```json|```/g,'').trim())}catch(e){plan={app_name:'Your App',summary:prompt,features:['Core features'],tech:'HTML+CSS+JS',est_time:'60-120s',est_tokens:'5000-8000',complexity:'Medium',note:'Building as requested.'}}
      setFinalPlan(plan)
      addLog('Plan ready. Awaiting your approval...','info')
    } catch(err:any) {
      addLog('ERROR: '+err.message,'err')
      setPhase('idle')
    }
  }

  async function approveBuild() {
    if(!finalPlan) return
    setPhase('building')
    addChat('✅ Plan approved! Building now...')
    addLog('Code generation started...','build')
    startRef.current = Date.now()
    timerRef.current = setInterval(()=>{setBuildTime(((Date.now()-startRef.current)/1000).toFixed(1)+'s')},100)
    try {
      const answers = questions.map((q:any,i:number)=>`${q.q}: ${qAnswers[i]||q.options[0]}`).join(', ')
      const sys = `You are ${jarvis?.jarvis_name||'JARVIS'}. Build a complete, beautiful, fully-functional single-file HTML app.
RULES:
- Return ONLY raw HTML. No markdown, no backticks, no explanation.
- All CSS and JS inline in one file.
- Beautiful professional UI, smooth animations.
- FULLY FUNCTIONAL — all buttons work, data saves to localStorage.
- Mobile responsive. Use Google Fonts.
- Malaysian context: RM currency, DuitNow where relevant.
- Islamic elements where appropriate.
- Real functionality — not placeholders.
- Looks like a real product someone would pay for.
- IF APP HAS LOGIN: hardcode demo credentials email=demo@example.com password=demo123. Show hint on login page: Demo Login: demo@example.com / demo123.
- PRE-POPULATE with realistic dummy data so app looks alive immediately.
- EVERY button must work — simulate backend with localStorage, show success messages.
- ALL navigation, tabs, menu items must show a real screen.`
      const html = await callClaude(sys,`Build: ${prompt}\nPreferences: ${answers}`)
      clearInterval(timerRef.current)
      const code = html.replace(/^```html\n?/,'').replace(/\n?```$/,'').trim()
      const tok = Math.round(code.length/4)
      setBuiltCode(code)
      setTokens(tok.toLocaleString())
      setPhase('done')
      addLog(`DONE. ~${tok} tokens, ${((Date.now()-startRef.current)/1000).toFixed(1)}s`,'ok')
      addChat(`🚀 <strong>Build complete!</strong> <strong style="color:#00e5b0">${tok.toLocaleString()} tokens</strong> · <strong style="color:#ffd166">${((Date.now()-startRef.current)/1000).toFixed(1)}s</strong><br><br>Switch to <strong>⬡ Preview</strong> to test it.`)
      if(user) {
        await supabase.from('apps').insert({
          user_id:user.id, name:finalPlan.app_name||'My App',
          description:finalPlan.summary||prompt.substring(0,200),
          html_code:code, tokens_used:tok,
          build_time:((Date.now()-startRef.current)/1000).toFixed(1),
          created_at:new Date().toISOString()
        })
      }
      setTimeout(()=>setActiveTab('preview'),800)
    } catch(err:any) {
      clearInterval(timerRef.current)
      addLog('ERROR: '+err.message,'err')
      addChat('❌ Build failed: '+err.message)
      setPhase('idle')
    }
  }

  function rejectPlan() {
    setFinalPlan(null)
    setPhase('idle')
    addChat("No problem — update your description and let's try again.")
  }

  function download() {
    if(!builtCode) return
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([builtCode],{type:'text/html'}))
    a.download=(finalPlan?.app_name||'jarvis-app').replace(/\s+/g,'-').toLowerCase()+'.html'; a.click()
    addLog('App downloaded.','ok')
  }

  const allAnswered = questions.length > 0 && questions.every((_:any,i:number)=>qAnswers[i])

  const c: Record<string,React.CSSProperties> = {
    page:{height:'100vh',display:'flex',flexDirection:'column',background:'#05050d',fontFamily:"'DM Sans',sans-serif",overflow:'hidden'},
    nav:{height:50,background:'#0a0a18',borderBottom:'1px solid #1a1a35',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 18px',flexShrink:0},
    logo:{fontFamily:"'Space Mono',monospace",fontSize:14,color:'#00e5b0',fontWeight:700},
    main:{display:'flex',flex:1,overflow:'hidden'},
    left:{width:260,background:'#0a0a18',borderRight:'1px solid #1a1a35',display:'flex',flexDirection:'column',flexShrink:0},
    pTitle:{padding:'10px 14px',fontSize:10,fontFamily:"'Space Mono',monospace",color:'#5a5a78',textTransform:'uppercase' as const,letterSpacing:1.5,borderBottom:'1px solid #1a1a35',display:'flex',justifyContent:'space-between'},
    phaseTag:{fontSize:9,padding:'2px 7px',borderRadius:10,fontFamily:"'Space Mono',monospace",background:'rgba(90,90,120,0.3)',color:'#8888aa'},
    promptArea:{flex:1,padding:12,overflowY:'auto' as const,display:'flex',flexDirection:'column' as const,gap:10},
    textarea:{width:'100%',background:'#161625',border:'1px solid #2e2e48',borderRadius:8,color:'#f0f0fa',fontFamily:"'DM Sans',sans-serif",fontSize:13,padding:10,resize:'none' as const,height:100,lineHeight:1.6,outline:'none',boxSizing:'border-box' as const},
    launchBtn:{margin:'0 12px 12px',padding:11,background:'#00e5b0',color:'#000',border:'none',borderRadius:8,fontFamily:"'Space Mono',monospace",fontSize:12,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6},
    center:{flex:1,display:'flex',flexDirection:'column' as const,overflow:'hidden'},
    tabs:{display:'flex',background:'#0a0a18',borderBottom:'1px solid #1a1a35',padding:'0 14px',flexShrink:0},
    tab:{padding:'9px 14px',fontSize:11,fontFamily:"'Space Mono',monospace",color:'#5a5a78',cursor:'pointer',borderBottom:'2px solid transparent'},
    term:{height:150,background:'#04040c',borderTop:'1px solid #1a1a35',flexShrink:0,display:'flex',flexDirection:'column' as const},
    termH:{padding:'6px 14px',borderBottom:'1px solid #1a1a35',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0},
    termB:{flex:1,overflow:'auto',padding:'6px 14px',fontFamily:"'Space Mono',monospace",fontSize:10.5,lineHeight:1.9},
    right:{width:320,background:'#0a0a18',borderLeft:'1px solid #1a1a35',display:'flex',flexDirection:'column' as const,flexShrink:0},
    chatH:{padding:'10px 14px',borderBottom:'1px solid #1a1a35',display:'flex',justifyContent:'space-between',alignItems:'center'},
    chatBody:{flex:1,overflowY:'auto' as const,padding:12,display:'flex',flexDirection:'column' as const,gap:10},
    bubble:{fontSize:12,lineHeight:1.7,color:'#f0f0fa',background:'#161625',padding:'9px 11px',borderRadius:8,border:'1px solid #252538',wordBreak:'break-word' as const},
  }

  const phaseLabel = {idle:'IDLE',planning:'PLANNING',questioning:'Q&A',approving:'REVIEW',building:'BUILDING',done:'DONE'}[phase]

  return (
    <div style={c.page}>
      <style>{`@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}} .qopt:hover{border-color:#8b7cf8!important;color:#8b7cf8!important;}`}</style>
      <nav style={c.nav}>
        <div style={c.logo}>JARVISFACTORY.AI</div>
        <div style={{display:'flex',gap:12,alignItems:'center'}}>
          <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:'#8888aa'}}>{jarvis?.jarvis_name||'JARVIS'}</span>
          <button style={{padding:'5px 12px',background:'transparent',border:'1px solid #1a1a35',borderRadius:6,color:'#8888aa',fontFamily:"'Space Mono',monospace",fontSize:11,cursor:'pointer'}} onClick={()=>router.push('/dashboard')}>← Dashboard</button>
        </div>
      </nav>
      <div style={c.main}>
        {/* LEFT */}
        <div style={c.left}>
          <div style={c.pTitle}><span>Describe App</span><span style={c.phaseTag}>{phaseLabel}</span></div>
          <div style={c.promptArea}>
            <textarea style={c.textarea} placeholder="Describe your app in plain language..." value={prompt} onChange={e=>setPrompt(e.target.value)}/>
            <div style={{fontSize:10,color:'#5a5a78',fontFamily:"'Space Mono',monospace",textTransform:'uppercase' as const,letterSpacing:1}}>Quick starts</div>
            {['DRE Coffee loyalty app with points & referral','Brainy Bunch student progress tracker','Muslim ibadah daily tracker with streaks','Staff birthday gifts manager'].map(p=>(
              <button key={p} onClick={()=>setPrompt(p)} style={{padding:'8px 10px',background:'#161625',border:'1px solid #1a1a35',borderRadius:6,color:'#8888aa',fontSize:11,textAlign:'left' as const,cursor:'pointer',lineHeight:1.4}}>{p}</button>
            ))}
            <div style={{background:'#0d0d1e',border:'1px solid #1a1a35',borderRadius:8,padding:12}}>
              <div style={{fontSize:9,fontFamily:"'Space Mono',monospace",color:'#5a5a78',textTransform:'uppercase' as const,letterSpacing:1,marginBottom:8}}>Metrics</div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#8888aa',marginBottom:4}}><span>Tokens</span><span style={{color:'#f0f0fa'}}>{tokens}</span></div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#8888aa'}}><span>Build Time</span><span style={{color:'#f0f0fa'}}>{buildTime}</span></div>
            </div>
          </div>
          <button style={{...c.launchBtn,opacity:phase!=='idle'&&phase!=='done'?0.5:1}} onClick={launch} disabled={phase!=='idle'&&phase!=='done'}>
            <span>⚡</span>{phase==='done'?'Rebuild':'Launch '+(jarvis?.jarvis_name||'JARVIS')}
          </button>
          {builtCode && <button onClick={download} style={{margin:'-6px 12px 12px',padding:9,background:'#161625',color:'#8888aa',border:'1px solid #1a1a35',borderRadius:8,fontFamily:"'Space Mono',monospace",fontSize:11,cursor:'pointer'}}>⬇ Download HTML</button>}
        </div>

        {/* CENTER */}
        <div style={c.center}>
          <div style={c.tabs}>
            <div style={{...c.tab,color:activeTab==='code'?'#00e5b0':'#5a5a78',borderBottomColor:activeTab==='code'?'#00e5b0':'transparent'}} onClick={()=>setActiveTab('code')}>index.html</div>
            <div style={{...c.tab,color:activeTab==='preview'?'#00e5b0':'#5a5a78',borderBottomColor:activeTab==='preview'?'#00e5b0':'transparent'}} onClick={()=>setActiveTab('preview')}>⬡ Preview</div>
          </div>
          <div style={{flex:1,overflow:'auto',display:activeTab==='code'?'flex':'none',flexDirection:'column' as const,background:'#05050d',padding:16}}>
            {!builtCode ? (
              <div style={{display:'flex',flexDirection:'column' as const,alignItems:'center',justifyContent:'center',height:'100%',gap:14,color:'#5a5a78'}}>
                <div style={{fontSize:40,opacity:0.2}}>⬡</div>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:13}}>// Waiting for instructions</div>
                <div style={{fontSize:12,textAlign:'center' as const,maxWidth:280,lineHeight:1.7}}>{jarvis?.jarvis_name||'JARVIS'} will plan first, ask questions, show build plan — then build only after you approve.</div>
              </div>
            ) : <pre style={{fontFamily:"'Space Mono',monospace",fontSize:11.5,lineHeight:1.8,color:'#7ec8a0',whiteSpace:'pre-wrap' as const,wordBreak:'break-all' as const}}>{builtCode}</pre>}
          </div>
          <div style={{flex:1,overflow:'hidden',display:activeTab==='preview'?'flex':'none',flexDirection:'column' as const,background:'#fff'}}>
            {!builtCode ? (
              <div style={{display:'flex',flexDirection:'column' as const,alignItems:'center',justifyContent:'center',height:'100%',background:'#0a0a18',gap:12,color:'#5a5a78'}}>
                <div style={{fontSize:40,opacity:0.2}}>◻</div>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:13}}>Preview loads after build</div>
              </div>
            ) : <iframe style={{flex:1,border:'none',width:'100%',height:'100%'}} srcDoc={builtCode}/>}
          </div>
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
                <div key={i}><span style={{color:'#5a5a78',marginRight:10}}>{l.t}</span><span style={{color:{info:'#00e5b0',ok:'#06d6a0',err:'#ff4d6d',warn:'#ffd166',build:'#8b7cf8'}[l.type]||'#00e5b0'}}>{l.msg}</span></div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: JARVIS CHAT */}
        <div style={c.right}>
          <div style={c.chatH}>
            <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:'#8888aa'}}>🤖 <span style={{color:'#00e5b0'}}>{jarvis?.jarvis_name||'JARVIS'}</span></span>
            <span style={{fontSize:10,color:'#5a5a78',fontFamily:"'Space Mono',monospace"}}>{phase}</span>
          </div>
          <div style={c.chatBody} ref={chatRef}>

            {/* Initial JARVIS greeting */}
            {jarvisMsg && (
              <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                <div style={{width:24,height:24,borderRadius:6,background:'rgba(0,229,176,0.12)',color:'#00e5b0',border:'1px solid rgba(0,229,176,0.25)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,flexShrink:0}}>J</div>
                <div><div style={{fontSize:9,fontFamily:"'Space Mono',monospace",color:'#5a5a78',marginBottom:3}}>JARVIS · Now</div><div style={{...c.bubble,borderColor:'rgba(0,229,176,0.1)'}} dangerouslySetInnerHTML={{__html:jarvisMsg}}/></div>
              </div>
            )}

            {/* Chat history */}
            {chatLog.map((msg,i)=>(
              <div key={i} style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                <div style={{width:24,height:24,borderRadius:6,background:msg.isUser?'rgba(139,124,248,0.12)':'rgba(0,229,176,0.12)',color:msg.isUser?'#8b7cf8':'#00e5b0',border:`1px solid ${msg.isUser?'rgba(139,124,248,0.25)':'rgba(0,229,176,0.25)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,flexShrink:0}}>{msg.isUser?'U':'J'}</div>
                <div><div style={{fontSize:9,fontFamily:"'Space Mono',monospace",color:'#5a5a78',marginBottom:3}}>{msg.isUser?'You':'JARVIS'} · Now</div><div style={{...c.bubble,borderColor:msg.isUser?'rgba(139,124,248,0.15)':'rgba(0,229,176,0.1)'}} dangerouslySetInnerHTML={{__html:msg.html}}/></div>
              </div>
            ))}

            {/* QUESTIONS — Pure React, no dangerouslySetInnerHTML */}
            {phase==='questioning' && questions.length>0 && (
              <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                <div style={{width:24,height:24,borderRadius:6,background:'rgba(0,229,176,0.12)',color:'#00e5b0',border:'1px solid rgba(0,229,176,0.25)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,flexShrink:0}}>J</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:9,fontFamily:"'Space Mono',monospace",color:'#5a5a78',marginBottom:3}}>JARVIS · Now</div>
                  <div style={{background:'#1e1e30',border:'1px solid rgba(255,209,102,0.2)',borderRadius:10,padding:14}}>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:'#ffd166',marginBottom:12,textTransform:'uppercase' as const,letterSpacing:1}}>🔍 Quick Questions</div>
                    {questions.map((q:any,i:number)=>(
                      <div key={i} style={{marginBottom:14}}>
                        <div style={{fontSize:12,color:'#f0f0fa',marginBottom:8,lineHeight:1.5}}>{i+1}. {q.q}</div>
                        <div style={{display:'flex',flexWrap:'wrap' as const,gap:6}}>
                          {q.options.map((opt:string)=>(
                            <button
                              key={opt}
                              onClick={()=>selectAnswer(i,opt)}
                              style={{
                                padding:'5px 11px',
                                background: qAnswers[i]===opt ? 'rgba(139,124,248,0.2)' : '#161625',
                                border: qAnswers[i]===opt ? '1px solid #8b7cf8' : '1px solid #2e2e48',
                                borderRadius:20,
                                fontSize:11,
                                color: qAnswers[i]===opt ? '#8b7cf8' : '#8888aa',
                                cursor:'pointer',
                                fontFamily:"'Space Mono',monospace",
                                transition:'all 0.15s'
                              }}
                            >{opt}</button>
                          ))}
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={submitAnswers}
                      disabled={!allAnswered}
                      style={{width:'100%',marginTop:8,padding:9,background: allAnswered ? '#8b7cf8' : '#2e2e48',color: allAnswered ? '#fff' : '#5a5a78',border:'none',borderRadius:7,fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,cursor: allAnswered ? 'pointer' : 'not-allowed'}}
                    >
                      {allAnswered ? 'Submit & See Build Plan →' : `Answer all questions (${Object.keys(qAnswers).length}/${questions.length})`}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* PLAN CARD — Pure React */}
            {phase==='approving' && finalPlan && (
              <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                <div style={{width:24,height:24,borderRadius:6,background:'rgba(0,229,176,0.12)',color:'#00e5b0',border:'1px solid rgba(0,229,176,0.25)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,flexShrink:0}}>J</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:9,fontFamily:"'Space Mono',monospace",color:'#5a5a78',marginBottom:3}}>JARVIS · Now</div>
                  <div style={{background:'#1e1e30',border:'1px solid #2e2e48',borderRadius:10,padding:14}}>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:'#00e5b0',marginBottom:10,textTransform:'uppercase' as const,letterSpacing:1}}>📋 Build Plan — {finalPlan.app_name}</div>
                    {[['Complexity',finalPlan.complexity],['Est. Time',finalPlan.est_time],['Est. Tokens',finalPlan.est_tokens],['Tech',finalPlan.tech]].map(([k,v])=>(
                      <div key={k} style={{display:'flex',justifyContent:'space-between',marginBottom:5,fontSize:11,color:'#8888aa'}}><span>{k}</span><strong style={{color:'#f0f0fa'}}>{v}</strong></div>
                    ))}
                    <div style={{height:1,background:'#252538',margin:'10px 0'}}/>
                    <div style={{fontSize:11,color:'#8888aa',marginBottom:8}}>{finalPlan.summary}</div>
                    {finalPlan.features?.map((f:string,i:number)=>(
                      <div key={i} style={{fontSize:11,color:'#8888aa',marginBottom:4,display:'flex',gap:6}}><span style={{color:'#00e5b0'}}>✓</span>{f}</div>
                    ))}
                    <div style={{height:1,background:'#252538',margin:'10px 0'}}/>
                    <div style={{fontSize:10,color:'#5a5a78',fontFamily:"'Space Mono',monospace",marginBottom:12}}>{finalPlan.note}</div>
                    <div style={{display:'flex',gap:8}}>
                      <button onClick={rejectPlan} style={{flex:1,padding:9,background:'transparent',color:'#8888aa',border:'1px solid #2e2e48',borderRadius:7,fontFamily:"'Space Mono',monospace",fontSize:11,cursor:'pointer'}}>✕ Revise</button>
                      <button onClick={approveBuild} style={{flex:1,padding:9,background:'#00e5b0',color:'#000',border:'none',borderRadius:7,fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,cursor:'pointer'}}>✓ Approve & Build</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* BUILDING indicator */}
            {phase==='building' && (
              <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                <div style={{width:24,height:24,borderRadius:6,background:'rgba(0,229,176,0.12)',color:'#00e5b0',border:'1px solid rgba(0,229,176,0.25)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,flexShrink:0}}>J</div>
                <div style={{...c.bubble,borderColor:'rgba(0,229,176,0.1)'}}>
                  <div style={{display:'flex',gap:4,alignItems:'center'}}>
                    <span style={{width:6,height:6,borderRadius:'50%',background:'#00e5b0',display:'inline-block',animation:'bob 1s infinite'}}/>
                    <span style={{width:6,height:6,borderRadius:'50%',background:'#8b7cf8',display:'inline-block',animation:'bob 1s 0.15s infinite'}}/>
                    <span style={{width:6,height:6,borderRadius:'50%',background:'#ff6b9d',display:'inline-block',animation:'bob 1s 0.3s infinite'}}/>
                    <span style={{marginLeft:8,fontSize:12,color:'#8888aa'}}>Building your app... {buildTime}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
