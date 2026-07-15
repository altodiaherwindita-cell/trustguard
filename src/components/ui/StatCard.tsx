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
  variant?: 'default' | 'primary' | 'critical' | 'warning' | 'success' | 'info';
  className?: string;
}

const variantStyles = {
  default: 'bg-card border-border',
  primary: 'bg-gradient-to-br from-primary/5 via-primary/2 to-primary/5 border-primary/20',
  critical: 'bg-gradient-to-br from-destructive/5 via-destructive/2 to-destructive/5 border-destructive/20',
  warning: 'bg-gradient-to-br from-warning/5 via-warning/2 to-warning/5 border-warning/20',
  success: 'bg-gradient-to-br from-success/5 via-success/2 to-success/5 border-success/20',
  info: 'bg-gradient-to-br from-info/5 via-info/2 to-info/5 border-info/20',
};

const iconStyles = {
  default: 'bg-muted/50 text-muted-foreground',
  primary: 'bg-gradient-to-br from-primary/20 to-primary/10 text-primary',
  critical: 'bg-gradient-to-br from-destructive/20 to-destructive/10 text-destructive',
  warning: 'bg-gradient-to-br from-warning/20 to-warning/10 text-warning',
  success: 'bg-gradient-to-br from-success/20 to-success/10 text-success',
  info: 'bg-gradient-to-br from-info/20 to-info/10 text-info',
};

const titleStyles = {
  default: 'text-muted-foreground',
  primary: 'text-primary',
  critical: 'text-destructive',
  warning: 'text-warning',
  success: 'text-success',
  info: 'text-info',
};

const valueStyles = {
  default: 'text-foreground',
  primary: 'bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent',
  critical: 'bg-gradient-to-r from-destructive via-destructive/80 to-destructive bg-clip-text text-transparent',
  warning: 'bg-gradient-to-r from-warning via-warning/80 to-warning bg-clip-text text-transparent',
  success: 'bg-gradient-to-r from-success via-success/80 to-success bg-clip-text text-transparent',
  info: 'bg-gradient-to-r from-info via-info/80 to-info bg-clip-text text-transparent',
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.random() * 0.1 }}
      className={cn(
        'relative overflow-hidden rounded-2xl border p-6 shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5',
        variantStyles[variant],
        className
      )}
    >
      {/* Decorative accent line */}
      <div
        className={cn(
          'absolute top-0 left-0 right-0 h-px opacity-0 hover:opacity-100 transition-opacity duration-300',
          variant === 'default' && 'bg-gradient-to-r from-transparent via-border to-transparent',
          variant !== 'default' && `bg-gradient-to-r from-transparent via-${variant}/60 to-transparent`
        )}
      />

      <div className="flex items-start justify-between relative z-10">
        <div className="space-y-2 pr-4">
          <p className={cn('text-sm font-medium', titleStyles[variant])}>{title}</p>
          <div className="flex items-baseline gap-2">
            <p className={cn('text-3xl font-bold tracking-tight', valueStyles[variant])}>{value}</p>
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