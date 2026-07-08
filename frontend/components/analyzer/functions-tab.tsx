"use client"

import { useState } from 'react'
import { FunctionSignatureTable } from './function-signature-table'
import { UserJourneyFlow } from './user-journey-flow'
import { CohortAnalysisTable } from './cohort-analysis-table'
import { WalletAnalyticsTab } from './wallet-analytics-tab'
import { BarChart2, GitFork, Users, Wallet } from 'lucide-react'

interface FunctionsTabProps {
  contractAddress: string
  chain: string
}

const TABS = [
  { id: 'signatures', label: 'Signatures',    icon: BarChart2 },
  { id: 'journeys',   label: 'User Journeys', icon: GitFork   },
  { id: 'cohorts',    label: 'Cohorts',       icon: Users     },
  { id: 'analytics',  label: 'Analytics',     icon: Wallet    },
] as const

type TabId = typeof TABS[number]['id']

export function FunctionsTab({ contractAddress, chain }: FunctionsTabProps) {
  const [active, setActive] = useState<TabId>('signatures')

  const content: Record<TabId, React.ReactNode> = {
    signatures: <FunctionSignatureTable contractAddress={contractAddress} chain={chain} />,
    journeys:   <UserJourneyFlow        contractAddress={contractAddress} chain={chain} />,
    cohorts:    <CohortAnalysisTable    contractAddress={contractAddress} chain={chain} />,
    analytics:  <WalletAnalyticsTab     contractAddress={contractAddress} chain={chain} />,
  }

  return (
    <div className="flex flex-col sm:flex-row gap-0 sm:gap-4 mt-2">
      {/* ── Sidebar nav (vertical on sm+, horizontal scroll on mobile) ── */}
      <nav className="flex sm:flex-col gap-1 overflow-x-auto sm:overflow-visible pb-1 sm:pb-0 shrink-0 sm:w-40">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActive(id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors shrink-0 sm:w-full
              ${active === id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </button>
        ))}
      </nav>

      {/* ── Content panel ── */}
      <div className="flex-1 min-w-0">
        {content[active]}
      </div>
    </div>
  )
}

