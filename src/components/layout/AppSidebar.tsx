'use client';

import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, Building2, ClipboardList, FileText, FolderOpen,
  Activity, Users, Bot, Settings, Shield, ChevronLeft, ChevronRight,
  LogOut, AlertTriangle, TrendingUp, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const RISK_LEVELS = ['critical', 'high', 'medium', 'low'] as const;
const RISK_COLORS = {
  critical: 'risk-dot-critical',
  high: 'risk-dot-high',
  medium: 'risk-dot-medium',
  low: 'risk-dot-low',
};

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isTPRM, isAdmin, signOut, loading } = useAuth();

  // Show skeleton while auth is loading to prevent layout shift
  if (loading) {
    return (
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 80 : 280 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="relative flex flex-col bg-card border-r border-card-border h-screen rail-width"
      >
        <div className="flex items-center gap-3 p-6 border-b border-card-border/50">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold text-foreground">TrustGuard</span>
            <span className="text-xs text-muted-foreground">TPRM Platform</span>
          </div>
        </div>
        <div className="flex-1 p-4 space-y-1">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 bg-muted/50 rounded-lg opacity-50" />
            ))}
          </div>
        </div>
        <div className="p-4 border-t border-card-border/50 space-y-2">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-muted" />
              <div className="w-20 h-4 rounded bg-muted" />
            </div>
          </div>
          <div className="w-full h-10 rounded-lg bg-muted/50" />
        </div>
      </motion.aside>
    );
  }

  const initials = (user?.email || '??').slice(0, 2).toUpperCase();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, show: true, badge: null },
    { name: 'Vendors', href: '/vendors', icon: Building2, show: isTPRM, badge: null },
    { name: 'Assessments', href: '/assessments', icon: ClipboardList, show: isTPRM, badge: '5' },
    { name: 'Questionnaires', href: '/questionnaires', icon: FileText, show: isTPRM, badge: null },
    { name: 'Evidence', href: '/evidence', icon: FolderOpen, show: true, badge: null },
    { name: 'Remediation', href: '/remediation', icon: AlertTriangle, show: isTPRM, badge: '12' },
    { name: 'Audit Logs', href: '/audit-logs', icon: Activity, show: isAdmin, badge: null },
    { name: 'AI Assistant', href: '/ai-assistant', icon: Bot, show: isTPRM, badge: null },
    { name: 'Settings', href: '/settings', icon: Settings, show: true, badge: null },
  ].filter(n => n.show);

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="relative flex flex-col bg-card border-r border-card-border h-screen rail-width overflow-hidden"
    >
      {/* Brand Header */}
      <div className="flex items-center gap-3 p-6 border-b border-card-border/50">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="flex flex-col overflow-hidden"
            >
              <span className="text-lg font-bold text-foreground whitespace-nowrap">TrustGuard</span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">TPRM Platform</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto" aria-label="Main navigation">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={cn(
                'relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                collapsed && 'justify-center px-3'
              )}
              aria-current={isActive ? 'page' : undefined}
              title={collapsed ? item.name : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              <AnimatePresence mode="wait">
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="font-medium whitespace-nowrap"
                  >
                    {item.name}
                  </motion.span>
                )}
              </AnimatePresence>
              {!collapsed && item.badge && (
                <span className="ml-auto px-2 py-0.5 text-xs font-semibold rounded-full bg-primary/20 text-primary">
                  {item.badge}
                </span>
              )}
              {isActive && !collapsed && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: 3 }}
                  exit={{ width: 0 }}
                  className="absolute left-0 top-0 bottom-0 bg-primary rounded-l-xl"
                />
              )}
            </NavLink>
          );
        })}

        {/* Quick Actions Section */}
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="pt-4 mt-2 border-t border-card-border/50"
            >
              <p className="px-4 text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-2">
                Quick Actions
              </p>
              <div className="space-y-1">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 text-left px-4 py-2.5 rounded-xl hover:bg-primary/5 hover:text-primary"
                  onClick={() => navigate('/vendors')}
                >
                  <Building2 className="w-4 h-4" />
                  <span>Add Vendor</span>
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 text-left px-4 py-2.5 rounded-xl hover:bg-primary/5 hover:text-primary"
                  onClick={() => navigate('/assessments')}
                >
                  <ClipboardList className="w-4 h-4" />
                  <span>Create Assessment</span>
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 text-left px-4 py-2.5 rounded-xl hover:bg-primary/5 hover:text-primary"
                  onClick={() => navigate('/questionnaires')}
                >
                  <FileText className="w-4 h-4" />
                  <span>New Questionnaire</span>
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary shadow-lg hover:bg-primary/20 hover:scale-110 transition-transform"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!collapsed}
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {/* Bottom: Risk Pulse + User */}
      <div className="p-4 border-t border-card-border/50 space-y-4">
        {/* Risk Pulse - The Signature Element */}
        <div className="relative">
          {!collapsed && (
            <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-3">
              Organization Risk Pulse
            </p>
          )}
          <div className="relative">
            {/* Pulse Ring Container */}
            <div className="relative w-20 h-20 mx-auto">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
                {/* Background track */}
                <circle
                  cx="40"
                  cy="40"
                  r="32"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-muted/20"
                />
                {/* Progress ring */}
                <motion.circle
                  cx="40"
                  cy="40"
                  r="32"
                  fill="none"
                  stroke="url(#pulse-gradient)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={201}
                  strokeDashoffset={201 * 0.34}
                  className="text-primary"
                  style={{ filter: 'drop-shadow(0 0 8px hsl(var(--primary) / 0.5))' }}
                  initial={{ strokeDashoffset: 201 }}
                  animate={{ strokeDashoffset: 201 * 0.34 }}
                  transition={{ duration: 1.5, ease: 'easeOut' }}
                />
                {/* Pulsing indicator dot */}
                <motion.circle
                  cx="40"
                  cy="8"
                  r="6"
                  fill="hsl(var(--primary))"
                  className="animate-pulse-ring"
                  style={{ filter: 'drop-shadow(0 0 8px hsl(var(--primary)))', transformOrigin: '40px 40px' }}
                />
              </svg>
              <defs>
                <linearGradient id="pulse-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="hsl(var(--primary))" />
                  <stop offset="100%" stopColor="hsl(var(--primary) / 0.6)" />
                </linearGradient>
              </defs>

              {/* Center content */}
              <div className="absolute inset-0 flex items-center justify-center">
                {!collapsed ? (
                  <div className="text-center">
                    <span className="tabular-nums text-2xl font-bold text-foreground">66%</span>
                    <p className="caption text-muted-foreground mt-1">Assessed</p>
                  </div>
                ) : (
                  <div className="text-center" title="66% Assessed">
                    <span className="tabular-nums text-lg font-bold text-foreground">66%</span>
                  </div>
                )}
              </div>
            </div>

            {/* Risk Distribution Bar */}
            {!collapsed && (
              <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full flex"
                  style={{
                    background: 'linear-gradient(90deg, hsl(var(--destructive)) 0%, hsl(var(--destructive)) 8%, hsl(var(--warning)) 8%, hsl(var(--warning)) 23%, hsl(var(--ring)) 23%, hsl(var(--ring)) 58%, hsl(var(--success)) 58%, hsl(var(--success)) 100%)'
                  }}
                >
                  <div className="flex h-full" style={{ width: '8%' }}>
                    <div className="w-full h-full bg-[hsl(var(--destructive))]" />
                  </div>
                  <div className="flex h-full" style={{ width: '15%' }}>
                    <div className="w-full h-full bg-[hsl(var(--warning))]" />
                  </div>
                  <div className="flex h-full" style={{ width: '35%' }}>
                    <div className="w-full h-full bg-[hsl(var(--ring))]" />
                  </div>
                  <div className="flex h-full" style={{ width: '42%' }}>
                    <div className="w-full h-full bg-[hsl(var(--success))]" />
                  </div>
                </div>
              </div>
            )}

            {/* Legend */}
            {!collapsed && (
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                {RISK_LEVELS.map((level) => (
                  <div key={level} className="flex items-center justify-center gap-1.5">
                    <span className={cn('risk-dot', RISK_COLORS[level])} />
                    <span className="caption text-muted-foreground capitalize">{level}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* User Profile */}
        <div className="relative">
          <button
            onClick={async () => { await signOut(); navigate('/auth'); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            title="Sign out"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-medium">
              {initials}
            </div>
            <AnimatePresence mode="wait">
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex flex-col min-w-0 flex-1"
                >
                  <span className="text-sm font-medium text-foreground truncate">{user?.email}</span>
                  <span className="micro text-muted-foreground">
                    {isAdmin ? 'Administrator' : isTPRM ? 'TPRM Analyst' : 'Vendor'}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
            <LogOut className="w-5 h-5 flex-shrink-0 opacity-50" />
          </button>
        </div>
      </div>
    </motion.aside>
  );
}