# JarvisFactory.ai

Your Own AI Developer. No Code Needed.

## Stack
- Next.js 14 (App Router)
- Supabase (Auth + Database)
- Claude Sonnet 4.6 (AI Builder)
- Railway (Hosting)

## Setup

### 1. Supabase Schema
Go to your Supabase project → SQL Editor → paste `supabase-schema.sql` → Run

### 2. Environment Variables
Update `.env.local` with your keys:
```
NEXT_PUBLIC_SUPABASE_URL=https://jtvhhpnmpdduxlmikqtq.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_key
ANTHROPIC_API_KEY=your_anthropic_key
```

### 3. Install & Run
```bash
npm install
npm run dev
```

### 4. Deploy to Railway
```bash
git init && git add . && git commit -m "JarvisFactory v1"
# Push to GitHub then deploy from Railway
```

## Pages
- `/` — Landing page with waitlist
- `/auth` — Sign up / Sign in
- `/onboarding` — JarvisFactory onboarding (builds your JARVIS)
- `/dashboard` — App portfolio
- `/builder` — JARVIS AI builder

Built by Coach Fadzil © 2026
