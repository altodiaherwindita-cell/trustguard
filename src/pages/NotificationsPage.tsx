import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { notificationsApi, type Notification } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, Check, CheckCheck, Filter } from 'lucide-react';
import { format } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const { toast } = useToast();

  useEffect(() => {
    loadNotifications();
    loadUnreadCount();
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(() => {
      loadUnreadCount();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    const result = await notificationsApi.getAll(50, 0, filter === 'unread');
    if (result.data) {
      setNotifications(result.data.notifications);
      setUnreadCount(result.data.unreadCount);
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to load notifications',
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

  const loadUnreadCount = async () => {
    const result = await notificationsApi.getUnreadCount();
    if (result.data) {
      setUnreadCount(result.data.unreadCount);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    const result = await notificationsApi.markAsRead(id);
    if (result.data) {
      loadNotifications();
      loadUnreadCount();
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to mark notification as read',
        variant: 'destructive',
      });
    }
  };

  const handleMarkAllAsRead = async () => {
    const result = await notificationsApi.markAllAsRead();
    if (result.data) {
      toast({
        title: 'Success',
        description: result.data.message,
      });
      loadNotifications();
      loadUnreadCount();
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to mark all as read',
        variant: 'destructive',
      });
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Bell className="h-4 w-4 text-red-500" />;
      case 'high':
        return <Bell className="h-4 w-4 text-orange-500" />;
      case 'normal':
        return <Bell className="h-4 w-4 text-blue-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'success':
        return <Badge className="bg-green-500">Success</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500">Warning</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">Info</Badge>;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'security':
        return 'border-l-4 border-l-red-500';
      case 'remediation':
        return 'border-l-4 border-l-orange-500';
      case 'assessment':
        return 'border-l-4 border-l-blue-500';
      case 'evidence':
        return 'border-l-4 border-l-purple-500';
      default:
        return 'border-l-4 border-l-gray-500';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">Stay updated with your alerts and messages</p>
        </div>
        <div className="flex gap-2 items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                {filter === 'all' ? 'All' : 'Unread'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => { setFilter('all'); loadNotifications(); }}>
                All Notifications
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setFilter('unread'); loadNotifications(); }}>
                Unread Only
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {unreadCount > 0 && (
            <Button variant="outline" onClick={handleMarkAllAsRead}>
              <CheckCheck className="mr-2 h-4 w-4" />
              Mark All Read
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{notifications.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unread</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-500">{unreadCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Read</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-500">{notifications.length - unreadCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Notifications List */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            {loading ? 'Loading...' : `${notifications.length} notification${notifications.length !== 1 ? 's' : ''}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 rounded-lg border bg-card ${!notification.status.includes('read') ? 'bg-blue-50 dark:bg-blue-950/20' : ''} ${getCategoryColor(notification.category)} transition-colors`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        {getPriorityIcon(notification.priority)}
                        <span className="font-semibold">{notification.title}</span>
                        {getTypeBadge(notification.type)}
                        {!notification.status.includes('read') && (
                          <Badge variant="secondary" className="text-xs">New</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{notification.message}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{format(new Date(notification.created_at), 'MMM dd, yyyy HH:mm')}</span>
                        {notification.read_at && (
                          <span>• Read {format(new Date(notification.read_at), 'MMM dd, yyyy HH:mm')}</span>
                        )}
                      </div>
                    </div>
                    {!notification.status.includes('read') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkAsRead(notification.id)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
