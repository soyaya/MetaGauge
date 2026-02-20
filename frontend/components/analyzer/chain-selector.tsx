interface ChainSelectorProps {
  value: string;
  onChange: (chain: string) => void;
  error?: string;
  chainLogos: Record<string, string>;
  chains: string[];
}

export function ChainSelector({
  value,
  onChange,
  error,
  chainLogos,
  chains,
}: ChainSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium mb-4">Select Blockchain</label>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {chains.map((chain) => (
          <button
            key={chain}
            type="button"
            onClick={() => onChange(chain)}
            className={`p-4 rounded-lg border-2 transition-all hover:scale-105 ${
              value === chain
                ? 'border-primary bg-primary/5 shadow-lg'
                : 'border-border bg-card hover:border-primary/50'
            }`}
          >
            <img
              src={chainLogos[chain] || "/placeholder.svg"}
              alt={chain}
              className="w-12 h-12 mx-auto mb-2 object-contain"
            />
            <span className="text-xs font-semibold capitalize">{chain}</span>
          </button>
        ))}
      </div>
      {error && <p className="text-destructive text-sm mt-2">{error}</p>}
    </div>
  );
}