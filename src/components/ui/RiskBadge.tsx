import { cn } from '@/lib/utils';
import { RiskLevel } from '@/types/tprm';

interface RiskBadgeProps {
  level: RiskLevel;
  score?: number;
  showScore?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const riskConfig: Record<RiskLevel, { label: string; className: string }> = {
  low: {
    label: 'Low Risk',
    className: 'bg-success/10 text-success border-success/20',
  },
  medium: {
    label: 'Medium Risk',
    className: 'bg-warning/10 text-warning border-warning/20',
  },
  high: {
    label: 'High Risk',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
  critical: {
    label: 'Critical Risk',
    className: 'bg-risk-critical/10 text-risk-critical border-risk-critical/20',
  },
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-1.5 text-base',
};

export function RiskBadge({ level, score, showScore = false, size = 'md', className }: RiskBadgeProps) {
  const config = riskConfig[level];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full border',
        config.className,
        sizeClasses[size],
        className
      )}
    >
      <span className={cn(
        'w-2 h-2 rounded-full',
        level === 'low' && 'bg-success',
        level === 'medium' && 'bg-warning',
        level === 'high' && 'bg-destructive',
        level === 'critical' && 'bg-risk-critical'
      )} />
      {showScore && score !== undefined ? `${score}%` : config.label}
    </span>
  );
}
