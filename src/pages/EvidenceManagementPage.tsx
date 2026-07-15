import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { evidenceApi, type EvidenceDocument, assessmentsApi } from '@/lib/api';
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
import { Upload, Download, FileText, CheckCircle, XCircle, Trash2, Eye, Search } from 'lucide-react';
import { format } from 'date-fns';

interface EvidenceManagementPageProps {
  assessmentId?: string;
}

export default function EvidenceManagementPage({ assessmentId: initialAssessmentId }: EvidenceManagementPageProps) {
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
  const [assessmentId, setAssessmentId] = useState<string | undefined>(initialAssessmentId);
  const [assessments, setAssessments] = useState<Array<{ id: string; vendor_name: string; status: string }>>([]);
  const [assessmentsLoading, setAssessmentsLoading] = useState(false);
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
    loadEvidence();
  }, [assessmentId]);

  useEffect(() => {
    if (!initialAssessmentId) {
      loadAssessments();
    }
  }, [initialAssessmentId]);

  const loadAssessments = async () => {
    setAssessmentsLoading(true);
    try {
      const result = await assessmentsApi.getAll();
      if (result.data) {
        setAssessments(result.data.map(a => ({
          id: a.id,
          vendor_name: a.vendor?.name || a.vendor_name || 'Unknown Vendor',
          status: a.status,
        })));
      }
    } catch (error) {
      console.error('Failed to load assessments:', error);
    }
    setAssessmentsLoading(false);
  };

  const loadEvidence = async () => {
    setLoading(true);

    let endpoint = '/api/evidence';
    if (assessmentId) {
      endpoint = `/api/evidence/${assessmentId}`;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.evidence) {
          setEvidence(data.evidence);
        } else if (Array.isArray(data)) {
          setEvidence(data);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast({
          title: 'Error',
          description: errorData.error || 'Failed to load evidence',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Load evidence error:', error);
      toast({
        title: 'Error',
        description: 'Failed to load evidence',
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
    if (!uploadFile || !assessmentId) {
      toast({
        title: 'Error',
        description: 'Please select an assessment and file',
        variant: 'destructive',
      });
      return;
    }

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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Evidence Management</h1>
          <p className="text-muted-foreground">Manage supporting documents for assessments</p>
        </div>
        {assessmentId && (
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Upload Evidence
          </Button>
        )}
      </div>

      {!assessmentId && assessments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5 text-primary" />
              Select Assessment
            </CardTitle>
            <CardDescription>Choose an assessment to view or manage its evidence documents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {assessments.map((a) => (
                <Button
                  key={a.id}
                  variant={assessmentId === a.id ? 'default' : 'outline'}
                  className="w-full justify-start gap-3 h-auto py-4"
                  onClick={() => setAssessmentId(a.id)}
                >
                  <div className="flex-1 text-left">
                    <p className="font-medium">{a.vendor_name}</p>
                    <p className="text-sm text-muted-foreground">Status: {a.status}</p>
                    {assessmentId === a.id && (
                      <Badge className="mt-1 bg-primary">Selected</Badge>
                    )}
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Evidence Documents
          </CardTitle>
          <CardDescription>
            {assessmentId
              ? `${evidence.length} document${evidence.length !== 1 ? 's' : ''} found`
              : 'Select an assessment to view evidence documents'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading || assessmentsLoading ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center gap-2 text-muted-foreground">
                <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Loading...
              </div>
            </div>
          ) : evidence.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{assessmentId ? 'No evidence documents uploaded yet' : 'Select an assessment to view evidence'}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Assessment</TableHead>
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
                    <TableCell>
                      {doc.assessment_id ? (
                        <span className="text-sm text-muted-foreground">{doc.assessment_id.substring(0, 8)}...</span>
                      ) : (
                        '-'
                      )}
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