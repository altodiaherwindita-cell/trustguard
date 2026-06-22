import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { remediationApi, type RemediationItem, type CreateRemediationItem } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusCircle, CheckCircle, Clock, AlertCircle, XCircle, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';

interface RemediationPageProps {
  assessmentId?: string;
}

export default function RemediationPage({ assessmentId }: RemediationPageProps) {
  const [remediations, setRemediations] = useState<RemediationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedRemediation, setSelectedRemediation] = useState<RemediationItem | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [userId, setUserId] = useState<string>('');
  const { toast } = useToast();

  const [formData, setFormData] = useState<CreateRemediationItem>({
    assessment_id: '',
    finding: '',
    description: '',
    priority: 'medium',
    due_date: '',
  });

  const [commentText, setCommentText] = useState('');

  useEffect(() => {
    const storedUser = localStorage.getItem('auth_user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setUserRoles(user.roles || []);
        setUserId(user.id || '');
      } catch (e) {
        console.error('Failed to parse user');
      }
    }
  }, []);

  useEffect(() => {
    if (assessmentId) {
      loadRemediations();
    }
  }, [assessmentId]);

  const loadRemediations = async () => {
    if (!assessmentId) return;
    
    setLoading(true);
    const result = await remediationApi.getByAssessment(assessmentId);
    if (result.data) {
      setRemediations(result.data);
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to load remediation items',
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    const itemToCreate = { ...formData, assessment_id: assessmentId || '' };
    const result = await remediationApi.create(itemToCreate);
    if (result.data) {
      toast({
        title: 'Success',
        description: 'Remediation item created successfully',
      });
      setFormData({
        assessment_id: '',
        finding: '',
        description: '',
        priority: 'medium',
        due_date: '',
      });
      setCreateDialogOpen(false);
      loadRemediations();
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to create remediation item',
        variant: 'destructive',
      });
    }
  };

  const handleComplete = async (id: string) => {
    const result = await remediationApi.complete(id, commentText);
    if (result.data) {
      toast({
        title: 'Success',
        description: 'Remediation marked as completed',
      });
      setCommentText('');
      setDetailDialogOpen(false);
      loadRemediations();
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to complete remediation',
        variant: 'destructive',
      });
    }
  };

  const handleVerify = async (id: string) => {
    const result = await remediationApi.verify(id, commentText);
    if (result.data) {
      toast({
        title: 'Success',
        description: 'Remediation verified',
      });
      setCommentText('');
      setDetailDialogOpen(false);
      loadRemediations();
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to verify remediation',
        variant: 'destructive',
      });
    }
  };

  const handleClose = async (id: string) => {
    const result = await remediationApi.close(id, commentText);
    if (result.data) {
      toast({
        title: 'Success',
        description: 'Remediation closed',
      });
      setCommentText('');
      setDetailDialogOpen(false);
      loadRemediations();
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to close remediation',
        variant: 'destructive',
      });
    }
  };

  const handleAddComment = async (id: string) => {
    if (!commentText.trim()) return;
    
    const result = await remediationApi.addComment(id, commentText);
    if (result.data) {
      toast({
        title: 'Success',
        description: 'Comment added',
      });
      setCommentText('');
      // Refresh the selected remediation to show new comment
      if (selectedRemediation) {
        setSelectedRemediation(result.data);
      }
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to add comment',
        variant: 'destructive',
      });
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical':
        return <Badge className="bg-red-500">Critical</Badge>;
      case 'high':
        return <Badge className="bg-orange-500">High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500">Medium</Badge>;
      case 'low':
        return <Badge className="bg-blue-500">Low</Badge>;
      default:
        return <Badge>{priority}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" />Open</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500"><Clock className="h-3 w-3 mr-1" />In Progress</Badge>;
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'verified':
        return <Badge className="bg-purple-500"><CheckCircle className="h-3 w-3 mr-1" />Verified</Badge>;
      case 'closed':
        return <Badge variant="outline"><XCircle className="h-3 w-3 mr-1" />Closed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const isTprm = userRoles.includes('tprm_analyst') || userRoles.includes('admin');
  const isVendor = userRoles.includes('vendor');

  const filteredRemediations = remediations.filter(r => {
    // Vendors only see items assigned to them or created by them
    if (isVendor && !userRoles.includes('admin')) {
      return r.assigned_to === userId || r.created_by === userId;
    }
    return true;
  });

  const stats = {
    open: remediations.filter(r => r.status === 'open').length,
    inProgress: remediations.filter(r => r.status === 'in_progress').length,
    completed: remediations.filter(r => r.status === 'completed').length,
    overdue: remediations.filter(r => {
      if (!r.due_date || r.status === 'closed') return false;
      return new Date(r.due_date) < new Date() && r.status !== 'completed' && r.status !== 'verified' && r.status !== 'closed';
    }).length,
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Remediation Tracking</h1>
          <p className="text-muted-foreground">Manage findings and remediation actions</p>
        </div>
        {isTprm && (
          <Button onClick={() => setCreateDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Remediation
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.open}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-500">{stats.overdue}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({remediations.length})</TabsTrigger>
          <TabsTrigger value="open">Open ({stats.open})</TabsTrigger>
          <TabsTrigger value="in_progress">In Progress ({stats.inProgress})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({stats.completed})</TabsTrigger>
          <TabsTrigger value="overdue">Overdue ({stats.overdue})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <RemediationTable 
            remediations={filteredRemediations}
            loading={loading}
            onViewDetails={(r) => {
              setSelectedRemediation(r);
              setDetailDialogOpen(true);
            }}
            getPriorityBadge={getPriorityBadge}
            getStatusBadge={getStatusBadge}
          />
        </TabsContent>
        <TabsContent value="open" className="mt-4">
          <RemediationTable 
            remediations={filteredRemediations.filter(r => r.status === 'open')}
            loading={loading}
            onViewDetails={(r) => {
              setSelectedRemediation(r);
              setDetailDialogOpen(true);
            }}
            getPriorityBadge={getPriorityBadge}
            getStatusBadge={getStatusBadge}
          />
        </TabsContent>
        <TabsContent value="in_progress" className="mt-4">
          <RemediationTable 
            remediations={filteredRemediations.filter(r => r.status === 'in_progress')}
            loading={loading}
            onViewDetails={(r) => {
              setSelectedRemediation(r);
              setDetailDialogOpen(true);
            }}
            getPriorityBadge={getPriorityBadge}
            getStatusBadge={getStatusBadge}
          />
        </TabsContent>
        <TabsContent value="completed" className="mt-4">
          <RemediationTable 
            remediations={filteredRemediations.filter(r => r.status === 'completed' || r.status === 'verified')}
            loading={loading}
            onViewDetails={(r) => {
              setSelectedRemediation(r);
              setDetailDialogOpen(true);
            }}
            getPriorityBadge={getPriorityBadge}
            getStatusBadge={getStatusBadge}
          />
        </TabsContent>
        <TabsContent value="overdue" className="mt-4">
          <RemediationTable 
            remediations={filteredRemediations.filter(r => {
              if (!r.due_date || r.status === 'closed') return false;
              return new Date(r.due_date) < new Date() && r.status !== 'completed' && r.status !== 'verified' && r.status !== 'closed';
            })}
            loading={loading}
            onViewDetails={(r) => {
              setSelectedRemediation(r);
              setDetailDialogOpen(true);
            }}
            getPriorityBadge={getPriorityBadge}
            getStatusBadge={getStatusBadge}
          />
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Remediation Item</DialogTitle>
            <DialogDescription>
              Document a finding that requires remediation action.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="finding">Finding Title</Label>
                <Input
                  id="finding"
                  placeholder="Brief title for this finding"
                  value={formData.finding}
                  onChange={(e) => setFormData({ ...formData, finding: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(val) => setFormData({ ...formData, priority: val as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Detailed description of the finding and required remediation..."
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!formData.finding || !formData.description}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedRemediation?.finding}</DialogTitle>
            <DialogDescription>
              Remediation details and activity
            </DialogDescription>
          </DialogHeader>
          {selectedRemediation && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Status</p>
                  {getStatusBadge(selectedRemediation.status)}
                </div>
                <div>
                  <p className="text-sm font-medium">Priority</p>
                  {getPriorityBadge(selectedRemediation.priority)}
                </div>
                <div>
                  <p className="text-sm font-medium">Assigned To</p>
                  <p className="text-sm">{selectedRemediation.assigned_to_name || selectedRemediation.assigned_to_email || 'Unassigned'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Due Date</p>
                  <p className={`text-sm ${selectedRemediation.due_date && new Date(selectedRemediation.due_date) < new Date() && selectedRemediation.status !== 'closed' ? 'text-red-500' : ''}`}>
                    {selectedRemediation.due_date ? format(new Date(selectedRemediation.due_date), 'MMM dd, yyyy') : 'Not set'}
                  </p>
                </div>
              </div>
              
              <div>
                <p className="text-sm font-medium">Description</p>
                <p className="text-sm text-muted-foreground mt-1">{selectedRemediation.description}</p>
              </div>

              {/* Comments Section */}
              <div>
                <p className="text-sm font-medium mb-2">Comments</p>
                <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
                  {selectedRemediation.comments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No comments yet</p>
                  ) : (
                    selectedRemediation.comments.map((comment) => (
                      <div key={comment.id} className="p-2 bg-muted rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">{comment.user_name || 'Unknown'}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(comment.created_at), 'MMM dd, yyyy HH:mm')}
                          </span>
                        </div>
                        <p className="text-sm mt-1">{comment.comment}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a comment..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && commentText.trim()) {
                        handleAddComment(selectedRemediation.id);
                      }
                    }}
                  />
                  <Button 
                    onClick={() => handleAddComment(selectedRemediation.id)}
                    disabled={!commentText.trim()}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 flex-wrap">
                {isVendor && selectedRemediation.status === 'in_progress' && (
                  <Button onClick={() => handleComplete(selectedRemediation.id)}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Mark Complete
                  </Button>
                )}
                {isTprm && selectedRemediation.status === 'completed' && (
                  <Button onClick={() => handleVerify(selectedRemediation.id)}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Verify
                  </Button>
                )}
                {isTprm && (selectedRemediation.status === 'verified' || selectedRemediation.status === 'completed') && (
                  <Button variant="outline" onClick={() => handleClose(selectedRemediation.id)}>
                    <XCircle className="mr-2 h-4 w-4" />
                    Close
                  </Button>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Sub-component for table rendering
function RemediationTable({ 
  remediations, 
  loading, 
  onViewDetails,
  getPriorityBadge,
  getStatusBadge 
}: { 
  remediations: RemediationItem[]; 
  loading: boolean;
  onViewDetails: (r: RemediationItem) => void;
  getPriorityBadge: (p: string) => React.ReactNode;
  getStatusBadge: (s: string) => React.ReactNode;
}) {
  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (remediations.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No remediation items found</div>;
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Finding</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {remediations.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{item.finding}</p>
                    <p className="text-sm text-muted-foreground truncate max-w-md">{item.description}</p>
                  </div>
                </TableCell>
                <TableCell>{getPriorityBadge(item.priority)}</TableCell>
                <TableCell>{getStatusBadge(item.status)}</TableCell>
                <TableCell>{item.assigned_to_name || item.assigned_to_email || 'Unassigned'}</TableCell>
                <TableCell>
                  {item.due_date ? (
                    <span className={new Date(item.due_date) < new Date() && item.status !== 'closed' ? 'text-red-500' : ''}>
                      {format(new Date(item.due_date), 'MMM dd, yyyy')}
                    </span>
                  ) : '-'}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => onViewDetails(item)}>
                    View Details
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
