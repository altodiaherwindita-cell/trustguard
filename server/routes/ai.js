import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

// AI_BASE_URL overrides the endpoint for BYOK routers (OpenRouter, 9router,
// LiteLLM, Azure gateways, ...). The request/response shape still follows the
// AI_PROVIDER you pick, so point AI_PROVIDER=openai at any [OI]-compatible
// router and it just works.
const PROVIDERS = {
  openai: {
    url: () => process.env.AI_BASE_URL || 'https://api.openai.com/v1/chat/completions',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
    body: (model, systemPrompt, messages) => ({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
    parse: (data) => data.choices?.[0]?.message?.content,
  },
  anthropic: {
    url: () => process.env.AI_BASE_URL || 'https://api.anthropic.com/v1/messages',
    headers: (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01' }),
    body: (model, systemPrompt, messages) => ({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    }),
    parse: (data) => data.content?.map((b) => b.text).join(''),
  },
  google: {
    url: (model, key) =>
      process.env.AI_BASE_URL ||
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    headers: () => ({}),
    body: (model, systemPrompt, messages) => ({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    }),
    parse: (data) => data.candidates?.[0]?.content?.parts?.map((p) => p.text).join(''),
  },
};

const DEFAULT_MODELS = {
  openai: 'gpt-4o-mini',
  // Anthropic requires an explicit model id; an empty string would 404 at the
  // provider, so AI_MODEL is effectively required for this provider.
  anthropic: undefined,
  google: 'gemini-1.5-flash',
};

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

  const providerName = process.env.AI_PROVIDER || 'openai';
  const provider = PROVIDERS[providerName];
  if (!provider) {
    return res.status(503).json({ error: `Unknown AI_PROVIDER "${providerName}". Use openai, anthropic, or google.` });
  }
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'AI is not configured. Set AI_PROVIDER, AI_API_KEY, and AI_MODEL.' });
  }
  const model = process.env.AI_MODEL || DEFAULT_MODELS[providerName];

  // ponytail: only the global rate limiter guards this endpoint and conversations
  // are not persisted — add a per-user limiter and a chat_messages table when
  // abuse or history actually matter.
  try {
    const response = await fetch(provider.url(model, apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...provider.headers(apiKey) },
      body: JSON.stringify(provider.body(model, SYSTEM_PROMPT, messages)),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error(`AI provider ${providerName} error ${response.status}:`, detail.slice(0, 500));
      return res.status(502).json({ error: 'AI provider request failed. Try again later.' });
    }

    const data = await response.json();
    const reply = provider.parse(data);
    if (!reply) {
      return res.status(502).json({ error: 'AI provider returned an unexpected response.' });
    }
    res.json({ reply });
  } catch (error) {
    console.error('AI chat error:', error.message);
    res.status(502).json({ error: 'AI provider is unreachable. Try again later.' });
  }
});

export default router;
