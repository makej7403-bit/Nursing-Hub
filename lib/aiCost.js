// lib/aiCost.js
/**
 * Estimate OpenAI call cost from usage object.
 * Defaults to example pricing for gpt-4o-mini (USD per 1000 tokens).
 *
 * To override pricing, set env var MODEL_PRICING as JSON string, e.g:
 * MODEL_PRICING='{"gpt-4o-mini":0.0015,"gpt-4o":0.03,"gpt-3.5-turbo":0.002}'
 *
 * The price values should be USD per 1000 tokens.
 */

const DEFAULT_PRICING = {
  "gpt-4o-mini": 0.0015,   // example: $0.0015 per 1k tokens (set to your plan)
  "gpt-4o": 0.03,
  "gpt-3.5-turbo": 0.002
};

export function getModelPricing() {
  try {
    const raw = process.env.MODEL_PRICING;
    if (raw) {
      return { ...DEFAULT_PRICING, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn("lib/aiCost: failed to parse MODEL_PRICING env var:", e.message);
  }
  return DEFAULT_PRICING;
}

/**
 * usageObj: { prompt_tokens, completion_tokens, total_tokens } or similar
 * model: model name string
 * returns { cost, breakdown }
 */
export function estimateCost(usageObj, model = "gpt-4o-mini") {
  const pricing = getModelPricing();
  const pricePer1k = pricing[model] ?? pricing["gpt-4o-mini"] ?? 0;
  const tokens = usageObj ? (usageObj.total_tokens ?? ((usageObj.prompt_tokens ?? 0) + (usageObj.completion_tokens ?? 0))) : 0;
  const cost = (tokens / 1000) * pricePer1k;
  return {
    cost,
    breakdown: {
      pricePer1k,
      tokens,
      cost
    }
  };
}
