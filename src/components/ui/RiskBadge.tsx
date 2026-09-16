import { cn } from '@/lib/utils';
import { RiskLevel } from '@/types/tprm';

interface RiskBadgeProps {
  level: RiskLevel;
  score?: number;
  showScore?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const riskConfig: Record<RiskLevel, { label: string; dotClass: string; textClass: string }> = {
  low: {
    label: 'Low Risk',
    dotClass: 'risk-dot-low',
    textClass: 'text-success',
  },
  medium: {
    label: 'Medium Risk',
    dotClass: 'risk-dot-medium',
    textClass: 'text-warning',
  },
  high: {
    label: 'High Risk',
    dotClass: 'risk-dot-high',
    textClass: 'text-destructive',
  },
  critical: {
    label: 'Critical Risk',
    dotClass: 'risk-dot-critical',
    textClass: 'text-[rgb(var(--color-risk-critical))]',
  },
};

const sizeClasses = {
  sm: { gap: 'gap-1.5', padding: 'px-2.5 py-1', text: 'text-xs', dot: 'w-1.5 h-1.5' },
  md: { gap: 'gap-2', padding: 'px-3 py-1.5', text: 'text-sm', dot: 'w-2 h-2' },
  lg: { gap: 'gap-2.5', padding: 'px-4 py-2', text: 'text-base', dot: 'w-2.5 h-2.5' },
};

export function RiskBadge({ level, score, showScore = false, size = 'md', className }: RiskBadgeProps) {
  const config = riskConfig[level];
  const sizes = sizeClasses[size];

  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold rounded-full border',
        config.dotClass,
        config.textClass,
        'border-[rgb(var(--color-cyan))]/20 bg-[rgb(var(--color-cyan))]/5',
        sizes.padding,
        sizes.gap,
        className
      )}
    >
      <span className={sizes.dot} aria-hidden="true" />
      <span className={sizes.text}>
        {showScore && score !== undefined ? `${score}%` : config.label}
      </span>
    </span>
  );
}