import { getAdminFirestore, getAdminStorage } from '../../../lib/firebaseAdmin.js';
import { estimateCost } from '../../../lib/aiCost.js';

export default async function handler(req, res) {
  try {
    const firestore = getAdminFirestore();
    const storage = getAdminStorage();

    const { text, model } = req.body;

    const cost = estimateCost(text, model);

    res.status(200).json({
      success: true,
      summary: "Summarized text...",
      cost
    });
  } catch (error) {
    console.error("Summarize Error:", error);
    res.status(500).json({ error: error.message });
  }
}
