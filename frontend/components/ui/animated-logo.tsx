/**
 * Animated MetaGauge Logo Component
 * Displays animated waving effect for loading states
 */

import { cn } from '@/lib/utils';

interface AnimatedLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'wave' | 'pulse' | 'spin' | 'bounce';
  className?: string;
  showText?: boolean;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
};

const textSizeClasses = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
};

export function AnimatedLogo({ 
  size = 'md', 
  variant = 'wave', 
  className,
  showText = false 
}: AnimatedLogoProps) {
  const getAnimationClass = () => {
    switch (variant) {
      case 'wave':
        return 'animate-wave';
      case 'pulse':
        return 'animate-pulse';
      case 'spin':
        return 'animate-spin';
      case 'bounce':
        return 'animate-bounce';
      default:
        return 'animate-wave';
    }
  };

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className={cn(
        'relative flex items-center justify-center',
        sizeClasses[size],
        getAnimationClass()
      )}>
        {/* MetaGauge Logo SVG */}
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Gradient Definitions */}
          <defs>
            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="50%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge> 
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          {/* Outer Ring */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="url(#logoGradient)"
            strokeWidth="3"
            opacity="0.3"
          />
          
          {/* Inner Gauge Arc */}
          <path
            d="M 20 50 A 30 30 0 1 1 80 50"
            fill="none"
            stroke="url(#logoGradient)"
            strokeWidth="4"
            strokeLinecap="round"
            filter="url(#glow)"
          />
          
          {/* Gauge Needle */}
          <line
            x1="50"
            y1="50"
            x2="75"
            y2="35"
            stroke="url(#logoGradient)"
            strokeWidth="3"
            strokeLinecap="round"
            filter="url(#glow)"
          />
          
          {/* Center Dot */}
          <circle
            cx="50"
            cy="50"
            r="4"
            fill="url(#logoGradient)"
            filter="url(#glow)"
          />
          
          {/* Data Points */}
          <circle cx="25" cy="35" r="2" fill="url(#logoGradient)" opacity="0.7" />
          <circle cx="75" cy="35" r="2" fill="url(#logoGradient)" opacity="0.7" />
          <circle cx="35" cy="70" r="2" fill="url(#logoGradient)" opacity="0.7" />
          <circle cx="65" cy="70" r="2" fill="url(#logoGradient)" opacity="0.7" />
        </svg>
        
        {/* Animated Particles */}
        {variant === 'wave' && (
          <>
            <div className="absolute inset-0 animate-ping opacity-20">
              <div className="w-full h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500" />
            </div>
            <div className="absolute inset-2 animate-pulse opacity-30">
              <div className="w-full h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-500" />
            </div>
          </>
        )}
      </div>
      
      {showText && (
        <div className="flex flex-col">
          <span className={cn(
            'font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent',
            textSizeClasses[size]
          )}>
            MetaGauge
          </span>
          <span className={cn(
            'text-muted-foreground',
            size === 'sm' ? 'text-xs' : 
            size === 'md' ? 'text-sm' : 
            size === 'lg' ? 'text-base' : 'text-lg'
          )}>
            Analytics
          </span>
        </div>
      )}
    </div>
  );
}

// Loading state component with animated logo
export function LoadingWithLogo({ 
  message = "Loading...", 
  size = 'lg',
  className 
}: { 
  message?: string; 
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-4 p-8', className)}>
      <AnimatedLogo size={size} variant="wave" />
      <div className="text-center">
        <p className="text-lg font-medium text-foreground">{message}</p>
        <p className="text-sm text-muted-foreground mt-1">
          Analyzing contract interactions...
        </p>
      </div>
    </div>
  );
}

// Marathon sync specific loading component
export function MarathonSyncLoader({ 
  progress = 0,
  cycle = 0,
  transactions = 0,
  users = 0,
  cycleStartTime = null,
  estimatedDuration = null,
  cyclesCompleted = 0,
  className,
  onRefresh
}: {
  progress?: number;
  cycle?: number;
  transactions?: number;
  users?: number;
  cycleStartTime?: string | null;
  estimatedDuration?: string | null;
  cyclesCompleted?: number;
  className?: string;
  onRefresh?: () => void;
}) {
  // Calculate cycle elapsed time
  const cycleElapsed = cycleStartTime ? 
    Math.floor((Date.now() - new Date(cycleStartTime).getTime()) / 1000) : 0;
  
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className={cn('flex flex-col items-center justify-center gap-6 p-8', className)}>
      <AnimatedLogo size="xl" variant="wave" showText />
      
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold text-foreground">
          Marathon Sync Active
        </h3>
        <p className="text-muted-foreground">
          Continuously analyzing contract interactions
        </p>
        {cycleStartTime && (
          <p className="text-sm text-muted-foreground">
            Current cycle: {formatTime(cycleElapsed)} elapsed
            {estimatedDuration && ` • ${estimatedDuration} estimated`}
          </p>
        )}
      </div>
      
      <div className="w-full max-w-md space-y-3">
        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-sm">
            <span>Progress</span>
            <div className="flex items-center gap-2">
              <span>{progress}%</span>
              {progress === 30 && onRefresh && (
                <button
                  onClick={onRefresh}
                  className="text-xs px-2 py-1 bg-secondary hover:bg-secondary/80 rounded border text-muted-foreground hover:text-foreground transition-colors"
                >
                  Refresh
                </button>
              )}
            </div>
          </div>
          <div className="w-full bg-secondary rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 text-center">
          <div className="space-y-1">
            <p className="text-lg font-bold text-blue-600">{cycle}</p>
            <p className="text-xs text-muted-foreground">Current</p>
          </div>
          <div className="space-y-1">
            <p className="text-lg font-bold text-green-600">{cyclesCompleted}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </div>
          <div className="space-y-1">
            <p className="text-lg font-bold text-purple-600">{transactions.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Transactions</p>
          </div>
          <div className="space-y-1">
            <p className="text-lg font-bold text-cyan-600">{users.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Users</p>
          </div>
        </div>
        
        {/* Cycle Info */}
        {cycle > 0 && (
          <div className="text-center text-xs text-muted-foreground bg-secondary/50 rounded-lg p-2">
            <p>Cycle {cycle} • {cyclesCompleted} completed • ~30s per cycle</p>
            <p>Marathon sync runs until you click stop (max 200 cycles)</p>
          </div>
        )}
      </div>
    </div>
  );
}