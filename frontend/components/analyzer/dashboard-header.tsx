const chainLogos = {
  ethereum: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg',
  starknet: 'https://cryptologos.cc/logos/starknet-token-strk-logo.svg',
};

interface DashboardHeaderProps {
  startupName: string;
  chain: string;
  analysisResults: any;
}

export function DashboardHeader({ startupName, chain, analysisResults }: DashboardHeaderProps) {
  const chainIcon = chainLogos[chain as keyof typeof chainLogos];
  const results = analysisResults?.results?.target || {};
  const metadata = analysisResults?.metadata || {};
  
  return (
    <div className="mb-8 p-6 rounded-xl bg-gradient-to-r from-card to-muted/50 border">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            OnChain Analysis: {startupName}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Generated {new Date(analysisResults?.completedAt || Date.now()).toLocaleString()} • {chain.toUpperCase()}
          </p>
          <div className="flex gap-4 mt-3 text-sm">
            <span className="text-muted-foreground">
              Contract: <span className="font-mono text-foreground">{results.contract?.address?.slice(0, 10)}...</span>
            </span>
            <span className="text-muted-foreground">
              Transactions: <span className="text-foreground font-semibold">{results.transactions || 0}</span>
            </span>
            <span className="text-muted-foreground">
              Block Range: <span className="text-foreground font-semibold">{metadata.blockRange || 'N/A'}</span>
            </span>
          </div>
        </div>
        {chainIcon && (
          <img src={chainIcon || "/placeholder.svg"} alt={chain} className="w-16 h-16 object-contain" />
        )}
      </div>
    </div>
  );
}