'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit'
import { wagmiConfig, liskSepolia } from '@/lib/web3-config'
import { useState } from 'react'
import { useTheme } from 'next-themes'

// Import RainbowKit styles
import '@rainbow-me/rainbowkit/styles.css'

export function Web3Provider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  const { theme } = useTheme()

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={theme === 'dark' ? darkTheme() : lightTheme()}
          showRecentTransactions={true}
          initialChain={liskSepolia}
          appInfo={{
            appName: 'MetaGauge',
            learnMoreUrl: 'https://metagauge.io',
          }}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}