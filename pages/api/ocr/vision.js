/**
 * OCR endpoint: tries Google Vision REST if VISION_API_KEY is set,
 * otherwise falls back to server-installed Tesseract CLI if available.
 *
 * Note: For Tesseract fallback you must have `tesseract` installed on the server/runtime.
 */

import { getAdminStorage } from '../../../lib/firebaseAdmin.js';
import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { filePath, fileUrl } = req.body;
  if (!filePath && !fileUrl) return res.status(400).json({ error: 'filePath or fileUrl required' });

  const API_KEY = process.env.VISION_API_KEY;
  try {
    let buffer;
    if (filePath) {
      const bucket = getAdminStorage();
      const file = bucket.file(filePath);
      const [exists] = await file.exists();
      if (!exists) return res.status(404).json({ error: 'File not found' });
      const arr = await file.download();
      buffer = arr[0];
    } else {
      const r = await fetch(fileUrl);
      if (!r.ok) return res.status(400).json({ error: 'Could not fetch fileUrl' });
      buffer = Buffer.from(await r.arrayBuffer());
    }

    if (API_KEY) {
      const contentBase64 = buffer.toString('base64');
      const visionReq = {
        requests: [
          {
            image: { content: contentBase64 },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }]
          }
        ]
      };

      const visionRes = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(visionReq)
      });

      const data = await visionRes.json();
      return res.status(200).json({ ocr: data });
    } else {
      // Fallback to Tesseract CLI
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-'));
      const imgPath = path.join(tmpDir, 'input');
      fs.writeFileSync(imgPath, buffer);
      const outPath = path.join(tmpDir, 'out');

      try {
        await new Promise((resolve, reject) => {
          execFile('tesseract', [imgPath, outPath, '--dpi', '300'], (err) => {
            if (err) return reject(err);
            resolve();
          });
        });
        const text = fs.readFileSync(outPath + '.txt', 'utf8');
        // cleanup
        try { fs.rmSync(tmpDir, { recursive: true }); } catch(e){}
        return res.status(200).json({ ocr: { text } });
      } catch (err) {
        try { fs.rmSync(tmpDir, { recursive: true }); } catch(e){}
        return res.status(500).json({ error: 'Tesseract failed or not installed', detail: err.message });
      }
    }
  } catch (err) {
    console.error('OCR error', err);
    return res.status(500).json({ error: err.message });
  }
}
