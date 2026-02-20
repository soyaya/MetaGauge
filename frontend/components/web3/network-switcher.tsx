'use client'

import { useChainId, useSwitchChain } from 'wagmi'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CheckCircle, Zap } from 'lucide-react'
import { liskSepolia, lisk, isLiskNetwork } from '@/lib/web3-config'

interface NetworkSwitcherProps {
  className?: string
  showAlert?: boolean
}

export function NetworkSwitcher({ className = "", showAlert = true }: NetworkSwitcherProps) {
  const chainId = useChainId()
  const { switchChain, isPending } = useSwitchChain()

  const isOnLiskSepolia = chainId === liskSepolia.id
  const isOnLiskMainnet = chainId === lisk.id
  const isOnLiskNetwork = isLiskNetwork(chainId)

  const handleSwitchToLiskSepolia = async () => {
    try {
      await switchChain({ chainId: liskSepolia.id })
    } catch (error) {
      console.error('Failed to switch to Lisk Sepolia:', error)
    }
  }

  const getNetworkBadge = () => {
    if (isOnLiskSepolia) {
      return (
        <Badge variant="default" className="bg-green-500 flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Lisk Sepolia (Testnet)
        </Badge>
      )
    } else if (isOnLiskMainnet) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Lisk Mainnet
        </Badge>
      )
    } else {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Unsupported Network
        </Badge>
      )
    }
  }

  return (
    <div className={className}>
      {/* Network Status Badge */}
      <div className="flex items-center gap-2 mb-2">
        {getNetworkBadge()}
        {!isOnLiskSepolia && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleSwitchToLiskSepolia}
            disabled={isPending}
            className="flex items-center gap-1"
          >
            <Zap className="h-3 w-3" />
            {isPending ? 'Switching...' : 'Switch to Lisk Sepolia'}
          </Button>
        )}
      </div>

      {/* Network Alert */}
      {showAlert && !isOnLiskSepolia && (
        <Alert variant={isOnLiskNetwork ? "default" : "destructive"} className="mt-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {isOnLiskMainnet ? (
              <div className="space-y-2">
                <p>You're on Lisk Mainnet. Switch to Lisk Sepolia Testnet to test MetaGauge subscriptions.</p>
                <Button
                  size="sm"
                  onClick={handleSwitchToLiskSepolia}
                  disabled={isPending}
                >
                  {isPending ? 'Switching...' : 'Switch to Lisk Sepolia'}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p>MetaGauge subscriptions are only available on Lisk networks. Please switch to Lisk Sepolia Testnet.</p>
                <Button
                  size="sm"
                  onClick={handleSwitchToLiskSepolia}
                  disabled={isPending}
                >
                  {isPending ? 'Switching...' : 'Switch to Lisk Sepolia'}
                </Button>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Success Message */}
      {showAlert && isOnLiskSepolia && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20 mt-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            ✅ Perfect! You're connected to Lisk Sepolia Testnet and ready to use MetaGauge subscriptions.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}