'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

interface CopyButtonProps {
  text: string
  className?: string
  size?: 'sm' | 'default' | 'lg'
  label?: string
}

export function CopyButton({ text, className = '', size = 'sm', label = 'Text' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
        variant: "default"
      })
    } catch (error) {
      console.error('Failed to copy text:', error)
      toast({
        title: "Copy failed",
        description: "Failed to copy to clipboard",
        variant: "destructive"
      })
    }
  }

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={handleCopy}
      className={`h-auto p-1 ${className}`}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </Button>
  )
}