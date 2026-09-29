import { getSetting } from './settings.js';

// AI_BASE_URL overrides the endpoint for BYOK routers (OpenRouter, 9router,
// LiteLLM, Azure gateways, ...). The request/response shape still follows the
// AI_PROVIDER you pick, so point AI_PROVIDER=openai at any [OI]-compatible
// router and it just works.
const PROVIDERS = {
  openai: {
    url: () => getSetting('AI_BASE_URL') || 'https://api.openai.com/v1/chat/completions',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
    body: (model, systemPrompt, messages) => ({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
    parse: (data) => data.choices?.[0]?.message?.content,
  },
  anthropic: {
    url: () => getSetting('AI_BASE_URL') || 'https://api.anthropic.com/v1/messages',
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
      getSetting('AI_BASE_URL') ||
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

export const PROVIDER_NAMES = Object.keys(PROVIDERS);

/** Resolved provider + credentials, or an { error, status } describing what is missing. */
export function resolveProvider() {
  const name = getSetting('AI_PROVIDER') || 'openai';
  const provider = PROVIDERS[name];
  if (!provider) {
    return { error: `Unknown AI_PROVIDER "${name}". Use ${PROVIDER_NAMES.join(', ')}.`, status: 503 };
  }
  const apiKey = getSetting('AI_API_KEY');
  if (!apiKey) {
    return { error: 'AI is not configured. Set AI_PROVIDER, AI_API_KEY, and AI_MODEL.', status: 503 };
  }
  return { name, provider, apiKey, model: getSetting('AI_MODEL') || DEFAULT_MODELS[name] };
}

/**
 * One chat completion. Returns { reply } or { error, status } — never throws, so
 * both the chat route and the settings connectivity test can report the same
 * failure text.
 */
export async function chat(systemPrompt, messages) {
  const resolved = resolveProvider();
  if (resolved.error) return resolved;

  const { name, provider, apiKey, model } = resolved;
  try {
    const response = await fetch(provider.url(model, apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...provider.headers(apiKey) },
      body: JSON.stringify(provider.body(model, systemPrompt, messages)),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error(`AI provider ${name} error ${response.status}:`, detail.slice(0, 500));
      return { error: 'AI provider request failed. Try again later.', status: 502 };
    }

    const reply = provider.parse(await response.json());
    if (!reply) return { error: 'AI provider returned an unexpected response.', status: 502 };
    return { reply, provider: name, model };
  } catch (error) {
    console.error('AI chat error:', error.message);
    return { error: 'AI provider is unreachable. Try again later.', status: 502 };
  }
}
