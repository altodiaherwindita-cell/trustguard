import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { chat } from '../services/aiProvider.js';

const router = Router();

const SYSTEM_PROMPT =
  'You are a third-party-risk-management assistant for TrustGuard. Answer questions about vendor risk, ' +
  'security assessments, and remediation concisely. Only reason over the conversation the user provides; ' +
  'do not invent customer or vendor data you were not given.';

router.post('/chat', authenticateToken, requireRole('admin', 'tprm_analyst'), async (req, res) => {
  const { messages } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0 ||
      messages.some((m) => (m?.role !== 'user' && m?.role !== 'assistant') || typeof m?.content !== 'string')) {
    return res.status(400).json({ error: 'messages must be a non-empty array of { role, content }' });
  }

  // ponytail: only the global rate limiter guards this endpoint and conversations
  // are not persisted — add a per-user limiter and a chat_messages table when
  // abuse or history actually matter.
  const result = await chat(SYSTEM_PROMPT, messages);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json({ reply: result.reply });
});

export default router;
