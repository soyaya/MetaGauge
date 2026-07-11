'use client'

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Compass, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { TAB_ORDER, TAB_GUIDES } from '@/lib/tab-guides'

const SEEN_KEY = 'mg_dashboard_tour_seen'

export interface DashboardTourHandle {
  restart: () => void
}

interface DashboardTourProps {
  activeTab: string
  setActiveTab: (tab: string) => void
}

export const DashboardTour = forwardRef<DashboardTourHandle, DashboardTourProps>(
  function DashboardTour({ activeTab, setActiveTab }, ref) {
    const [showPrompt, setShowPrompt] = useState(false)
    const [touring, setTouring] = useState(false)
    const [step, setStep] = useState(0)

    useEffect(() => {
      try {
        if (!localStorage.getItem(SEEN_KEY)) setShowPrompt(true)
      } catch { /* localStorage unavailable */ }
    }, [])

    const markSeen = () => {
      try { localStorage.setItem(SEEN_KEY, '1') } catch { /* ignore */ }
    }

    const start = () => {
      setShowPrompt(false)
      setTouring(true)
      setStep(0)
      setActiveTab(TAB_ORDER[0])
    }

    const end = () => {
      setTouring(false)
      setShowPrompt(false)
      markSeen()
    }

    const goTo = (nextStep: number) => {
      if (nextStep < 0 || nextStep >= TAB_ORDER.length) { end(); return }
      setStep(nextStep)
      setActiveTab(TAB_ORDER[nextStep])
    }

    useImperativeHandle(ref, () => ({
      restart: () => start(),
    }))

    if (touring) {
      const guide = TAB_GUIDES[activeTab] || TAB_GUIDES[TAB_ORDER[step]]
      return (
        <Card className="mb-3 border-primary/40 bg-primary/5">
          <CardContent className="p-3 flex items-start gap-3">
            <Compass className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground mb-0.5">
                Step {step + 1} of {TAB_ORDER.length}
              </div>
              <div className="text-sm font-semibold">{guide?.label}</div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{guide?.description}</p>
              <div className="flex items-center gap-2 mt-2">
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => goTo(step - 1)} disabled={step === 0}>
                  <ChevronLeft className="h-3 w-3 mr-0.5" /> Back
                </Button>
                <Button size="sm" className="h-7 px-2 text-xs" onClick={() => goTo(step + 1)}>
                  {step === TAB_ORDER.length - 1 ? 'Finish' : 'Next'}
                  {step < TAB_ORDER.length - 1 && <ChevronRight className="h-3 w-3 ml-0.5" />}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" onClick={end}>
                  Skip tour
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )
    }

    if (showPrompt) {
      return (
        <Card className="mb-3 border-primary/40 bg-primary/5">
          <CardContent className="p-3 flex items-center gap-3">
            <Compass className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 text-sm">
              New here? Take a 60-second tour of your dashboard.
            </div>
            <Button size="sm" className="h-7 px-2 text-xs" onClick={start}>Start Tour</Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={end} aria-label="Dismiss">
              <X className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      )
    }

    return null
  }
)
