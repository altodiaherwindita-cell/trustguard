import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { evidenceApi, type EvidenceDocument } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { Textarea } from '@/components/ui/textarea';
import { Upload, Download, FileText, CheckCircle, XCircle, Trash2, Eye } from 'lucide-react';
import { format } from 'date-fns';

interface EvidenceManagementPageProps {
  assessmentId?: string;
}

export default function EvidenceManagementPage({ assessmentId }: EvidenceManagementPageProps) {
  const [evidence, setEvidence] = useState<EvidenceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceDocument | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDescription, setUploadDescription] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<'validated' | 'rejected'>('validated');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const storedUser = localStorage.getItem('auth_user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setUserRoles(user.roles || []);
      } catch (e) {
        console.error('Failed to parse user roles');
      }
    }
  }, []);

  useEffect(() => {
    if (assessmentId) {
      loadEvidence();
    }
  }, [assessmentId]);

  const loadEvidence = async () => {
    if (!assessmentId) return;
    
    setLoading(true);
    const result = await evidenceApi.getByAssessment(assessmentId);
    if (result.data) {
      setEvidence(result.data);
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to load evidence',
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/png', 'image/jpeg'];
      
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: 'Invalid file type',
          description: 'Please upload PDF, DOC, DOCX, XLS, XLSX, PNG, or JPG files only',
          variant: 'destructive',
        });
        return;
      }

      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Maximum file size is 10MB',
          variant: 'destructive',
        });
        return;
      }

      setUploadFile(file);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !assessmentId) return;

    const result = await evidenceApi.upload(assessmentId, uploadFile, undefined, uploadDescription);
    if (result.data) {
      toast({
        title: 'Success',
        description: 'Evidence uploaded successfully',
      });
      setUploadFile(null);
      setUploadDescription('');
      setUploadDialogOpen(false);
      loadEvidence();
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to upload evidence',
        variant: 'destructive',
      });
    }
  };

  const handleDownload = async (id: string, fileName: string) => {
    try {
      const blob = await evidenceApi.download(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to download file',
        variant: 'destructive',
      });
    }
  };

  const handleVerify = async () => {
    if (!selectedEvidence) return;

    const result = await evidenceApi.verify(selectedEvidence.id, verificationStatus, verificationNotes);
    if (result.data) {
      toast({
        title: 'Success',
        description: `Evidence ${verificationStatus === 'validated' ? 'verified' : 'rejected'}`,
      });
      setVerificationNotes('');
      setVerifyDialogOpen(false);
      setSelectedEvidence(null);
      loadEvidence();
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to update evidence status',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    const result = await evidenceApi.delete(id);
    if (result.data || result.error === undefined) {
      toast({
        title: 'Success',
        description: 'Evidence deleted successfully',
      });
      loadEvidence();
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to delete evidence',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'validated':
        return <Badge className="bg-green-500">Verified</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const isTprm = userRoles.includes('tprm_analyst') || userRoles.includes('admin');

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Evidence Management</h1>
          <p className="text-muted-foreground">Manage supporting documents for assessments</p>
        </div>
        <Button onClick={() => setUploadDialogOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Upload Evidence
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evidence Documents</CardTitle>
          <CardDescription>
            {evidence.length} document{evidence.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : evidence.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No evidence documents uploaded yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Uploaded By</TableHead>
                  <TableHead>Upload Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evidence.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span>{doc.file_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{doc.uploaded_by_name || doc.uploaded_by_email}</TableCell>
                    <TableCell>{format(new Date(doc.created_at), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>{getStatusBadge(doc.status)}</TableCell>
                    <TableCell>{(doc.file_size / 1024).toFixed(1)} KB</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(doc.id, doc.file_name)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {isTprm && doc.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedEvidence(doc);
                              setVerifyDialogOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        {(doc.uploaded_by === JSON.parse(localStorage.getItem('auth_user') || '{}')?.id || isTprm) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(doc.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Evidence Document</DialogTitle>
            <DialogDescription>
              Upload a supporting document for this assessment. Maximum file size is 10MB.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="file">File</Label>
              <Input
                id="file"
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                onChange={handleFileSelect}
              />
              {uploadFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Describe what this evidence proves..."
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={!uploadFile}>
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verification Dialog */}
      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Evidence</DialogTitle>
            <DialogDescription>
              Review and verify the uploaded evidence document.
            </DialogDescription>
          </DialogHeader>
          {selectedEvidence && (
            <div className="space-y-4 py-4">
              <div>
                <p className="font-medium">Document: {selectedEvidence.file_name}</p>
                <p className="text-sm text-muted-foreground">
                  Uploaded by {selectedEvidence.uploaded_by_name || selectedEvidence.uploaded_by_email}
                </p>
                {selectedEvidence.description && (
                  <p className="text-sm mt-2">{selectedEvidence.description}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Verification Status</Label>
                <Select
                  value={verificationStatus}
                  onValueChange={(val) => setVerificationStatus(val as 'validated' | 'rejected')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="validated">Verified</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add comments about this verification..."
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleVerify}>
              {verificationStatus === 'validated' ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Verify
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
