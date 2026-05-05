'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function Builder() {
  const [user, setUser] = useState<any>(null)
  const [jarvis, setJarvis] = useState<any>(null)
  const [prompt, setPrompt] = useState('')
  const [phase, setPhase] = useState<'idle'|'planning'|'questioning'|'approving'|'building'|'iterating'|'done'>('idle')
  const [builtCode, setBuiltCode] = useState('')
  const [activeTab, setActiveTab] = useState<'code'|'preview'>('code')
  const [pendingPlan, setPendingPlan] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [qAnswers, setQAnswers] = useState<Record<number,string>>({})
  const [finalPlan, setFinalPlan] = useState<any>(null)
  const [buildTime, setBuildTime] = useState('—')
  const [tokens, setTokens] = useState('—')
  const [jarvisMsg, setJarvisMsg] = useState('')
  const [chatLog, setChatLog] = useState<{html:string,isUser:boolean}[]>([])
  const [logs, setLogs] = useState<{t:string,msg:string,type:string}[]>([
    {t:'00:00:00',msg:'JARVISFACTORY v2.0 — Sprint 1+2: Feedback chat + file attachments',type:'info'},
    {t:'00:00:00',msg:'Claude Sonnet 4.6 backend ready.',type:'ok'}
  ])
  // Sprint 1: feedback chat
  const [feedbackInput, setFeedbackInput] = useState('')
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false)
  // Feedback flow states
  const [feedbackPhase, setFeedbackPhase] = useState<'idle'|'diagnosing'|'planning'|'confirmed'|'fixing'>('idle')
  const [diagnosisResult, setDiagnosisResult] = useState<any>(null)
  const [pendingFeedback, setPendingFeedback] = useState('')
  // QA state
  const [qaReport, setQaReport] = useState<any>(null)
  const [isRunningQA, setIsRunningQA] = useState(false)
  // Sprint 2: file attachments
  const [attachments, setAttachments] = useState<{name:string,type:string,data:string,preview?:string}[]>([])
  const [brandColour, setBrandColour] = useState('#00e5b0')
  const [brandName, setBrandName] = useState('')
  const [showBrandPanel, setShowBrandPanel] = useState(false)

  const timerRef = useRef<any>(null)
  const startRef = useRef<number>(0)
  const chatRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      setUser(user)
      const { data: j } = await supabase.from('jarvis_profiles').select('*').eq('user_id', user.id).single()
      setJarvis(j)
      setBrandName(j?.full_name || '')
      setJarvisMsg(`Good day. I'm <strong style="color:#00e5b0">${j?.jarvis_name||'JARVIS'}</strong> — your personal AI developer.<br><br>
I specialise in <strong>${j?.industry||'your industry'}</strong> apps.<br><br>
<strong style="color:#ffd166">New in v2.0:</strong><br>
📎 Attach images, PDFs, or docs as design references<br>
💬 Chat with me after I build to improve anything<br>
🎨 Set your brand colour for consistent design<br><br>
Tell me what you want to build, or attach a reference first.`)
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

  // ── SPRINT 2: File handler ──
  async function handleFileAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files||[])
    for(const file of files) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const result = ev.target?.result as string
        const base64 = result.split(',')[1]
        const isImage = file.type.startsWith('image/')
        setAttachments(prev => [...prev, {
          name: file.name,
          type: file.type,
          data: base64,
          preview: isImage ? result : undefined
        }])
        addLog(`Attached: ${file.name}`, 'ok')
      }
      reader.readAsDataURL(file)
    }
    e.target.value = ''
  }

  function removeAttachment(idx: number) {
    setAttachments(prev => prev.filter((_,i) => i !== idx))
  }

  // ── Build messages with attachments ──
  function buildMessages(userText: string) {
    const imageAttachments = attachments.filter(a => a.type.startsWith('image/'))
    if(imageAttachments.length === 0) {
      return [{ role: 'user', content: userText }]
    }
    const content: any[] = imageAttachments.map(img => ({
      type: 'image',
      source: { type: 'base64', media_type: img.type, data: img.data }
    }))
    content.push({ type: 'text', text: userText })
    return [{ role: 'user', content }]
  }

  async function callClaude(sys: string, msg: string, maxTok = 10000, useAttachments = false) {
    let key = getKey()
    if(!key) {
      key = window.prompt('Enter your Anthropic API key (sk-ant-...):')||''
      if(key) localStorage.setItem('jf_anthropic_key', key)
      else throw new Error('No API key provided.')
    }
    const messages = useAttachments ? buildMessages(msg) : [{ role: 'user', content: msg }]
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTok, system: sys, messages })
    })
    const d = await r.json()
    if(!r.ok) throw new Error(d.error?.message || `API error ${r.status}`)
    return d.content[0].text
  }

  // ── SPRINT 1+3: Smart Feedback + QA Agent ──

  // STEP 1: Diagnose — JARVIS reads code and explains what's wrong
  async function sendFeedback() {
    const msg = feedbackInput.trim()
    if(!msg || !builtCode) return
    setFeedbackInput('')
    setPendingFeedback(msg)
    setIsFeedbackLoading(true)
    setFeedbackPhase('diagnosing')
    addChat(msg, true)
    addLog(`Feedback: "${msg.substring(0,50)}..." — Diagnosing first...`, 'build')

    setChatLog(l => [...l, { html: '<div style="display:flex;gap:4px;align-items:center"><span style="width:6px;height:6px;border-radius:50%;background:#ffd166;display:inline-block;animation:bob 1s infinite"></span><span style="margin-left:8px;font-size:12px;color:#8888aa">JARVIS is diagnosing the issue...</span></div>', isUser: false }])

    try {
      const sys = `You are ${jarvis?.jarvis_name||'JARVIS'}, a senior developer doing code review and diagnosis.

Analyse the provided HTML app code and the user's feedback/issue. Your job is to:
1. Identify exactly what is causing the issue
2. Explain it in simple plain language
3. Propose a clear fix plan
4. Ask if there are any other changes to batch together

Return ONLY valid JSON (no markdown):
{
  "diagnosis": "Plain English explanation of what is causing the issue (2-3 sentences max)",
  "root_cause": "The specific technical root cause (1 sentence, simple)",
  "fix_plan": ["Fix 1: description", "Fix 2: description", "Fix 3: description"],
  "estimated_impact": "Low / Medium / High",
  "question": "Is there anything else you want me to fix or improve at the same time?"
}`

      const codeSnippet = builtCode.length > 8000 ? builtCode.substring(0, 8000) + '
...(truncated)' : builtCode
      const raw = await callClaude(sys, `App code:
${codeSnippet}

User feedback/issue: ${msg}`, 2000)
      let diagnosis
      try { diagnosis = JSON.parse(raw.replace(/\`\`\`json|\`\`\`/g,'').trim()) }
      catch(e) { diagnosis = { diagnosis: "I found the issue and have a fix ready.", root_cause: "Logic error in the app code.", fix_plan: ["Fix the reported issue completely"], estimated_impact: "Medium", question: "Anything else you'd like me to improve?" } }

      setDiagnosisResult(diagnosis)
      setFeedbackPhase('planning')
      addLog('Diagnosis complete. Presenting fix plan...', 'ok')

      // Show diagnosis card in chat
      setChatLog(l => l.map((m,i) => i === l.length-1 ? { ...m, html: `
        <div style="background:#1e1e30;border:1px solid rgba(255,209,102,0.25);border-radius:10px;padding:14px">
          <div style="font-family:'Space Mono',monospace;font-size:10px;color:#ffd166;margin-bottom:10px;text-transform:uppercase;letter-spacing:1px">🔍 Diagnosis</div>
          <div style="font-size:12px;color:#f0f0fa;margin-bottom:8px;line-height:1.6">${diagnosis.diagnosis}</div>
          <div style="font-size:11px;color:#ff6b9d;margin-bottom:10px"><strong>Root cause:</strong> ${diagnosis.root_cause}</div>
          <div style="font-family:'Space Mono',monospace;font-size:10px;color:#00e5b0;margin-bottom:6px">FIX PLAN:</div>
          ${diagnosis.fix_plan.map((f:string) => `<div style="font-size:11px;color:#8888aa;margin-bottom:3px;display:flex;gap:6px"><span style="color:#00e5b0">→</span>${f}</div>`).join('')}
          <div style="height:1px;background:#252538;margin:10px 0"></div>
          <div style="font-size:12px;color:#ffd166;margin-bottom:10px">${diagnosis.question}</div>
          <div style="display:flex;gap:6px">
            <button onclick="window.jfConfirmFix('')" style="flex:1;padding:8px;background:#00e5b0;color:#000;border:none;border-radius:7px;font-family:'Space Mono',monospace;font-size:10px;font-weight:700;cursor:pointer">✓ Apply Fix</button>
            <button onclick="window.jfRejectFix()" style="flex:1;padding:8px;background:transparent;color:#8888aa;border:1px solid #2e2e48;border-radius:7px;font-family:'Space Mono',monospace;font-size:10px;cursor:pointer">✕ Cancel</button>
          </div>
          <input id="extraChangesInput" placeholder="Optional: add more changes to batch..." style="width:100%;margin-top:8px;background:#161625;border:1px solid #2e2e48;border-radius:6px;color:#f0f0fa;font-size:11px;padding:7px;box-sizing:border-box;outline:none"/>
        </div>` } : m))

      // Expose global handlers
      ;(window as any).jfConfirmFix = (extra: string) => {
        const extraInput = document.getElementById('extraChangesInput') as HTMLInputElement
        const extraChanges = extraInput?.value?.trim() || extra || ''
        applyFix(extraChanges)
      }
      ;(window as any).jfRejectFix = () => {
        setFeedbackPhase('idle')
        setIsFeedbackLoading(false)
        setPendingFeedback('')
        addChat('No problem — let me know whenever you want to make changes.')
      }

    } catch(err: any) {
      addLog('ERROR: '+err.message, 'err')
      addChat('❌ Diagnosis failed: '+err.message)
      setFeedbackPhase('idle')
      setIsFeedbackLoading(false)
    }
  }

  // STEP 2: Apply the fix after user confirms
  async function applyFix(extraChanges: string) {
    if(!pendingFeedback || !builtCode) return
    setFeedbackPhase('fixing')
    setPhase('iterating')
    addLog('Fix confirmed. Applying changes...', 'build')

    setChatLog(l => [...l, { html: '<div style="display:flex;gap:4px;align-items:center"><span style="width:6px;height:6px;border-radius:50%;background:#00e5b0;display:inline-block;animation:bob 1s infinite"></span><span style="width:6px;height:6px;border-radius:50%;background:#8b7cf8;display:inline-block;animation:bob 1s 0.15s infinite"></span><span style="width:6px;height:6px;border-radius:50%;background:#ff6b9d;display:inline-block;animation:bob 1s 0.3s infinite"></span><span style="margin-left:8px;font-size:12px;color:#8888aa">Applying fixes and improvements...</span></div>', isUser: false }])

    try {
      const brandContext = brandName ? `Brand: "${brandName}", colour: ${brandColour}.` : ''
      const fixPlanText = diagnosisResult?.fix_plan?.join('\n') || ''
      const allChanges = extraChanges ? `${pendingFeedback}\nAdditional: ${extraChanges}` : pendingFeedback

      const sys = `You are ${jarvis?.jarvis_name||'JARVIS'}, an expert developer fixing and improving a web app.

You have diagnosed the issue. Now apply ALL the fixes.

CRITICAL RULES:
- Return ONLY the complete fixed HTML file. No markdown, no backticks, no explanation.
- Fix the diagnosed root cause completely and permanently.
- Keep ALL other functionality intact.
- Demo login MUST work: hardcode email=demo@example.com password=demo123 in the JavaScript login function. Test this logic carefully.
- Pre-populate all lists/tables with realistic dummy data.
- Every button, nav item, tab must work.
- ${brandContext}
- Make it look beautiful and professional.

Diagnosed fix plan:
${fixPlanText}`

      const improved = await callClaude(sys, `Current app code:
${builtCode}

Issue to fix: ${allChanges}`, 12000, attachments.some(a=>a.type.startsWith('image/')))
      const code = improved.replace(/^\`\`\`html\n?/, '').replace(/\n?\`\`\`$/, '').trim()
      const tok = Math.round(code.length / 4)
      setBuiltCode(code)
      setTokens(tok.toLocaleString())
      setPhase('done')
      setFeedbackPhase('idle')
      setIsFeedbackLoading(false)
      setPendingFeedback('')

      const frame = document.getElementById('previewFrame') as HTMLIFrameElement
      if(frame) frame.srcdoc = code
      const codeEl = document.getElementById('codeDisplay')
      if(codeEl) codeEl.textContent = code

      addLog(`Fix applied. ~${tok} tokens.`, 'ok')

      // Auto-run QA after fix
      addLog('Running QA agent on fixed app...', 'build')
      runQA(code)

      setChatLog(l => l.map((m,i) => i === l.length-1 ? { ...m,
        html: `✅ <strong>Fix applied!</strong> Running QA check now...<br><span style="color:#8888aa;font-size:11px">~${tok.toLocaleString()} tokens used</span>`
      } : m))

      if(user) {
        await supabase.from('apps').insert({
          user_id: user.id,
          name: (finalPlan?.app_name || 'My App') + ' (fixed)',
          description: `Fixed: ${pendingFeedback.substring(0,100)}`,
          html_code: code, tokens_used: tok, build_time: '0',
          created_at: new Date().toISOString()
        })
      }
      setActiveTab('preview')

    } catch(err: any) {
      addLog('ERROR: '+err.message, 'err')
      addChat('❌ Fix failed: '+err.message)
      setPhase('done')
      setFeedbackPhase('idle')
      setIsFeedbackLoading(false)
    }
  }

  // ── SPRINT 3: QA Agent ──
  async function runQA(codeToTest?: string) {
    const code = codeToTest || builtCode
    if(!code) return
    setIsRunningQA(true)
    addLog('QA Agent running 15-point checklist...', 'build')

    try {
      const sys = `You are a QA Engineer agent. Analyse this HTML/JS app code and test it against a 15-point quality checklist.

Return ONLY valid JSON (no markdown):
{
  "score": 0-100,
  "passed": ["test that passed", ...],
  "failed": ["test that failed with reason", ...],
  "critical": ["critical issue that must be fixed", ...],
  "summary": "One sentence overall verdict",
  "certified": true/false
}

The 15 checks are:
1. Demo login works (email=demo@example.com password=demo123 hardcoded and matches)
2. All navigation items show a screen (no dead links)
3. All buttons have click handlers
4. Forms have validation
5. Data is pre-populated (no empty lists/tables on load)
6. localStorage used for data persistence
7. Mobile responsive (has viewport meta, flexible layout)
8. Google Fonts loaded
9. No JavaScript errors visible in code
10. All tabs/panels show content
11. Success messages on form submissions
12. Header/navbar present and functional
13. Consistent colour scheme throughout
14. No placeholder text (lorem ipsum etc)
15. App looks like a real product (not a demo skeleton)`

      const snippet = code.length > 10000 ? code.substring(0, 10000) + '
...(truncated)' : code
      const raw = await callClaude(sys, `Analyse this app:
${snippet}`, 3000)
      let report
      try { report = JSON.parse(raw.replace(/\`\`\`json|\`\`\`/g,'').trim()) }
      catch(e) { report = { score: 70, passed: ['Basic structure present'], failed: [], critical: [], summary: 'App built successfully with minor issues.', certified: false } }

      setQaReport(report)
      setIsRunningQA(false)
      addLog(`QA complete. Score: ${report.score}/100. ${report.certified?'✅ CERTIFIED':'⚠️ Issues found'}`, report.certified?'ok':'warn')

      // Show QA report in chat
      setChatLog(l => [...l, {
        isUser: false,
        html: `<div style="background:#1e1e30;border:1px solid ${report.certified?'rgba(0,229,176,0.3)':'rgba(255,209,102,0.3)'};border-radius:10px;padding:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div style="font-family:'Space Mono',monospace;font-size:10px;color:${report.certified?'#00e5b0':'#ffd166'};text-transform:uppercase;letter-spacing:1px">🔬 QA Report</div>
            <div style="font-family:'Space Mono',monospace;font-size:14px;font-weight:700;color:${report.score>=80?'#00e5b0':report.score>=60?'#ffd166':'#ff4d6d'}">${report.score}/100</div>
          </div>
          <div style="font-size:12px;color:#f0f0fa;margin-bottom:10px">${report.summary}</div>
          ${report.critical?.length > 0 ? `<div style="margin-bottom:8px">${report.critical.map((c:string)=>`<div style="font-size:11px;color:#ff4d6d;margin-bottom:3px;display:flex;gap:5px"><span>✕</span>${c}</div>`).join('')}</div>` : ''}
          ${report.failed?.length > 0 ? `<div style="margin-bottom:8px">${report.failed.slice(0,3).map((f:string)=>`<div style="font-size:11px;color:#ffd166;margin-bottom:3px;display:flex;gap:5px"><span>⚠</span>${f}</div>`).join('')}</div>` : ''}
          ${report.passed?.length > 0 ? `<div style="margin-bottom:10px">${report.passed.slice(0,3).map((p:string)=>`<div style="font-size:11px;color:#8888aa;margin-bottom:3px;display:flex;gap:5px"><span style="color:#00e5b0">✓</span>${p}</div>`).join('')}</div>` : ''}
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px;background:${report.certified?'rgba(0,229,176,0.1)':'rgba(255,209,102,0.1)'};border-radius:6px">
            <span style="font-family:'Space Mono',monospace;font-size:10px;color:${report.certified?'#00e5b0':'#ffd166'}">${report.certified?'✅ QA CERTIFIED':'⚠️ NEEDS FIXES'}</span>
            ${!report.certified && report.critical?.length > 0 ? `<button onclick="window.jfAutoFix()" style="padding:5px 12px;background:#8b7cf8;color:#fff;border:none;border-radius:5px;font-family:'Space Mono',monospace;font-size:10px;cursor:pointer">Auto-fix issues</button>` : ''}
          </div>
        </div>`
      }])

      ;(window as any).jfAutoFix = () => {
        const issues = [...(report.critical||[]), ...(report.failed||[])].join(', ')
        setPendingFeedback(issues)
        setDiagnosisResult({ fix_plan: report.critical || [], diagnosis: 'QA found issues that need fixing', root_cause: 'Multiple QA checks failed', question: 'Apply all QA fixes now?' })
        applyFix('')
      }

    } catch(err: any) {
      setIsRunningQA(false)
      addLog('QA error: '+err.message, 'warn')
    }
  }


  async function launch() {
    if(!prompt.trim()) return
    addChat(prompt, true)
    setPhase('planning')
    setQuestions([])
    setQAnswers({})
    setFinalPlan(null)
    addLog(`NEW PROJECT: ${prompt.substring(0,60)}...`, 'build')
    if(attachments.length > 0) addLog(`Using ${attachments.length} reference file(s) as design context`, 'ok')
    addLog('Analysing requirements...', 'info')
    try {
      const sys = `You are ${jarvis?.jarvis_name||'JARVIS'}, an AI developer specialising in ${jarvis?.industry||'general'} apps.
Generate 3 clarifying questions with options. Return ONLY valid JSON, no markdown:
{"questions":[{"q":"Question?","options":["A","B","C"]}],"app_name":"Name","summary":"One sentence"}`
      const raw = await callClaude(sys, `Client request: ${prompt}`, 1500)
      let data; try{data=JSON.parse(raw.replace(/```json|```/g,'').trim())}catch(e){throw new Error('Parse failed. Try again.')}
      setPendingPlan(data)
      setQuestions(data.questions||[])
      setPhase('questioning')
      addLog('Questions ready. Waiting for answers...', 'info')
    } catch(err: any) {
      addLog('ERROR: '+err.message, 'err')
      addChat('❌ Error: '+err.message)
      setPhase('idle')
    }
  }

  function selectAnswer(qIndex: number, val: string) {
    setQAnswers(prev => ({...prev, [qIndex]: val}))
  }

  async function submitAnswers() {
    const answers = questions.map((q:any,i:number) => `${q.q}: ${qAnswers[i]||q.options[0]}`).join('\n')
    setPhase('approving')
    addLog('Generating final build plan...', 'info')
    try {
      const sys = `You are JARVIS. Generate a final build plan as JSON (no markdown):
{"app_name":"Name","summary":"Description","features":["f1","f2","f3","f4","f5"],"tech":"HTML+CSS+JS","est_time":"60-120 seconds","est_tokens":"5000-8000","complexity":"Medium","note":"approach"}`
      const raw = await callClaude(sys, `Request: ${prompt}\nAnswers:\n${answers}`, 1500)
      let plan; try{plan=JSON.parse(raw.replace(/```json|```/g,'').trim())}catch(e){plan={app_name:'Your App',summary:prompt,features:['Core features'],tech:'HTML+CSS+JS',est_time:'60-120s',est_tokens:'5000-8000',complexity:'Medium',note:'Building as requested.'}}
      setFinalPlan(plan)
      addLog('Plan ready. Awaiting your approval...', 'info')
    } catch(err: any) {
      addLog('ERROR: '+err.message, 'err')
      setPhase('idle')
    }
  }

  async function approveBuild() {
    if(!finalPlan) return
    setPhase('building')
    addChat('✅ Plan approved! Building now...')
    addLog('Code generation started...', 'build')
    startRef.current = Date.now()
    timerRef.current = setInterval(() => { setBuildTime(((Date.now()-startRef.current)/1000).toFixed(1)+'s') }, 100)
    try {
      const answers = questions.map((q:any,i:number) => `${q.q}: ${qAnswers[i]||q.options[0]}`).join(', ')
      const brandContext = brandName ? `\n- Brand name: "${brandName}". Use this in the app header/title.\n- Primary brand colour: ${brandColour}. Use this as the main accent colour throughout.` : ''
      const attachContext = attachments.length > 0 ? `\n- The user has attached ${attachments.length} reference file(s): ${attachments.map(a=>a.name).join(', ')}. Use these as visual/design inspiration — match the style, layout, and aesthetic shown in the references.` : ''

      const sys = `You are ${jarvis?.jarvis_name||'JARVIS'}. Build a complete, beautiful, fully-functional single-file HTML app.
RULES:
- Return ONLY raw HTML. No markdown, no backticks, no explanation.
- All CSS and JS inline in one file.
- BEAUTIFUL UI — professional design, smooth animations, cohesive colour scheme.
- FULLY FUNCTIONAL — all buttons work, data saves to localStorage.
- Mobile responsive. Use Google Fonts (import via CDN).
- Malaysian context: RM currency, DuitNow where relevant.
- Islamic elements where appropriate (Bismillah on forms, halal labelling).
- Real functionality — not placeholders. Pre-populate with dummy data.
- Looks like a real product someone would pay for.
- IF APP HAS LOGIN: hardcode demo@example.com / demo123. Show hint on login screen.
- EVERY button must do something. ALL navigation must show a screen.${brandContext}${attachContext}`

      const userMsg = `Build this app: ${prompt}\nUser preferences: ${answers}` + (attachments.filter(a=>a.type.startsWith('image/')).length > 0 ? '\n\nIMPORTANT: Reference images are attached. Match their visual style, colour palette, and UI patterns closely.' : '')

      const html = await callClaude(sys, userMsg, 12000, attachments.some(a=>a.type.startsWith('image/')))
      clearInterval(timerRef.current)
      const code = html.replace(/^```html\n?/, '').replace(/\n?```$/, '').trim()
      const tok = Math.round(code.length / 4)
      setBuiltCode(code)
      setTokens(tok.toLocaleString())
      setPhase('done')
      addLog(`DONE. ~${tok} tokens, ${((Date.now()-startRef.current)/1000).toFixed(1)}s`, 'ok')
      addLog('Tip: Type feedback in the chat below to improve anything!', 'ok')
      addChat(`🚀 <strong>Build complete!</strong> <strong style="color:#00e5b0">${tok.toLocaleString()} tokens</strong> · <strong style="color:#ffd166">${((Date.now()-startRef.current)/1000).toFixed(1)}s</strong><br><br>Switch to <strong>⬡ Preview</strong> to test it.<br><br><span style="color:#8b7cf8;font-size:11px">💬 Type feedback below to improve anything — I'm still here!</span>`)
      if(user) {
        await supabase.from('apps').insert({
          user_id: user.id, name: finalPlan.app_name||'My App',
          description: finalPlan.summary||prompt.substring(0,200),
          html_code: code, tokens_used: tok,
          build_time: ((Date.now()-startRef.current)/1000).toFixed(1),
          created_at: new Date().toISOString()
        })
      }
      setTimeout(() => setActiveTab('preview'), 800)
    } catch(err: any) {
      clearInterval(timerRef.current)
      addLog('ERROR: '+err.message, 'err')
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
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([builtCode], {type:'text/html'}))
    a.download = (finalPlan?.app_name||'jarvis-app').replace(/\s+/g,'-').toLowerCase()+'.html'
    a.click()
    addLog('App downloaded.', 'ok')
  }

  const allAnswered = questions.length > 0 && questions.every((_:any,i:number) => qAnswers[i])
  const isWorking = ['planning','questioning','approving','building','iterating'].includes(phase)

  const phaseLabel = {idle:'IDLE',planning:'PLANNING',questioning:'Q&A',approving:'REVIEW',building:'BUILDING',iterating:'ITERATING',done:'DONE'}[phase]

  const c: Record<string,React.CSSProperties> = {
    page:{height:'100vh',display:'flex',flexDirection:'column',background:'#05050d',fontFamily:"'DM Sans',sans-serif",overflow:'hidden'},
    nav:{height:50,background:'#0a0a18',borderBottom:'1px solid #1a1a35',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 18px',flexShrink:0},
    logo:{fontFamily:"'Space Mono',monospace",fontSize:14,color:'#00e5b0',fontWeight:700},
    main:{display:'flex',flex:1,overflow:'hidden'},
    left:{width:260,background:'#0a0a18',borderRight:'1px solid #1a1a35',display:'flex',flexDirection:'column',flexShrink:0},
    pTitle:{padding:'8px 14px',fontSize:10,fontFamily:"'Space Mono',monospace",color:'#5a5a78',textTransform:'uppercase' as const,letterSpacing:1.5,borderBottom:'1px solid #1a1a35',display:'flex',justifyContent:'space-between'},
    phaseTag:{fontSize:9,padding:'2px 7px',borderRadius:10,fontFamily:"'Space Mono',monospace",background:'rgba(90,90,120,0.3)',color:'#8888aa'},
    promptArea:{flex:1,padding:10,overflowY:'auto' as const,display:'flex',flexDirection:'column' as const,gap:8},
    textarea:{width:'100%',background:'#161625',border:'1px solid #2e2e48',borderRadius:8,color:'#f0f0fa',fontFamily:"'DM Sans',sans-serif",fontSize:12,padding:10,resize:'none' as const,height:90,lineHeight:1.6,outline:'none',boxSizing:'border-box' as const},
    launchBtn:{margin:'0 10px 10px',padding:10,background:'#00e5b0',color:'#000',border:'none',borderRadius:8,fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6},
    center:{flex:1,display:'flex',flexDirection:'column' as const,overflow:'hidden'},
    tabs:{display:'flex',background:'#0a0a18',borderBottom:'1px solid #1a1a35',padding:'0 14px',flexShrink:0},
    tab:{padding:'9px 14px',fontSize:11,fontFamily:"'Space Mono',monospace",color:'#5a5a78',cursor:'pointer',borderBottom:'2px solid transparent'},
    term:{height:140,background:'#04040c',borderTop:'1px solid #1a1a35',flexShrink:0,display:'flex',flexDirection:'column' as const},
    termH:{padding:'6px 14px',borderBottom:'1px solid #1a1a35',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0},
    termB:{flex:1,overflow:'auto',padding:'6px 14px',fontFamily:"'Space Mono',monospace",fontSize:10.5,lineHeight:1.9},
    right:{width:320,background:'#0a0a18',borderLeft:'1px solid #1a1a35',display:'flex',flexDirection:'column' as const,flexShrink:0},
    chatH:{padding:'8px 14px',borderBottom:'1px solid #1a1a35',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0},
    chatBody:{flex:1,overflowY:'auto' as const,padding:10,display:'flex',flexDirection:'column' as const,gap:8},
    bubble:{fontSize:12,lineHeight:1.7,color:'#f0f0fa',background:'#161625',padding:'9px 11px',borderRadius:8,border:'1px solid #252538',wordBreak:'break-word' as const},
    feedbackArea:{padding:'8px 10px',borderTop:'1px solid #1a1a35',flexShrink:0,background:'#080810'},
    feedbackInput:{width:'100%',background:'#161625',border:'1px solid #2e2e48',borderRadius:8,color:'#f0f0fa',fontFamily:"'DM Sans',sans-serif",fontSize:12,padding:'8px 10px',resize:'none' as const,height:60,lineHeight:1.5,outline:'none',boxSizing:'border-box' as const,marginBottom:6},
    feedbackRow:{display:'flex',gap:6},
    attachBtn:{padding:'6px 10px',background:'transparent',border:'1px solid #2e2e48',borderRadius:6,color:'#8888aa',fontSize:11,cursor:'pointer',fontFamily:"'Space Mono',monospace",flexShrink:0},
    sendBtn:{flex:1,padding:'6px 10px',background:isFeedbackLoading?'#2e2e48':'#8b7cf8',color:isFeedbackLoading?'#5a5a78':'#fff',border:'none',borderRadius:6,fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,cursor:isFeedbackLoading?'not-allowed':'pointer'},
  }

  return (
    <div style={c.page}>
      <style>{`@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}`}</style>
      <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt,.csv" onChange={handleFileAttach} style={{display:'none'}}/>

      <nav style={c.nav}>
        <div style={c.logo}>JARVISFACTORY.AI <span style={{fontSize:9,background:'rgba(139,124,248,0.2)',color:'#8b7cf8',padding:'2px 6px',borderRadius:10,marginLeft:6}}>v2.0</span></div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:'#8888aa'}}>{jarvis?.jarvis_name||'JARVIS'}</span>
          <button onClick={()=>setShowBrandPanel(!showBrandPanel)} style={{padding:'4px 10px',background:showBrandPanel?'rgba(0,229,176,0.1)':'transparent',border:'1px solid #1a1a35',borderRadius:6,color:'#8888aa',fontFamily:"'Space Mono',monospace",fontSize:10,cursor:'pointer'}}>🎨 Brand</button>
          <button style={{padding:'4px 10px',background:'transparent',border:'1px solid #1a1a35',borderRadius:6,color:'#8888aa',fontFamily:"'Space Mono',monospace",fontSize:10,cursor:'pointer'}} onClick={()=>router.push('/dashboard')}>← Dashboard</button>
        </div>
      </nav>

      {/* Brand Panel */}
      {showBrandPanel && (
        <div style={{background:'#0d0d1e',borderBottom:'1px solid #1a1a35',padding:'10px 18px',display:'flex',gap:20,alignItems:'center',flexShrink:0}}>
          <span style={{fontSize:11,fontFamily:"'Space Mono',monospace",color:'#8888aa'}}>Brand Kit</span>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:11,color:'#5a5a78'}}>Name:</span>
            <input value={brandName} onChange={e=>setBrandName(e.target.value)} placeholder="Your brand name" style={{background:'#161625',border:'1px solid #2e2e48',borderRadius:6,color:'#f0f0fa',fontSize:11,padding:'4px 8px',outline:'none',width:140}}/>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:11,color:'#5a5a78'}}>Colour:</span>
            <input type="color" value={brandColour} onChange={e=>setBrandColour(e.target.value)} style={{width:32,height:24,border:'1px solid #2e2e48',borderRadius:4,background:'none',cursor:'pointer',padding:0}}/>
            <span style={{fontSize:11,color:'#5a5a78',fontFamily:"'Space Mono',monospace"}}>{brandColour}</span>
          </div>
          <span style={{fontSize:10,color:'#5a5a78',fontStyle:'italic'}}>JARVIS will use these in every app it builds for you</span>
        </div>
      )}

      <div style={c.main}>
        {/* LEFT */}
        <div style={c.left}>
          <div style={c.pTitle}><span>Describe App</span><span style={c.phaseTag}>{phaseLabel}</span></div>
          <div style={c.promptArea}>
            <textarea style={c.textarea} placeholder="Describe your app..." value={prompt} onChange={e=>setPrompt(e.target.value)}/>

            {/* Attachment previews */}
            {attachments.length > 0 && (
              <div style={{display:'flex',flexWrap:'wrap' as const,gap:4}}>
                {attachments.map((att,i)=>(
                  <div key={i} style={{position:'relative' as const,background:'#161625',border:'1px solid #2e2e48',borderRadius:6,padding:'4px 6px',display:'flex',alignItems:'center',gap:4,maxWidth:'100%'}}>
                    {att.preview ? <img src={att.preview} alt="" style={{width:24,height:24,objectFit:'cover',borderRadius:3}}/> : <span style={{fontSize:14}}>📄</span>}
                    <span style={{fontSize:10,color:'#8888aa',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const,maxWidth:80}}>{att.name}</span>
                    <button onClick={()=>removeAttachment(i)} style={{background:'none',border:'none',color:'#5a5a78',cursor:'pointer',fontSize:11,padding:0,marginLeft:2}}>✕</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{display:'flex',gap:6}}>
              <button onClick={()=>fileInputRef.current?.click()} style={{flex:1,padding:'6px 0',background:'#161625',border:'1px dashed #2e2e48',borderRadius:6,color:'#8888aa',fontSize:10,cursor:'pointer',fontFamily:"'Space Mono',monospace"}}>
                📎 Attach reference
              </button>
              {attachments.length > 0 && <button onClick={()=>setAttachments([])} style={{padding:'6px 8px',background:'transparent',border:'1px solid #2e2e48',borderRadius:6,color:'#5a5a78',fontSize:10,cursor:'pointer'}}>Clear</button>}
            </div>

            <div style={{fontSize:9,color:'#5a5a78',fontFamily:"'Space Mono',monospace",textTransform:'uppercase' as const,letterSpacing:1}}>Quick starts</div>
            {['DRE Coffee loyalty app with points & referral','Brainy Bunch student progress tracker','Muslim ibadah daily tracker with streaks','Staff birthday gifts manager'].map(p=>(
              <button key={p} onClick={()=>setPrompt(p)} style={{padding:'7px 9px',background:'#161625',border:'1px solid #1a1a35',borderRadius:6,color:'#8888aa',fontSize:10,textAlign:'left' as const,cursor:'pointer',lineHeight:1.4}}>{p}</button>
            ))}

            <div style={{background:'#0d0d1e',border:'1px solid #1a1a35',borderRadius:8,padding:10}}>
              <div style={{fontSize:9,fontFamily:"'Space Mono',monospace",color:'#5a5a78',textTransform:'uppercase' as const,letterSpacing:1,marginBottom:6}}>Metrics</div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#8888aa',marginBottom:3}}><span>Tokens</span><span style={{color:'#f0f0fa'}}>{tokens}</span></div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#8888aa',marginBottom:3}}><span>Build time</span><span style={{color:'#f0f0fa'}}>{buildTime}</span></div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#8888aa'}}><span>Attachments</span><span style={{color:attachments.length>0?'#00e5b0':'#f0f0fa'}}>{attachments.length}</span></div>
            </div>
          </div>
          <button style={{...c.launchBtn,opacity:isWorking?0.5:1}} onClick={launch} disabled={isWorking}>
            <span>⚡</span>{phase==='done'?'Rebuild':'Launch '+(jarvis?.jarvis_name||'JARVIS')}
          </button>
          {builtCode && (
            <div style={{margin:'-4px 10px 10px',display:'flex',gap:6}}>
              <button onClick={download} style={{flex:1,padding:8,background:'#161625',color:'#8888aa',border:'1px solid #1a1a35',borderRadius:8,fontFamily:"'Space Mono',monospace",fontSize:10,cursor:'pointer'}}>⬇ Download</button>
              <button onClick={()=>runQA()} disabled={isRunningQA} style={{flex:1,padding:8,background:isRunningQA?'#1a1a35':qaReport?.certified?'rgba(0,229,176,0.15)':'rgba(255,209,102,0.15)',color:isRunningQA?'#5a5a78':qaReport?.certified?'#00e5b0':'#ffd166',border:`1px solid ${qaReport?.certified?'rgba(0,229,176,0.3)':'rgba(255,209,102,0.3)'}`,borderRadius:8,fontFamily:"'Space Mono',monospace",fontSize:10,cursor:isRunningQA?'not-allowed':'pointer'}}>
                {isRunningQA?'QA...':`🔬 QA ${qaReport?qaReport.score+'/100':''}`}
              </button>
            </div>
          )}
        </div>

        {/* CENTER */}
        <div style={c.center}>
          <div style={c.tabs}>
            <div style={{...c.tab,color:activeTab==='code'?'#00e5b0':'#5a5a78',borderBottomColor:activeTab==='code'?'#00e5b0':'transparent'}} onClick={()=>setActiveTab('code')}>index.html</div>
            <div style={{...c.tab,color:activeTab==='preview'?'#00e5b0':'#5a5a78',borderBottomColor:activeTab==='preview'?'#00e5b0':'transparent'}} onClick={()=>setActiveTab('preview')}>⬡ Live Preview</div>
          </div>
          <div style={{flex:1,overflow:'auto',display:activeTab==='code'?'flex':'none',flexDirection:'column' as const,background:'#05050d',padding:14}}>
            {!builtCode ? (
              <div style={{display:'flex',flexDirection:'column' as const,alignItems:'center',justifyContent:'center',height:'100%',gap:12,color:'#5a5a78'}}>
                <div style={{fontSize:36,opacity:0.2}}>⬡</div>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:12}}>// Waiting for instructions</div>
                <div style={{fontSize:11,textAlign:'center' as const,maxWidth:260,lineHeight:1.7,color:'#5a5a78'}}>Attach reference images, set your brand kit, then describe your app. JARVIS will plan first — then build only after you approve.</div>
              </div>
            ) : <pre id="codeDisplay" style={{fontFamily:"'Space Mono',monospace",fontSize:11,lineHeight:1.8,color:'#7ec8a0',whiteSpace:'pre-wrap' as const,wordBreak:'break-all' as const}}>{builtCode}</pre>}
          </div>
          <div style={{flex:1,overflow:'hidden',display:activeTab==='preview'?'flex':'none',flexDirection:'column' as const,background:'#fff'}}>
            {!builtCode ? (
              <div style={{display:'flex',flexDirection:'column' as const,alignItems:'center',justifyContent:'center',height:'100%',background:'#0a0a18',gap:10,color:'#5a5a78'}}>
                <div style={{fontSize:36,opacity:0.2}}>◻</div>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:12}}>Preview loads after build</div>
              </div>
            ) : <iframe id="previewFrame" style={{flex:1,border:'none',width:'100%',height:'100%'}} srcDoc={builtCode}/>}
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

        {/* RIGHT: JARVIS CHAT + FEEDBACK */}
        <div style={c.right}>
          <div style={c.chatH}>
            <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:'#8888aa'}}>🤖 <span style={{color:'#00e5b0'}}>{jarvis?.jarvis_name||'JARVIS'}</span></span>
            <span style={{fontSize:9,color:'#5a5a78',fontFamily:"'Space Mono',monospace"}}>{phase}</span>
          </div>
          <div style={c.chatBody} ref={chatRef}>
            {/* Initial greeting */}
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
            {/* Questions */}
            {phase==='questioning' && questions.length>0 && (
              <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                <div style={{width:24,height:24,borderRadius:6,background:'rgba(0,229,176,0.12)',color:'#00e5b0',border:'1px solid rgba(0,229,176,0.25)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,flexShrink:0}}>J</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:9,fontFamily:"'Space Mono',monospace",color:'#5a5a78',marginBottom:3}}>JARVIS · Now</div>
                  <div style={{background:'#1e1e30',border:'1px solid rgba(255,209,102,0.2)',borderRadius:10,padding:12}}>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:'#ffd166',marginBottom:10,textTransform:'uppercase' as const,letterSpacing:1}}>🔍 Quick Questions</div>
                    {questions.map((q:any,i:number)=>(
                      <div key={i} style={{marginBottom:12}}>
                        <div style={{fontSize:12,color:'#f0f0fa',marginBottom:6,lineHeight:1.5}}>{i+1}. {q.q}</div>
                        <div style={{display:'flex',flexWrap:'wrap' as const,gap:5}}>
                          {q.options.map((opt:string)=>(
                            <button key={opt} onClick={()=>selectAnswer(i,opt)} style={{padding:'4px 10px',background:qAnswers[i]===opt?'rgba(139,124,248,0.2)':'#161625',border:qAnswers[i]===opt?'1px solid #8b7cf8':'1px solid #2e2e48',borderRadius:20,fontSize:10,color:qAnswers[i]===opt?'#8b7cf8':'#8888aa',cursor:'pointer',fontFamily:"'Space Mono',monospace",transition:'all 0.15s'}}>{opt}</button>
                          ))}
                        </div>
                      </div>
                    ))}
                    <button onClick={submitAnswers} disabled={!allAnswered} style={{width:'100%',marginTop:6,padding:8,background:allAnswered?'#8b7cf8':'#2e2e48',color:allAnswered?'#fff':'#5a5a78',border:'none',borderRadius:7,fontFamily:"'Space Mono',monospace",fontSize:10,fontWeight:700,cursor:allAnswered?'pointer':'not-allowed'}}>
                      {allAnswered?'Submit & See Build Plan →':`Answer all (${Object.keys(qAnswers).length}/${questions.length})`}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* Plan card */}
            {phase==='approving' && finalPlan && (
              <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                <div style={{width:24,height:24,borderRadius:6,background:'rgba(0,229,176,0.12)',color:'#00e5b0',border:'1px solid rgba(0,229,176,0.25)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,flexShrink:0}}>J</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:9,fontFamily:"'Space Mono',monospace",color:'#5a5a78',marginBottom:3}}>JARVIS · Now</div>
                  <div style={{background:'#1e1e30',border:'1px solid #2e2e48',borderRadius:10,padding:12}}>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:'#00e5b0',marginBottom:8,textTransform:'uppercase' as const,letterSpacing:1}}>📋 {finalPlan.app_name}</div>
                    {[['Complexity',finalPlan.complexity],['Est. Time',finalPlan.est_time],['Tokens',finalPlan.est_tokens]].map(([k,v])=>(
                      <div key={k} style={{display:'flex',justifyContent:'space-between',marginBottom:4,fontSize:10,color:'#8888aa'}}><span>{k}</span><strong style={{color:'#f0f0fa'}}>{v}</strong></div>
                    ))}
                    <div style={{height:1,background:'#252538',margin:'8px 0'}}/>
                    {finalPlan.features?.slice(0,4).map((f:string,i:number)=>(
                      <div key={i} style={{fontSize:10,color:'#8888aa',marginBottom:3,display:'flex',gap:5}}><span style={{color:'#00e5b0'}}>✓</span>{f}</div>
                    ))}
                    <div style={{display:'flex',gap:6,marginTop:10}}>
                      <button onClick={rejectPlan} style={{flex:1,padding:7,background:'transparent',color:'#8888aa',border:'1px solid #2e2e48',borderRadius:7,fontFamily:"'Space Mono',monospace",fontSize:10,cursor:'pointer'}}>✕ Revise</button>
                      <button onClick={approveBuild} style={{flex:1,padding:7,background:'#00e5b0',color:'#000',border:'none',borderRadius:7,fontFamily:"'Space Mono',monospace",fontSize:10,fontWeight:700,cursor:'pointer'}}>✓ Build</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* Building indicator */}
            {(phase==='building'||phase==='iterating') && (
              <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                <div style={{width:24,height:24,borderRadius:6,background:'rgba(0,229,176,0.12)',color:'#00e5b0',border:'1px solid rgba(0,229,176,0.25)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,flexShrink:0}}>J</div>
                <div style={{...c.bubble,borderColor:'rgba(0,229,176,0.1)'}}>
                  <div style={{display:'flex',gap:4,alignItems:'center'}}>
                    <span style={{width:6,height:6,borderRadius:'50%',background:'#00e5b0',display:'inline-block',animation:'bob 1s infinite'}}/>
                    <span style={{width:6,height:6,borderRadius:'50%',background:'#8b7cf8',display:'inline-block',animation:'bob 1s 0.15s infinite'}}/>
                    <span style={{width:6,height:6,borderRadius:'50%',background:'#ff6b9d',display:'inline-block',animation:'bob 1s 0.3s infinite'}}/>
                    <span style={{marginLeft:8,fontSize:11,color:'#8888aa'}}>{phase==='iterating'?'Updating your app...':'Building... '+buildTime}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── SPRINT 1: FEEDBACK INPUT ── */}
          <div style={c.feedbackArea}>
            <div style={{fontSize:9,fontFamily:"'Space Mono',monospace",color:builtCode&&!isWorking?'#8b7cf8':'#5a5a78',marginBottom:5,letterSpacing:0.5}}>
              {builtCode && !isWorking ? '💬 JARVIS IS LISTENING — TYPE FEEDBACK TO IMPROVE THE APP' : '⚡ BUILD AN APP FIRST — THEN GIVE FEEDBACK HERE'}
            </div>
            <textarea
              style={{...c.feedbackInput, opacity: builtCode&&!isWorking?1:0.35, borderColor: builtCode&&!isWorking?'rgba(139,124,248,0.4)':'#2e2e48'}}
              placeholder={builtCode ? 'e.g. "Make the header dark blue", "Add a search bar", "Change to DRE Coffee branding"...' : 'Build an app first, then give feedback here...'}
              value={feedbackInput}
              onChange={e=>setFeedbackInput(e.target.value)}
              disabled={!builtCode||isWorking||feedbackPhase!=='idle'}
              onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&builtCode&&!isWorking){e.preventDefault();sendFeedback()}}}
            />
            <div style={c.feedbackRow}>
              <button onClick={()=>fileInputRef.current?.click()} style={c.attachBtn} title="Attach reference image">📎</button>
              <button
                onClick={async()=>{
                  if(!builtCode||!user) return
                  await supabase.from('apps').insert({
                    user_id:user.id,
                    name:(finalPlan?.app_name||'My App')+' (saved)',
                    description:'Manually saved',
                    html_code:builtCode,
                    tokens_used:0,
                    build_time:'0',
                    created_at:new Date().toISOString()
                  })
                  addLog('App saved to dashboard.','ok')
                  addChat('✅ App saved to your dashboard!')
                }}
                disabled={!builtCode}
                style={{padding:'6px 10px',background:'transparent',border:'1px solid #2e2e48',borderRadius:6,color:builtCode?'#00e5b0':'#5a5a78',fontSize:10,cursor:builtCode?'pointer':'not-allowed',fontFamily:"'Space Mono',monospace",flexShrink:0}}
              >💾 Save</button>
              <button
                onClick={sendFeedback}
                disabled={!feedbackInput.trim()||!builtCode||isWorking||feedbackPhase!=='idle'}
                style={{...c.sendBtn, flex:1, background:(!feedbackInput.trim()||!builtCode||isWorking)?'#2e2e48':'#8b7cf8', color:(!feedbackInput.trim()||!builtCode||isWorking)?'#5a5a78':'#fff'}}
              >
                {isFeedbackLoading?'Updating...':'Send ↑'}
              </button>
            </div>
          </div>        </div>
      </div>
    </div>
  )
}
