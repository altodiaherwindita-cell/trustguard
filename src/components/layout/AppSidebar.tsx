import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, Building2, ClipboardList, Bot, Settings, Shield,
  ChevronLeft, ChevronRight, LogOut,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isTPRM, isAdmin, signOut, loading } = useAuth();
  
  // Show a minimal sidebar while auth is loading to prevent layout shift
  if (loading) {
    return (
      <aside className="relative flex flex-col bg-sidebar border-r border-sidebar-border h-screen w-[280px]">
        <div className="flex items-center gap-3 p-6 border-b border-sidebar-border">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sidebar-primary">
            <Shield className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold text-sidebar-foreground">TrustGuard</span>
            <span className="text-xs text-sidebar-foreground/60">TPRM Platform</span>
          </div>
        </div>
        <div className="flex-1 p-4 space-y-1">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 bg-sidebar-accent rounded-lg opacity-50" />
            ))}
          </div>
        </div>
      </aside>
    );
  }

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, show: true },
    { name: 'Vendors', href: '/vendors', icon: Building2, show: isTPRM },
    { name: 'Assessments', href: '/assessments', icon: ClipboardList, show: isTPRM },
    { name: 'Questionnaires', href: '/questionnaires', icon: FileText, show: isTPRM },
    { name: 'AI Assistant', href: '/ai-assistant', icon: Bot, show: isTPRM },
    { name: 'Settings', href: '/settings', icon: Settings, show: true },
  ].filter(n => n.show);

  const initials = (user?.email || '??').slice(0, 2).toUpperCase();

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="relative flex flex-col bg-sidebar border-r border-sidebar-border h-screen"
    >
      <div className="flex items-center gap-3 p-6 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sidebar-primary">
          <Shield className="w-5 h-5 text-sidebar-primary-foreground" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col">
              <span className="text-lg font-bold text-sidebar-foreground">TrustGuard</span>
              <span className="text-xs text-sidebar-foreground/60">TPRM Platform</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="font-medium">
                    {item.name}
                  </motion.span>
                )}
              </AnimatePresence>
            </NavLink>
          );
        })}
      </nav>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 flex items-center justify-center w-6 h-6 rounded-full bg-sidebar-primary text-sidebar-primary-foreground shadow-md hover:scale-110 transition-transform"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      <div className="p-4 border-t border-sidebar-border space-y-2">
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-sidebar-accent">
          <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground text-sm font-medium">
            {initials}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-sidebar-foreground truncate">{user?.email}</span>
                <span className="text-xs text-sidebar-foreground/60">{isAdmin ? 'Admin' : isTPRM ? 'TPRM Analyst' : 'Vendor'}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button
          onClick={async () => { await signOut(); navigate('/auth'); }}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span className="text-sm">Sign out</span>}
        </button>
      </div>
    </motion.aside>
  );
}
