const EXPLORERS: Record<number, { url: string; name: string }> = {
  1:        { url: 'https://etherscan.io/tx',        name: 'Etherscan' },
  11155111: { url: 'https://sepolia.etherscan.io/tx', name: 'Sepolia Etherscan' },
}

export function getExplorerUrl(chainId: number, txHash: string): string {
  const base = EXPLORERS[chainId]?.url ?? 'https://etherscan.io/tx'
  return `${base}/${txHash}`
}

export function getExplorerName(chainId: number): string {
  return EXPLORERS[chainId]?.name ?? 'Block Explorer'
}
