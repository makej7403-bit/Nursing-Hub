import { getAdminStorage, getAdminFirestore } from "../../../lib/firebaseAdmin";
import pdf from "pdf-parse";
import { estimateCost } from '../../../lib/aiCost.js';

const OPENAI_KEY = process.env.OPENAI_API_KEY;

async function callOpenAI(prompt, max_tokens = 800) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a concise assistant specialized in nursing education. Produce clear, bullet-point summaries and highlight key facts, clinical steps, and study tips." },
        { role: "user", content: prompt }
      ],
      max_tokens,
      temperature: 0.2
    })
  });

  const data = await res.json();
  if (!res.ok) {
    const txt = JSON.stringify(data);
    throw new Error(`OpenAI error: ${res.status} ${txt}`);
  }
  return data;
}

async function downloadFileFromBucket(storageBucket, path) {
  const file = storageBucket.file(path);
  const [exists] = await file.exists();
  if (!exists) throw new Error("File not found in storage: " + path);
  const [buffer] = await file.download();
  return buffer;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { filePath, fileUrl, userId, requestor } = req.body;
  if (!filePath && !fileUrl) return res.status(400).json({ error: "filePath or fileUrl required" });

  try {
    const bucket = getAdminStorage();
    let text = "";

    if (filePath) {
      const buffer = await downloadFileFromBucket(bucket, filePath);
      try {
        const pdfData = await pdf(buffer);
        text = pdfData.text || "";
      } catch (e) {
        text = buffer.toString("utf8").slice(0, 50000);
      }
    } else {
      const r = await fetch(fileUrl);
      if (!r.ok) throw new Error("Could not fetch file URL");
      const buf = Buffer.from(await r.arrayBuffer());
      try {
        const pdfData = await pdf(buf);
        text = pdfData.text || "";
      } catch (e) {
        text = buf.toString("utf8").slice(0, 50000);
      }
    }

    if (!text || text.trim().length < 20) {
      return res.status(400).json({ error: "Could not extract text from file. If the file is a scanned PDF you need OCR (Tesseract/Cloud Vision).", extractedTextLength: text.length });
    }

    const truncated = text.length > 24000 ? text.slice(0, 24000) : text;
    const prompt = `Summarize the following nursing document into:
1) 6–10 bullet point key facts or steps
2) 3 practical clinical tips
3) 1 short study checklist
Document:
${truncated}

If the document is longer, mention that the summary is partial.`;

    const data = await callOpenAI(prompt, 800);
    const reply = data.choices?.[0]?.message?.content || '';
    const usage = data.usage || null;
    const costInfo = usage ? estimateCost(usage, 'gpt-3.5-turbo') : null;

    // Log usage
    try {
      const db = getAdminFirestore();
      await db.collection('ai_usage').add({
        type: 'summarize',
        filePath: filePath || null,
        fileUrl: fileUrl || null,
        userId: userId || null,
        requestor: requestor || null,
        promptLength: prompt.length,
        usage,
        costInfo,
        createdAt: new Date()
      });
    } catch (e) {
      console.warn('Failed to log ai_usage:', e);
    }

    return res.status(200).json({ summary: reply, usage, costInfo });
  } catch (err) {
    console.error('summarize error:', err);
    return res.status(500).json({ error: err.message });
  }
}
