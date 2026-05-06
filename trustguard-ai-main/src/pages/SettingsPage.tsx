import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Settings,
  Bell,
  Shield,
  Mail,
  Globe,
  Users,
  Database,
  Key,
} from 'lucide-react';

export function SettingsPage() {
  return (
    <div className="p-8 space-y-6 max-w-4xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your platform preferences and configurations
        </p>
      </motion.div>

      <div className="space-y-6">
        {/* Organization Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                Organization
              </CardTitle>
              <CardDescription>Manage your organization details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Organization Name</Label>
                  <Input id="org-name" defaultValue="Acme Corporation" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-domain">Domain</Label>
                  <Input id="org-domain" defaultValue="acme.com" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-email">Contact Email</Label>
                <Input id="org-email" type="email" defaultValue="security@acme.com" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Notification Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-accent" />
                Notifications
              </CardTitle>
              <CardDescription>Configure alert and notification preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">Receive email alerts for new assessments</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">High Risk Alerts</p>
                  <p className="text-sm text-muted-foreground">Immediate notifications for critical findings</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Weekly Summary</p>
                  <p className="text-sm text-muted-foreground">Receive weekly risk assessment digest</p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Security Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-success" />
                Security
              </CardTitle>
              <CardDescription>Manage security and access controls</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Two-Factor Authentication</p>
                  <p className="text-sm text-muted-foreground">Require 2FA for all team members</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">SSO Integration</p>
                  <p className="text-sm text-muted-foreground">Enable Single Sign-On with your identity provider</p>
                </div>
                <Button variant="outline" size="sm">Configure</Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">API Keys</p>
                  <p className="text-sm text-muted-foreground">Manage API access for integrations</p>
                </div>
                <Button variant="outline" size="sm" className="gap-2">
                  <Key className="w-4 h-4" />
                  Manage Keys
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Team Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-warning" />
                Team
              </CardTitle>
              <CardDescription>Manage team members and permissions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium">
                      JD
                    </div>
                    <div>
                      <p className="font-medium">John Doe</p>
                      <p className="text-sm text-muted-foreground">john@acme.com</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">Admin</span>
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-medium">
                      JS
                    </div>
                    <div>
                      <p className="font-medium">Jane Smith</p>
                      <p className="text-sm text-muted-foreground">jane@acme.com</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded-full bg-muted-foreground/10 text-muted-foreground text-xs font-medium">Analyst</span>
                </div>
                <Button variant="outline" className="w-full gap-2">
                  <Users className="w-4 h-4" />
                  Invite Team Member
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Data Management */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-destructive" />
                Data Management
              </CardTitle>
              <CardDescription>Export and manage your data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Export All Data</p>
                  <p className="text-sm text-muted-foreground">Download all assessments and vendor data</p>
                </div>
                <Button variant="outline">Export</Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Data Retention</p>
                  <p className="text-sm text-muted-foreground">Configure how long data is retained</p>
                </div>
                <Button variant="outline">Configure</Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
