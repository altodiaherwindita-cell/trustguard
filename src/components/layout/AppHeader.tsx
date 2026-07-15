import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  Bell, Search, Shield, Menu, Sun, Moon, LogOut, User,
  ChevronDown, AlertCircle, CheckCircle2, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const QUICK_ACTIONS = [
  { label: 'Add Vendor', href: '/vendors', icon: Shield, show: true },
  { label: 'Create Assessment', href: '/assessments', icon: CheckCircle2, show: true },
  { label: 'Review Pending', href: '/assessments?status=submitted', icon: Clock, show: true },
];

const NOTIFICATIONS = [
  { id: 1, type: 'warning', title: 'High risk vendor detected', time: '5m ago', read: false },
  { id: 2, type: 'success', title: 'Assessment approved', time: '1h ago', read: false },
  { id: 3, type: 'info', title: 'New evidence uploaded', time: '3h ago', read: true },
  { id: 4, type: 'info', title: 'Remediation due tomorrow', time: '6h ago', read: true },
];

export function AppHeader() {
  const location = useLocation();
  const { user, isTPRM, isAdmin, signOut } = useAuth();

  const initials = (user?.email || '??').slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-40 h-16 glass-strong border-b border-card-border/50">
      <div className="flex h-full items-center justify-between px-6">
        {/* Left: Breadcrumbs / Page Title */}
        <div className="flex items-center gap-4 min-w-0">
          <nav className="hidden md:flex items-center gap-2 text-sm" aria-label="Breadcrumb">
            <Link
              to="/"
              className={cn(
                'px-3 py-1.5 rounded-lg transition-colors',
                location.pathname === '/'
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              Dashboard
            </Link>
            {location.pathname !== '/' && (
              <>
                <ChevronDown className="w-4 h-4 text-muted-foreground/50" />
                <span className="px-3 py-1.5 text-foreground font-medium capitalize">
                  {location.pathname.split('/')[1]?.replace('-', ' ')}
                </span>
              </>
            )}
          </nav>
        </div>

        {/* Center: Quick Actions (TPRM/Admin only) */}
        <AnimatePresence mode="wait">
          {isTPRM && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2"
            >
              {QUICK_ACTIONS.map((action) => (
                <Link key={action.label} to={action.href} className="hidden sm:flex">
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'gap-1.5 h-9 px-3 transition-all',
                      location.pathname === action.href
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'hover:bg-muted'
                    )}
                  >
                    <action.icon className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">{action.label}</span>
                  </Button>
                </Link>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right: Search, Notifications, User */}
        <div className="flex items-center gap-3 ml-auto">
          {/* Global Search */}
          <div className="relative hidden lg:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
            <input
              type="search"
              placeholder="Search vendors, assessments..."
              className="w-64 h-9 pl-10 pr-4 rounded-lg bg-muted/50 border border-border/50 text-sm
                placeholder:text-muted-foreground/50
                focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
                transition-all"
              aria-label="Global search"
            />
          </div>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-10 w-10 rounded-xl"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive animate-pulse-dot" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 glass-strong p-0">
              <div className="p-4 border-b border-border/50 flex items-center justify-between">
                <DropdownMenuLabel className="font-medium">Notifications</DropdownMenuLabel>
                <Button variant="ghost" size="sm" className="text-xs">Mark all read</Button>
              </div>
              <div className="max-h-96 overflow-auto">
                {NOTIFICATIONS.map((notif) => (
                  <DropdownMenuItem
                    key={notif.id}
                    className={cn(
                      'p-3 gap-3 hover:bg-muted/50',
                      !notif.read && 'bg-muted/30'
                    )}
                    onSelect={() => {}}
                  >
                    <div
                      className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                        notif.type === 'warning' && 'bg-destructive/10 text-destructive',
                        notif.type === 'success' && 'bg-success/10 text-success',
                        notif.type === 'info' && 'bg-primary/10 text-primary'
                      )}
                    >
                      {notif.type === 'warning' && <AlertCircle className="w-4 h-4" />}
                      {notif.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
                      {notif.type === 'info' && <Clock className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium', !notif.read && 'font-semibold')}>
                        {notif.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{notif.time}</p>
                    </div>
                    {!notif.read && (
                      <span className="w-2 h-2 rounded-full bg-primary animate-pulse-dot" />
                    )}
                  </DropdownMenuItem>
                ))}
              </div>
              <div className="p-3 border-t border-border/50 text-center">
                <Button variant="ghost" size="sm" className="w-full text-xs">
                  View all notifications
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Theme Toggle (placeholder for future) */}
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" aria-label="Toggle theme">
            <Sun className="w-5 h-5 rotate-0 transition-transform" />
            <Moon className="w-5 h-5 -rotate-90 transition-transform" />
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 h-10 rounded-xl pr-3 pl-2">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user?.avatar_url || ''} alt={user?.full_name || ''} />
                  <AvatarFallback className="text-xs font-medium bg-primary text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:block text-sm font-medium">{user?.full_name || user?.email}</span>
                <ChevronDown className="w-4 h-4 hidden sm:block text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 glass-strong">
              <DropdownMenuLabel className="font-medium">Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/settings" className="flex items-center gap-2 w-full">
                  <User className="w-4 h-4" />
                  Profile & Settings
                </Link>
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem asChild>
                  <Link to="/users" className="flex items-center gap-2 w-full">
                    <Shield className="w-4 h-4" />
                    User Management
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => { await signOut(); }}
                className="text-destructive focus:text-destructive flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}