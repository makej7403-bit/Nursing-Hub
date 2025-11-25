export const config = { api: { responseLimit: false } };

const OPENAI_KEY = process.env.OPENAI_API_KEY || "";

// Parse chunked OpenAI stream which may split JSON across chunks
function* extractDataLinesFromChunk(buffered) {
  // buffered is a string that may contain multiple 'data: ' lines and partial JSON across boundaries
  // We split on '\n' and accumulate complete lines starting with 'data:'
  const lines = buffered.split('\n');
  let carry = '';
  for (let line of lines) {
    if (line.startsWith('data:')) {
      const payload = line.slice(5).trim();
      if (payload) yield payload;
    } else if (carry) {
      // try to handle continuation
      const maybe = (carry + line).trim();
      if (maybe.startsWith('{') && maybe.endsWith('}')) {
        yield maybe;
        carry = '';
      } else {
        carry += line;
      }
    }
  }
}

// Safely extract text deltas
function extractTextFromData(payload) {
  try {
    const obj = JSON.parse(payload);
    const delta = obj.choices?.[0]?.delta;
    if (delta?.content) return delta.content;
  } catch (e) {
    // ignore parse errors
  }
  return '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { messages, model = 'gpt-3.5-turbo', temperature = 0.2 } = req.body;
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages array required' });
  if (!OPENAI_KEY) return res.status(500).json({ error: 'OpenAI key not configured' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });

  const body = { model, messages, temperature, stream: true };

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!openaiRes.ok) {
      const txt = await openaiRes.text();
      res.write(`event: error\ndata: ${JSON.stringify({ status: openaiRes.status, body: txt })}\n\n`);
      return res.end();
    }

    const reader = openaiRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      // extract complete 'data: ...' JSON payloads within buffer
      const parts = buffer.split('\n');
      // keep last partial line in buffer
      buffer = parts.pop();
      for (const line of parts) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const payload = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
        if (payload === '[DONE]') continue;
        const text = extractTextFromData(payload);
        if (text) {
          res.write(`data: ${JSON.stringify({ delta: text })}\n\n`);
        }
      }
    }

    // process any remaining buffer
    if (buffer) {
      const trimmed = buffer.trim();
      if (trimmed && !trimmed.includes('[DONE]')) {
        const payload = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
        const text = extractTextFromData(payload);
        if (text) res.write(`data: ${JSON.stringify({ delta: text })}\n\n`);
      }
    }

    res.write('event: done\ndata: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('stream error', err);
    res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
}
