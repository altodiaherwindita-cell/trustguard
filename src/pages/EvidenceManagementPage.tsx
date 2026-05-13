import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Download, 
  Trash2, 
  Eye,
  Plus,
  AlertTriangle
} from "lucide-react";
import type { EvidenceDocument, Assessment } from "@/types/tprm";

export default function EvidenceManagementPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<string>("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [verificationNotes, setVerificationNotes] = useState("");
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceDocument | null>(null);

  // Fetch assessment details
  const { data: assessment, isLoading: assessmentLoading } = useQuery<Assessment>({
    queryKey: ["assessment", assessmentId],
    queryFn: () => api.assessments.getById(assessmentId!),
    enabled: !!assessmentId,
  });

  // Fetch evidence documents
  const { data: evidence, isLoading: evidenceLoading } = useQuery<EvidenceDocument[]>({
    queryKey: ["evidence", assessmentId],
    queryFn: () => api.evidence.getByAssessment(assessmentId!),
    enabled: !!assessmentId,
  });

  // Fetch questions for the assessment
  const { data: questions } = useQuery({
    queryKey: ["questions", assessment?.questionnaire_template_id],
    queryFn: () => api.questions.getByTemplate(assessment?.questionnaire_template_id || ""),
    enabled: !!assessment?.questionnaire_template_id,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/evidence", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Upload failed");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evidence", assessmentId] });
      setIsUploadDialogOpen(false);
      setUploadFile(null);
      setSelectedQuestion("");
      toast({
        title: "Evidence uploaded successfully",
        description: "Your document has been uploaded for review.",
      });
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Verify mutation
  const verifyMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes: string }) => {
      const response = await fetch(`/api/evidence/${id}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, verification_notes: notes }),
      });
      if (!response.ok) throw new Error("Verification failed");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evidence", assessmentId] });
      setSelectedEvidence(null);
      setVerificationNotes("");
      toast({
        title: "Evidence verified",
        description: "The evidence status has been updated.",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/evidence/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Delete failed");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evidence", assessmentId] });
      toast({
        title: "Evidence deleted",
        description: "The document has been removed.",
      });
    },
  });

  const handleUpload = () => {
    if (!uploadFile || !selectedQuestion) {
      toast({
        title: "Missing information",
        description: "Please select a question and choose a file to upload.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("assessment_id", assessmentId!);
    formData.append("question_id", selectedQuestion);

    uploadMutation.mutate(formData);
  };

  const handleVerify = (status: "validated" | "rejected") => {
    if (!selectedEvidence) return;
    verifyMutation.mutate({
      id: selectedEvidence.id,
      status,
      notes: verificationNotes,
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "validated":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      validated: "default",
      rejected: "destructive",
    };
    return (
      <Badge variant={variants[status] || "outline"} className="flex items-center gap-1">
        {getStatusIcon(status)}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  if (assessmentLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  if (!assessment) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>Assessment not found</AlertDescription>
      </Alert>
    );
  }

  const isVendor = assessment.current_user_role === "vendor";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Evidence Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage supporting documents for {assessment.vendor_name} assessment
          </p>
        </div>
        {!isVendor && (
          <Button onClick={() => navigate("/assessments")} variant="outline">
            Back to Assessments
          </Button>
        )}
      </div>

      {/* Assessment Info */}
      <Card>
        <CardHeader>
          <CardTitle>{assessment.vendor_name}</CardTitle>
          <CardDescription>
            Assessment created on {new Date(assessment.created_at).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge>{assessment.status}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Risk Level</p>
              <Badge variant={
                assessment.risk_level === "Critical" ? "destructive" :
                assessment.risk_level === "High" ? "default" :
                assessment.risk_level === "Medium" ? "secondary" : "outline"
              }>
                {assessment.risk_level}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Evidence Count</p>
              <p className="font-semibold">{evidence?.length || 0} documents</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending Review</p>
              <p className="font-semibold">
                {evidence?.filter(e => e.status === "pending").length || 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Evidence List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Evidence Documents</CardTitle>
            <CardDescription>
              Upload and manage supporting documentation for your assessment responses
            </CardDescription>
          </div>
          {!isVendor && (
            <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Evidence
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload Evidence Document</DialogTitle>
                  <DialogDescription>
                    Select a question and upload supporting documentation
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="question">Related Question</Label>
                    <Select value={selectedQuestion} onValueChange={setSelectedQuestion}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a question" />
                      </SelectTrigger>
                      <SelectContent>
                        {questions?.map((q: any) => (
                          <SelectItem key={q.id} value={q.id}>
                            {q.text.substring(0, 50)}...
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="file">Document</Label>
                    <Input
                      id="file"
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Accepted formats: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG (Max 10MB)
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleUpload} disabled={uploadMutation.isPending}>
                    {uploadMutation.isPending ? "Uploading..." : "Upload"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {evidenceLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading evidence...</div>
          ) : evidence?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No evidence documents uploaded yet</p>
              {!isVendor && (
                <Button variant="link" onClick={() => setIsUploadDialogOpen(true)}>
                  Upload your first document
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {evidence?.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <FileText className="h-10 w-10 text-primary" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{doc.file_name}</p>
                        {getStatusBadge(doc.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(doc.file_size)} • Uploaded{" "}
                        {new Date(doc.uploaded_at).toLocaleDateString()}
                      </p>
                      {doc.question_text && (
                        <p className="text-xs text-muted-foreground mt-1">
                          For: {doc.question_text.substring(0, 60)}...
                        </p>
                      )}
                      {doc.verification_notes && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          Reviewer note: {doc.verification_notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        window.open(`/api/evidence/${doc.id}/download`, "_blank");
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {!isVendor && doc.status === "pending" && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedEvidence(doc)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Verify Evidence</DialogTitle>
                            <DialogDescription>
                              Review and validate this evidence document
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="p-4 bg-muted rounded-lg">
                              <p className="font-medium">{doc.file_name}</p>
                              <p className="text-sm text-muted-foreground">
                                Uploaded by {doc.uploaded_by_email} on{" "}
                                {new Date(doc.uploaded_at).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="notes">Verification Notes</Label>
                              <Textarea
                                id="notes"
                                placeholder="Add comments or feedback..."
                                value={verificationNotes}
                                onChange={(e) => setVerificationNotes(e.target.value)}
                                rows={4}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => setSelectedEvidence(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() => handleVerify("rejected")}
                            >
                              Reject
                            </Button>
                            <Button onClick={() => handleVerify("validated")}>
                              Validate
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                    {(isVendor || doc.uploaded_by === assessment.current_user_id) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(doc.id)}
                        disabled={doc.status !== "pending"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle>Evidence Guidelines</CardTitle>
          <CardDescription>Best practices for uploading evidence documents</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-sm">
            <li>Upload documents that directly support your assessment responses</li>
            <li>Ensure files are clearly named and organized</li>
            <li>Accepted formats: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG</li>
            <li>Maximum file size: 10MB per document</li>
            <li>Remove any sensitive information not relevant to the assessment</li>
            <li>Wait for reviewer validation after submission</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
