import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { vendorsApi, assessmentsApi, Vendor } from '@/lib/api';
import { RiskBadge } from '@/components/ui/RiskBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Building2, Plus, Mail, Copy, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';

export function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', category: '', industry: '', contact_email: '' });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const result = await vendorsApi.getAll();
    if (result.error) toast.error(result.error);
    setVendors(result.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const result = await vendorsApi.create(form);
    setBusy(false);
    if (result.error) return toast.error(result.error);
    toast.success('Vendor added');
    setAddOpen(false);
    setForm({ name: '', category: '', industry: '', contact_email: '' });
    load();
  };

  const sendInvitation = async (vendor: Vendor) => {
    setBusy(true);
    const assessmentResult = await assessmentsApi.create({ vendor_id: vendor.id, status: 'not-started' });
    if (assessmentResult.error) { setBusy(false); return toast.error(assessmentResult.error); }
    const assessment = assessmentResult.data;
    
    // Generate invite token (in production, backend should handle this)
    const token = crypto.randomUUID().replace(/-/g, '');
    const link = `${window.location.origin}/invite/${token}`;
    
    setBusy(false);
    setInviteLink(link);
    toast.success('Invitation created');
    load();
  };

  return (
    <div className="p-8 space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vendors</h1>
          <p className="text-muted-foreground mt-1">Manage your third-party vendors and send questionnaires</p>
        </div>
        <Button className="gap-2 bg-gradient-primary hover:opacity-90" onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4" /> Add Vendor
        </Button>
      </motion.div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            All Vendors ({vendors.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
          ) : vendors.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p>No vendors yet. Add your first vendor to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Risk Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendors.map((vendor) => (
                  <TableRow key={vendor.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{vendor.name}</p>
                          <p className="text-xs text-muted-foreground">{vendor.contact_email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{vendor.category}</TableCell>
                    <TableCell>
                      {vendor.current_risk_score != null ? (
                        <RiskBadge level={vendor.current_risk_level || 'medium'} score={vendor.current_risk_score} showScore size="sm" />
                      ) : (
                        <span className="text-xs text-muted-foreground">Not assessed</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium capitalize bg-muted">
                        {vendor.status?.replace('-', ' ')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" className="gap-2" onClick={() => sendInvitation(vendor)} disabled={busy}>
                        <Send className="w-3 h-3" /> Send Questionnaire
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Vendor</DialogTitle>
            <DialogDescription>Create a vendor record. You can send them a questionnaire afterwards.</DialogDescription>
          </DialogHeader>
          <form onSubmit={addVendor} className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Cloud Services" /></div>
            <div className="space-y-2"><Label>Industry</Label><Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} /></div>
            <div className="space-y-2"><Label>Contact Email</Label><Input type="email" required value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
            <DialogFooter>
              <Button type="submit" disabled={busy}>{busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Add Vendor</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!inviteLink} onOpenChange={(o) => !o && setInviteLink(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Mail className="w-5 h-5" /> Invitation Created</DialogTitle>
            <DialogDescription>Share this link with the vendor. They'll create an account and complete the questionnaire.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input readOnly value={inviteLink || ''} />
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(inviteLink!); toast.success('Copied'); }}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
