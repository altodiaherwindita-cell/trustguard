import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'critical' | 'warning' | 'success';
  className?: string;
}

const variantStyles = {
  default: 'bg-card border-border',
  primary: 'bg-card border-primary/20',
  critical: 'bg-card border-destructive/20',
  warning: 'bg-card border-warning/20',
  success: 'bg-card border-success/20',
};

const iconStyles = {
  default: 'bg-muted/50 text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  critical: 'bg-destructive/10 text-destructive',
  warning: 'bg-warning/10 text-warning',
  success: 'bg-success/10 text-success',
};

const titleStyles = {
  default: 'text-muted-foreground',
  primary: 'text-primary',
  critical: 'text-destructive',
  warning: 'text-warning',
  success: 'text-success',
};

const valueStyles = {
  default: 'text-foreground',
  primary: 'text-primary',
  critical: 'text-destructive',
  warning: 'text-warning',
  success: 'text-success',
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  className,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        'relative overflow-hidden rounded-2xl border p-6 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start justify-between relative z-10">
        <div className="space-y-2 pr-4">
          <p className={cn('text-sm font-medium', titleStyles[variant])}>{title}</p>
          <div className="flex items-baseline gap-2">
            <p className={cn('tabular-nums text-3xl font-bold tracking-tight', valueStyles[variant])}>{value}</p>
            {trend && (
              <span
                className={cn(
                  'text-sm font-medium flex items-center gap-1',
                  trend.isPositive ? 'text-success' : 'text-destructive'
                )}
              >
                <span className="text-xs" aria-hidden="true">{trend.isPositive ? '▲' : '▼'}</span>
                <span>{trend.isPositive ? '+' : ''}{trend.value}%</span>
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground/70">{subtitle}</p>
          )}
        </div>
        <div className={cn('rounded-xl p-3 shrink-0', iconStyles[variant])}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </motion.div>
  );
}