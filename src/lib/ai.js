import api from './api';

// Non-streaming — returns full text
export async function callClaude({ systemPrompt, userPrompt, maxTokens = 1000 }) {
  const { data } = await api.post('/ai/chat', {
    systemPrompt,
    userPrompt,
    maxTokens,
    stream: false,
  });
  return data.text || '';
}

// Streaming — calls onChunk(delta, fullTextSoFar) with each chunk
export async function callClaudeStream({ systemPrompt, userPrompt, maxTokens = 1000, onChunk }) {
  const token = localStorage.getItem('accessToken');

  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ systemPrompt, userPrompt, maxTokens, stream: true }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'AI request failed');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));

    for (const line of lines) {
      const raw = line.slice(6);
      if (raw === '[DONE]') continue;
      try {
        const parsed = JSON.parse(raw);
        const delta = parsed.delta?.text || '';
        if (delta) {
          fullText += delta;
          onChunk?.(delta, fullText);
        }
      } catch {}
    }
  }

  return fullText;
}