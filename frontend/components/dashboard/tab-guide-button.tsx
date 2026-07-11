'use client'

import { HelpCircle } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { TAB_GUIDES } from '@/lib/tab-guides'

export function TabGuideButton({ tabKey }: { tabKey: string }) {
  const guide = TAB_GUIDES[tabKey]
  if (!guide) return null

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          aria-label={`About the ${guide.label} tab`}
        >
          <HelpCircle className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">What is this?</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-sm" align="start">
        <div className="font-semibold mb-1">{guide.label}</div>
        <p className="text-muted-foreground leading-relaxed">{guide.description}</p>
      </PopoverContent>
    </Popover>
  )
}
