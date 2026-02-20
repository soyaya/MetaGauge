'use client'

import { useState, useEffect } from 'react'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CheckCircle, Wifi } from 'lucide-react'
import { liskSepolia, isLiskNetwork, validateNetwork } from '@/lib/web3-config'

interface WalletConnectProps {
  onConnect?: (address: string) => void
  onDisconnect?: () => void
  onNetworkChange?: (chainId: number) => void
  showBalance?: boolean
  className?: string
  enforceNetwork?: boolean
}

export function WalletConnect({ 
  onConnect, 
  onDisconnect, 
  onNetworkChange,
  showBalance = false,
  className = "",
  enforceNetwork = true
}: WalletConnectProps) {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const [networkError, setNetworkError] = useState<string>('')

  // Check network when connection changes
  useEffect(() => {
    if (isConnected && address) {
      onConnect?.(address)
      
      // Sync subscription from smart contract
      syncSubscription(address);
      
      if (enforceNetwork) {
        try {
          validateNetwork(chainId)
          setNetworkError('')
          onNetworkChange?.(chainId)
        } catch (error) {
          setNetworkError(error instanceof Error ? error.message : 'Invalid network')
        }
      }
    } else {
      onDisconnect?.()
      setNetworkError('')
    }
  }, [isConnected, address, chainId, onConnect, onDisconnect, onNetworkChange, enforceNetwork])

  const syncSubscription = async (walletAddress: string) => {
    try {
      // Check if user is authenticated before syncing
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('⏭️  Skipping subscription sync - user not authenticated');
        return;
      }
      
      const { api } = await import('@/lib/api');
      await api.users.syncSubscription(walletAddress);
      console.log('✅ Subscription synced from smart contract');
    } catch (error) {
      console.error('Failed to sync subscription:', error);
    }
  };

  const handleSwitchToLiskSepolia = async () => {
    try {
      setNetworkError('')
      await switchChain({ chainId: liskSepolia.id })
    } catch (error) {
      console.error('Failed to switch network:', error)
      setNetworkError('Failed to switch to Lisk Sepolia. Please switch manually in your wallet.')
    }
  }

  const getNetworkStatus = () => {
    if (!isConnected) return null
    
    const isLisk = isLiskNetwork(chainId)
    const isCorrectNetwork = chainId === liskSepolia.id
    
    if (isCorrectNetwork) {
      return (
        <Badge variant="default" className="flex items-center gap-1 bg-green-500">
          <CheckCircle className="h-3 w-3" />
          Lisk Sepolia
        </Badge>
      )
    } else if (isLisk) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Wifi className="h-3 w-3" />
          Lisk Mainnet
        </Badge>
      )
    } else {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Wrong Network
        </Badge>
      )
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* RainbowKit Connect Button */}
      <div className="flex items-center gap-3">
        <ConnectButton.Custom>
          {({
            account,
            chain,
            openAccountModal,
            openChainModal,
            openConnectModal,
            authenticationStatus,
            mounted,
          }) => {
            // Note: If your app doesn't use authentication, you
            // can remove all 'authenticationStatus' checks
            const ready = mounted && authenticationStatus !== 'loading'
            const connected =
              ready &&
              account &&
              chain &&
              (!authenticationStatus ||
                authenticationStatus === 'authenticated')

            return (
              <div
                {...(!ready && {
                  'aria-hidden': true,
                  'style': {
                    opacity: 0,
                    pointerEvents: 'none',
                    userSelect: 'none',
                  },
                })}
              >
                {(() => {
                  if (!connected) {
                    return (
                      <Button onClick={openConnectModal} className="flex items-center gap-2">
                        <Wifi className="h-4 w-4" />
                        Connect Wallet
                      </Button>
                    )
                  }

                  if (chain.unsupported) {
                    return (
                      <Button onClick={openChainModal} variant="destructive">
                        Wrong network
                      </Button>
                    )
                  }

                  return (
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={openChainModal}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        {chain.hasIcon && (
                          <div
                            style={{
                              background: chain.iconBackground,
                              width: 16,
                              height: 16,
                              borderRadius: 999,
                              overflow: 'hidden',
                              marginRight: 4,
                            }}
                          >
                            {chain.iconUrl && (
                              <img
                                alt={chain.name ?? 'Chain icon'}
                                src={chain.iconUrl}
                                style={{ width: 16, height: 16 }}
                              />
                            )}
                          </div>
                        )}
                        {chain.name}
                      </Button>

                      <Button
                        onClick={openAccountModal}
                        variant="outline"
                        size="sm"
                      >
                        {account.displayName}
                        {account.displayBalance
                          ? ` (${account.displayBalance})`
                          : ''}
                      </Button>
                    </div>
                  )
                })()}
              </div>
            )
          }}
        </ConnectButton.Custom>

        {/* Network Status Badge */}
        {getNetworkStatus()}
      </div>

      {/* Network Error Alert */}
      {networkError && enforceNetwork && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{networkError}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSwitchToLiskSepolia}
              disabled={isSwitching}
              className="ml-2"
            >
              {isSwitching ? 'Switching...' : 'Switch to Lisk Sepolia'}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Network Info for Non-Lisk Networks */}
      {isConnected && !isLiskNetwork(chainId) && enforceNetwork && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p>MetaGauge subscriptions are only available on Lisk networks.</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSwitchToLiskSepolia}
                  disabled={isSwitching}
                >
                  {isSwitching ? 'Switching...' : 'Switch to Lisk Sepolia'}
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Success Message for Correct Network */}
      {/* {isConnected && chainId === liskSepolia.id && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            ✅ Connected to Lisk Sepolia Testnet. You can now use MetaGauge subscriptions!
          </AlertDescription>
        </Alert>
      )} */}
    </div>
  )
}