Final additions in this package:
- Cost estimation: both chat and summarize endpoints now record OpenAI 'usage' and estimate cost using MODEL_PRICING env var (price per 1000 tokens). Set MODEL_PRICING as JSON in env vars, e.g.:

	MODEL_PRICING='{"gpt-3.5-turbo":0.002, "gpt-4":0.03}'

- Robust streaming: server proxy parses OpenAI event stream safely across chunk boundaries and forwards only text deltas as SSE 'data' messages.

- OCR: /api/ocr/vision supports Google Cloud Vision (set VISION_API_KEY) and falls back to Tesseract CLI if available on the server.

Important operational notes:
- Tesseract CLI must be installed on the server for the fallback to work (e.g., apt-get install tesseract-ocr).
- MODEL_PRICING default values are examples. Update MODEL_PRICING env var with current prices to get accurate cost estimates.
- Keep OPENAI_API_KEY and FIREBASE_SERVICE_ACCOUNT secret.
