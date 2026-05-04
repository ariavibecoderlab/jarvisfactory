import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'JarvisFactory.ai — Your Own AI Developer',
  description: 'Build apps without code. Your personal JARVIS plans, estimates, and builds your app — then deploys it live.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
      </head>
      <body style={{margin:0, background:'#05050d', color:'#f0f0fa', fontFamily:"'DM Sans', sans-serif"}}>
        {children}
      </body>
    </html>
  )
}
