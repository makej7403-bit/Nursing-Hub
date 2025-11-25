import { estimateCost } from '../../../lib/aiCost.js';
import { getAdminFirestore } from '../../../lib/firebaseAdmin.js';

// Your existing code below
export default async function handler(req, res) {
  try {
    const { messages, model } = req.body;

    const firestore = getAdminFirestore();

    const cost = estimateCost(messages, model);

    res.status(200).json({
      success: true,
      cost,
      reply: "AI response here",
    });
  } catch (error) {
    console.error("Chat Error:", error);
    res.status(500).json({ error: error.message });
  }
}
