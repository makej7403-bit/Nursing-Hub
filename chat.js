import { estimateCost } from '../../lib/aiCost.js';

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { message, model = 'gpt-3.5-turbo' } = req.body;
  if (!message || typeof message !== "string") return res.status(400).json({ error: "Message is required" });

  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) return res.status(500).json({ error: "OpenAI API key not configured." });

  try {
    const body = {
      model,
      messages: [
        { role: "system", content: "You are a helpful, concise assistant specialized in nursing education. Provide clear, evidence-based explanations and study-friendly summaries." },
        { role: "user", content: message }
      ],
      temperature: 0.2,
      max_tokens: 800
    };

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify(body)
    });

    const data = await openaiRes.json();
    if (!openaiRes.ok) {
      const txt = JSON.stringify(data);
      console.error("OpenAI error", openaiRes.status, txt);
      return res.status(502).json({ error: "OpenAI API error", detail: txt });
    }

    const reply = data.choices?.[0]?.message?.content || "No response from model.";
    const usage = data.usage || null;
    const costInfo = usage ? estimateCost(usage, model) : null;

    // Try to log usage to Firestore via admin SDK if available (best-effort)
    try {
      const { getAdminFirestore } = await import('../../lib/firebaseAdmin.js');
      const db = getAdminFirestore();
      await db.collection('ai_usage').add({
        type: 'chat',
        prompt: message.slice(0,1000),
        replySnippet: reply.slice(0,1000),
        usage,
        costInfo,
        model,
        createdAt: new Date()
      });
    } catch (e) {
      console.warn('Could not log ai usage:', e.message);
    }

    return res.status(200).json({ reply, usage, costInfo });
  } catch (err) {
    console.error("Server error", err);
    return res.status(500).json({ error: err.message });
  }
}
