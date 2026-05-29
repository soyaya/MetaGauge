import type React from "react"
import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

import { AuthProvider } from "@/components/auth/auth-provider"
import { ThemeProvider } from "@/components/theme/theme-provider"
import { SupportWidget } from "@/components/ui/support-widget"

export const metadata: Metadata = {
  title: "MetaGauge - Measure, Optimize, and Scale Your Web3 Project",
  description: "Track feature adoption, wallet behavior, and financial health across Ethereum and Starknet",
  icons: {
    icon: [
      { url: '/favicon-light.png', sizes: '32x32', type: 'image/png', media: '(prefers-color-scheme: light)' },
      { url: '/favicon-dark.png', sizes: '32x32', type: 'image/png', media: '(prefers-color-scheme: dark)' },
      { url: '/favicon-light.png', sizes: 'any' },
    ],
    apple: '/favicon-light.png',
    shortcut: '/favicon-light.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Inline script: apply theme before first paint to prevent flash. Default = dark */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var t = localStorage.getItem('metagauge-ui-theme');
            if (t === 'light') document.documentElement.classList.add('light');
            else document.documentElement.classList.add('dark');
          } catch(e) { document.documentElement.classList.add('dark'); }
        `}} />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <ThemeProvider defaultTheme="dark" storageKey="metagauge-ui-theme">
          <AuthProvider>
            {children}
            <SupportWidget />
          </AuthProvider>
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
