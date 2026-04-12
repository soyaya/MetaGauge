const EXPLORERS: Record<number, string> = {
  1: 'https://etherscan.io/tx',
  11155111: 'https://sepolia.etherscan.io/tx',
}

export function getExplorerUrl(chainId: number, txHash: string): string {
  const base = EXPLORERS[chainId] ?? 'https://etherscan.io/tx'
  return `${base}/${txHash}`
}
