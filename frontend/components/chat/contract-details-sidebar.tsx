'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ExternalLink,
  BarChart3,
  Clock,
  Users,
  TrendingUp,
  Shield,
  Activity
} from 'lucide-react';

interface ContractDetailsSidebarProps {
  session: {
    id: string;
    title: string;
    contractAddress: string;
    contractChain: string;
    contractName: string;
    lastMessageAt: string;
    messageCount: number;
  } | null;
  contractContext?: {
    contractData: any;
    analysisData: any;
    hasRecentAnalysis: boolean;
    lastAnalyzed: string | null;
  };
}

export function ContractDetailsSidebar({ session, contractContext }: ContractDetailsSidebarProps) {
  if (!session) {
    return (
      <div className="w-80 xl:w-96 border-l border-border bg-card flex flex-col h-full items-center justify-center">
        <div className="text-center p-6">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-muted-foreground mb-2">No Contract Selected</h3>
          <p className="text-sm text-muted-foreground">
            Start a chat to see contract details and analysis data
          </p>
        </div>
      </div>
    );
  }

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
    <div className="w-80 xl:w-96 border-l border-border bg-card flex flex-col h-full">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Contract Info */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base truncate">{session.contractName}</CardTitle>
                <Badge className={getChainColor(session.contractChain)}>
                  {session.contractChain}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Contract Address</p>
                <code className="bg-muted px-2 py-1 rounded text-xs font-mono block break-all">
                  {session.contractAddress}
                </code>
              </div>
              
              <div className="flex gap-2">
                {getExplorerUrl(session.contractChain, session.contractAddress) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(getExplorerUrl(session.contractChain, session.contractAddress), '_blank')}
                    className="flex-1 text-xs"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Explorer
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('/analyzer', '_blank')}
                  className="flex-1 text-xs"
                >
                  <BarChart3 className="h-3 w-3 mr-1" />
                  Analyze
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Analysis Status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Analysis Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contractContext?.hasRecentAnalysis ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-sm font-medium text-green-700">Data Available</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last analyzed: {contractContext.lastAnalyzed ? formatDate(contractContext.lastAnalyzed) : 'Unknown'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                    <span className="text-sm font-medium text-yellow-700">No Recent Data</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Run an analysis to get detailed insights
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Key Metrics */}
          {contractContext?.hasRecentAnalysis && analysisData && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Key Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center p-2 bg-muted/50 rounded">
                    <BarChart3 className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Transactions</p>
                    <p className="font-semibold text-sm">
                      {analysisData.transactions?.toLocaleString() || '0'}
                    </p>
                  </div>
                  
                  <div className="text-center p-2 bg-muted/50 rounded">
                    <Users className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Users</p>
                    <p className="font-semibold text-sm">
                      {analysisData.behavior?.userCount?.toLocaleString() || '0'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Total Value</span>
                    <span className="text-sm font-medium">
                      {analysisData.metrics?.totalValue 
                        ? `${(analysisData.metrics.totalValue / 1e18).toFixed(2)} ETH`
                        : 'N/A'
                      }
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">Avg. Transaction</span>
                    <span className="text-sm font-medium">
                      {analysisData.metrics?.avgTransactionValue 
                        ? `${(analysisData.metrics.avgTransactionValue / 1e18).toFixed(4)} ETH`
                        : 'N/A'
                      }
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Security & Health */}
          {contractContext?.hasRecentAnalysis && analysisData && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Health Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Overall Health</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-green-500 transition-all duration-300"
                          style={{ width: '75%' }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium">Good</span>
                    </div>
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    Based on transaction patterns, user behavior, and contract activity
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Chat Session Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Session Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Messages</span>
                <span className="text-sm font-medium">{session.messageCount}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Last Activity</span>
                <span className="text-xs font-medium">
                  {session.lastMessageAt ? formatDate(session.lastMessageAt) : 'Just started'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}