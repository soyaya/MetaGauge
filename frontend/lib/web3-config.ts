import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { mainnet, sepolia } from 'wagmi/chains'
import { http } from 'wagmi'

// Define Lisk Sepolia chain
export const liskSepolia = {
  id: 4202,
  name: 'Lisk Sepolia Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Sepolia Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.sepolia-api.lisk.com'],
    },
    public: {
      http: ['https://rpc.sepolia-api.lisk.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Lisk Sepolia Explorer',
      url: 'https://sepolia-blockscout.lisk.com',
    },
  },
  testnet: true,
} as const

// Define Lisk Mainnet chain
export const lisk = {
  id: 1135,
  name: 'Lisk',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.api.lisk.com'],
    },
    public: {
      http: ['https://rpc.api.lisk.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Lisk Explorer',
      url: 'https://blockscout.lisk.com',
    },
  },
  testnet: false,
} as const

// Contract addresses - update these with your deployed contract addresses
export const CONTRACT_ADDRESSES = {
  // Testnet addresses (Lisk Sepolia)
  testnet: {
    MGT_TOKEN: process.env.NEXT_PUBLIC_MGT_TOKEN_TESTNET || '0xB51623F59fF9f2AA7d3bC1Afa99AE0fA8049ed3D',
    SUBSCRIPTION: process.env.NEXT_PUBLIC_SUBSCRIPTION_TESTNET || '0x577d9A43D0fa564886379bdD9A56285769683C38',
  },
  // Mainnet addresses
  mainnet: {
    MGT_TOKEN: process.env.NEXT_PUBLIC_MGT_TOKEN_MAINNET || '0x...',
    SUBSCRIPTION: process.env.NEXT_PUBLIC_SUBSCRIPTION_MAINNET || '0x...',
  }
}

// RainbowKit configuration with fallback
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

// Check if we have a valid project ID
const hasValidProjectId = projectId && 
  projectId !== 'your_walletconnect_project_id' && 
  projectId !== 'YOUR_PROJECT_ID' &&
  projectId.length > 10;

export const wagmiConfig = getDefaultConfig({
  appName: 'MetaGauge',
  projectId: hasValidProjectId ? projectId : 'fallback-project-id-for-development',
  chains: [liskSepolia, lisk, mainnet, sepolia],
  ssr: true,
  storage: typeof window !== 'undefined' ? {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  } : undefined,
})

// Subscription tiers matching your smart contract
export enum SubscriptionTier {
  Free = 0,
  Starter = 1,
  Pro = 2,
  Enterprise = 3
}

export enum BillingCycle {
  Monthly = 0,
  Yearly = 1
}

export enum UserRole {
  Startup = 0,
  Researcher = 1,
  Admin = 2
}

export enum PaymentCurrency {
  ETH = 0,
  USDC = 1,
  LSK = 2,
  NATIVE = 3,
  Token = 4
}

// Plan configurations matching your smart contract
export const SUBSCRIPTION_PLANS = {
  [SubscriptionTier.Free]: {
    name: 'Free',
    monthlyPrice: '0',
    yearlyPrice: '0',
    features: {
      apiCallsPerMonth: 100,
      maxProjects: 1,
      maxAlerts: 3,
      exportAccess: false,
      comparisonTool: false,
      walletIntelligence: false,
      apiAccess: false,
      prioritySupport: false,
      customInsights: false
    }
  },
  [SubscriptionTier.Starter]: {
    name: 'Starter',
    monthlyPrice: '12', // 12 MGT
    yearlyPrice: '120', // 120 MGT (10 months price)
    features: {
      apiCallsPerMonth: 1000,
      maxProjects: 3,
      maxAlerts: 10,
      exportAccess: true,
      comparisonTool: true,
      walletIntelligence: false,
      apiAccess: false,
      prioritySupport: false,
      customInsights: false
    }
  },
  [SubscriptionTier.Pro]: {
    name: 'Pro',
    monthlyPrice: '20', // 20 MGT
    yearlyPrice: '200', // 200 MGT (10 months price)
    features: {
      apiCallsPerMonth: 5000,
      maxProjects: 10,
      maxAlerts: 50,
      exportAccess: true,
      comparisonTool: true,
      walletIntelligence: true,
      apiAccess: true,
      prioritySupport: false,
      customInsights: false
    }
  },
  [SubscriptionTier.Enterprise]: {
    name: 'Enterprise',
    monthlyPrice: '400', // 400 MGT
    yearlyPrice: '4000', // 4000 MGT (10 months price)
    features: {
      apiCallsPerMonth: 50000,
      maxProjects: 100,
      maxAlerts: 500,
      exportAccess: true,
      comparisonTool: true,
      walletIntelligence: true,
      apiAccess: true,
      prioritySupport: true,
      customInsights: true
    }
  }
}

// Helper functions
export const isTestnet = (chainId: number) => {
  return chainId === liskSepolia.id || chainId === sepolia.id
}

export const isLiskNetwork = (chainId: number) => {
  return chainId === liskSepolia.id || chainId === lisk.id
}

export const getContractAddresses = (chainId: number) => {
  return isTestnet(chainId) ? CONTRACT_ADDRESSES.testnet : CONTRACT_ADDRESSES.mainnet
}

export const formatTokenAmount = (amount: string, decimals: number = 18) => {
  return parseFloat(amount) / Math.pow(10, decimals)
}

export const parseTokenAmount = (amount: string, decimals: number = 18) => {
  return (parseFloat(amount) * Math.pow(10, decimals)).toString()
}

// Network validation
export const validateNetwork = (chainId: number) => {
  if (!isLiskNetwork(chainId)) {
    throw new Error('Please switch to Lisk Sepolia Testnet to use MetaGauge subscriptions')
  }
  return true
}

// Get block explorer URL for transaction
export const getExplorerUrl = (chainId: number, txHash: string) => {
  if (chainId === liskSepolia.id) {
    return `https://sepolia-blockscout.lisk.com/tx/${txHash}`
  } else if (chainId === lisk.id) {
    return `https://blockscout.lisk.com/tx/${txHash}`
  }
  return `https://sepolia-blockscout.lisk.com/tx/${txHash}` // Default to Lisk Sepolia
}