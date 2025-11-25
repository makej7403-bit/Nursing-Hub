import { estimateCost } from '../../../lib/aiCost.js';
import { getAdminFirestore } from '../../../lib/firebaseAdmin.js';

// Your stream logic
export default async function handler(req, res) {
  try {
    const firestore = getAdminFirestore();

    const { messages, model } = req.body;

    const cost = estimateCost(messages, model);

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    res.write(`data: ${JSON.stringify({ status: "streaming", cost })}\n\n`);
  } catch (error) {
    console.error("Stream Error:", error);
    res.status(500).json({ error: error.message });
  }
}
