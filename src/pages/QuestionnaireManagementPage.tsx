import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { questionsApi, Question } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FileText, Plus, Edit, Trash2, Loader2, Save, X } from 'lucide-react';
import { toast } from 'sonner';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function QuestionnaireManagementPage() {
  const { isTPRM, isAdmin } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    id: '',
    category: 'Data Protection',
    question: '',
    type: 'boolean',
    options: '',
    weight: 5,
    risk_impact: 'medium',
    display_order: 0,
  });

  useEffect(() => {
    if (!isTPRM) return;
    loadQuestions();
  }, [isTPRM]);

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/questions`);
      const data = await response.json();
      setQuestions(data.data || []);
    } catch (error) {
      console.error('Error loading questions:', error);
      toast.error('Failed to load questions');
    }
    setLoading(false);
  };

  const openNewQuestionDialog = () => {
    setEditingQuestion(null);
    setFormData({
      id: `q${Date.now()}`,
      category: 'Data Protection',
      question: '',
      type: 'boolean',
      options: '',
      weight: 5,
      risk_impact: 'medium',
      display_order: questions.length + 1,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (question: Question) => {
    setEditingQuestion(question);
    setFormData({
      id: question.id,
      category: question.category,
      question: question.question,
      type: question.type,
      options: question.options ? JSON.stringify(question.options) : '',
      weight: question.weight,
      risk_impact: question.risk_impact,
      display_order: question.display_order,
    });
    setIsDialogOpen(true);
  };

  const saveQuestion = async () => {
    if (!formData.question.trim()) {
      toast.error('Question text is required');
      return;
    }

    setSaving(true);
    try {
      const options = formData.type !== 'boolean' && formData.options.trim()
        ? JSON.parse(formData.options)
        : null;

      const payload = {
        ...formData,
        options,
        weight: Number(formData.weight),
        display_order: Number(formData.display_order),
      };

      const url = editingQuestion
        ? `${API_BASE}/api/questions/${formData.id}`
        : `${API_BASE}/api/questions`;

      const method = editingQuestion ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.error) throw new Error(data.error);

      toast.success(editingQuestion ? 'Question updated' : 'Question created');
      setIsDialogOpen(false);
      loadQuestions();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save question');
    }
    setSaving(false);
  };

  const deleteQuestion = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;

    try {
      const response = await fetch(`${API_BASE}/api/questions/${questionId}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (data.error) throw new Error(data.error);

      toast.success('Question deleted');
      loadQuestions();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete question');
    }
  };

  const categories = ['Data Protection', 'Access Control', 'Incident Response', 'Compliance', 'Security Operations', 'Business Continuity'];
  const questionTypes = [
    { value: 'boolean', label: 'Yes/No' },
    { value: 'single-choice', label: 'Single Choice' },
    { value: 'multiple-choice', label: 'Multiple Choice' },
  ];
  const riskImpacts = ['low', 'medium', 'high'];

  if (!isTPRM) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        You don't have permission to manage questionnaires.
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 max-w-6xl">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Questionnaire Management</h1>
            <p className="text-muted-foreground mt-1">Manage security assessment questions and categories</p>
          </div>
          <Button onClick={openNewQuestionDialog} className="gap-2">
            <Plus className="w-4 h-4" /> Add Question
          </Button>
        </div>
      </motion.div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Questions ({questions.length})
          </CardTitle>
          <CardDescription>All questions used in vendor security assessments</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : questions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No questions found. Add your first question!</p>
          ) : (
            <div className="space-y-2">
              {questions.map((q, idx) => {
                const CategoryIcon = FileText;
                return (
                  <div key={q.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium px-2 py-1 rounded bg-primary/10 text-primary">{q.category}</span>
                        <span className="text-xs text-muted-foreground">Type: {q.type}</span>
                        <span className="text-xs text-muted-foreground">Weight: {q.weight}</span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          q.risk_impact === 'high' ? 'bg-red-100 text-red-700' :
                          q.risk_impact === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>{q.risk_impact}</span>
                      </div>
                      <p className="font-medium">{q.question}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(q)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteQuestion(q.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingQuestion ? 'Edit Question' : 'Add New Question'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Question Type</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {questionTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="question">Question Text</Label>
              <Input
                id="question"
                value={formData.question}
                onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                placeholder="Enter the question text"
              />
            </div>

            {formData.type !== 'boolean' && (
              <div className="space-y-2">
                <Label htmlFor="options">Options (JSON array for select/multiselect)</Label>
                <Input
                  id="options"
                  value={formData.options}
                  onChange={(e) => setFormData({ ...formData, options: e.target.value })}
                  placeholder='["Option 1", "Option 2", "Option 3"]'
                />
                <p className="text-xs text-muted-foreground">Enter as JSON array, e.g., ["Option A", "Option B"]</p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weight">Weight (1-10)</Label>
                <Input
                  id="weight"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="risk_impact">Risk Impact</Label>
                <Select value={formData.risk_impact} onValueChange={(v) => setFormData({ ...formData, risk_impact: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {riskImpacts.map((r) => (
                      <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="display_order">Display Order</Label>
                <Input
                  id="display_order"
                  type="number"
                  min="0"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>
                <X className="w-4 h-4 mr-2" /> Cancel
              </Button>
              <Button onClick={saveQuestion} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingQuestion ? 'Update' : 'Create'} Question
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
