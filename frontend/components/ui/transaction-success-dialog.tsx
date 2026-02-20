'use client'

import { useState } from 'react'
import { CheckCircle, ExternalLink, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { getExplorerUrl } from '@/lib/web3-config'

interface TransactionSuccessDialogProps {
  isOpen: boolean
  onClose: () => void
  transactionHash: string
  chainId: number
  title: string
  description?: string
  details?: Array<{
    label: string
    value: string
  }>
}

export function TransactionSuccessDialog({
  isOpen,
  onClose,
  transactionHash,
  chainId,
  title,
  description,
  details = []
}: TransactionSuccessDialogProps) {
  const explorerUrl = getExplorerUrl(chainId, transactionHash)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              {title}
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {description && (
            <p className="text-sm text-muted-foreground mt-2">
              {description}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {/* Transaction Details */}
          {details.length > 0 && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <h4 className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">
                Transaction Details
              </h4>
              <div className="space-y-2">
                {details.map((detail, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-green-600 dark:text-green-400">
                      {detail.label}:
                    </span>
                    <span className="font-medium text-green-700 dark:text-green-300">
                      {detail.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transaction Hash */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
              Transaction Hash
            </h4>
            <div className="flex items-center gap-2 mb-3">
              <code className="flex-1 text-xs font-mono bg-white dark:bg-gray-800 p-2 rounded border break-all">
                {transactionHash}
              </code>
              <CopyButton 
                text={transactionHash} 
                label="Transaction hash"
                size="sm"
              />
            </div>
            
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              View on Lisk Sepolia Explorer
            </a>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={onClose}
              className="flex-1"
            >
              Continue
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open(explorerUrl, '_blank')}
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              View Transaction
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}