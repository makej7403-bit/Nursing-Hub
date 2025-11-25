import { getAdminFirestore } from '../../../lib/firebaseAdmin.js';

export default async function handler(req, res) {
  try {
    const firestore = getAdminFirestore();

    const { imageUrl } = req.body;

    res.status(200).json({
      success: true,
      text: "Extracted OCR text..."
    });
  } catch (error) {
    console.error("OCR Error:", error);
    res.status(500).json({ error: error.message });
  }
}
