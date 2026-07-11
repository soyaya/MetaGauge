'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { TAB_ORDER, TAB_GUIDES } from '@/lib/tab-guides'
import { Compass } from 'lucide-react'

interface HelpModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRestartTour: () => void
}

export function HelpModal({ open, onOpenChange, onRestartTour }: HelpModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dashboard Guide</DialogTitle>
          <DialogDescription>What each tab does, in plain terms.</DialogDescription>
        </DialogHeader>

        <Button
          variant="outline"
          size="sm"
          className="w-full justify-center gap-2"
          onClick={() => { onOpenChange(false); onRestartTour() }}
        >
          <Compass className="h-3.5 w-3.5" />
          Restart the guided tour
        </Button>

        <div className="space-y-3 pt-1">
          {TAB_ORDER.map(key => {
            const guide = TAB_GUIDES[key]
            if (!guide) return null
            return (
              <div key={key} className="border-b border-border/60 pb-3 last:border-0 last:pb-0">
                <div className="text-sm font-semibold">{guide.label}</div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{guide.description}</p>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
