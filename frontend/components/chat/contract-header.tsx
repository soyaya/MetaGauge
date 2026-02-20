'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ExternalLink,
  BarChart3,
  Clock,
  Users
} from 'lucide-react';

interface ContractHeaderProps {
  contractAddress: string;
  contractChain: string;
  contractName: string;
  contractContext?: {
    contractData: any;
    analysisData: any;
    hasRecentAnalysis: boolean;
    lastAnalyzed: string | null;
  };
}

export function ContractHeader({ 
  contractAddress, 
  contractChain, 
  contractName, 
  contractContext 
}: ContractHeaderProps) {
  const getChainColor = (chain: string) => {
    const colors = {
      ethereum: 'bg-blue-100 text-blue-800 border-blue-200',
      lisk: 'bg-green-100 text-green-800 border-green-200',
      starknet: 'bg-purple-100 text-purple-800 border-purple-200',
    };
    return colors[chain as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getExplorerUrl = (chain: string, address: string) => {
    const explorers = {
      ethereum: `https://etherscan.io/address/${address}`,
      lisk: `https://blockscout.lisk.com/address/${address}`,
      starknet: `https://starkscan.co/contract/${address}`,
    };
    return explorers[chain as keyof typeof explorers];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const analysisData = contractContext?.analysisData?.results?.target;

  return (
    <div className="border-b border-border bg-card">
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-xl font-semibold truncate">{contractName}</h1>
              <Badge className={getChainColor(contractChain)}>
                {contractChain}
              </Badge>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <code className="bg-muted px-2 py-1 rounded text-xs font-mono">
                {contractAddress}
              </code>
              {getExplorerUrl(contractChain, contractAddress) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(getExplorerUrl(contractChain, contractAddress), '_blank')}
                  className="h-6 px-2"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Explorer
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Contract Stats */}
        {contractContext?.hasRecentAnalysis && analysisData && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Transactions</p>
                    <p className="font-semibold">
                      {analysisData.transactions?.toLocaleString() || '0'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Users</p>
                    <p className="font-semibold">
                      {analysisData.behavior?.userCount?.toLocaleString() || '0'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-green-500"></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Value</p>
                    <p className="font-semibold">
                      {analysisData.metrics?.totalValue 
                        ? `${(analysisData.metrics.totalValue / 1e18).toFixed(2)} ETH`
                        : 'N/A'
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Last Analyzed</p>
                    <p className="font-semibold text-xs">
                      {contractContext.lastAnalyzed 
                        ? formatDate(contractContext.lastAnalyzed)
                        : 'Never'
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* No Analysis Warning */}
        {!contractContext?.hasRecentAnalysis && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    No recent analysis data available
                  </p>
                  <p className="text-xs text-yellow-700">
                    Run an analysis first to get detailed insights about this contract.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}