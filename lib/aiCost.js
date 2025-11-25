/**
 * aiCost.js
 * Utility to estimate cost of OpenAI calls based on token usage and configurable model pricing.
 *
 * Model pricing can be provided via env var MODEL_PRICING as JSON:
 * e.g. MODEL_PRICING='{"gpt-3.5-turbo":0.002, "gpt-4":0.03}'
 * Values are price per 1000 tokens in USD.
 *
 * If MODEL_PRICING is not provided, defaults are used but these are only examples and may be outdated.
 */

const DEFAULT_PRICING = {
  "gpt-3.5-turbo": 0.002, // USD per 1k tokens (example)
  "gpt-4": 0.03 // USD per 1k tokens (example)
};

export function getModelPricing() {
  try {
    const env = process.env.MODEL_PRICING;
    if (env) {
      return JSON.parse(env);
    }
  } catch (e) {
    console.warn('Failed to parse MODEL_PRICING env var:', e.message);
  }
  return DEFAULT_PRICING;
}

/**
 * usageObj: an object from OpenAI response usage { prompt_tokens, completion_tokens, total_tokens }
 * model: string model name
 * returns { cost: number, breakdown: { pricePer1k, tokens, cost } }
 */
export function estimateCost(usageObj, model = 'gpt-3.5-turbo') {
  const pricing = getModelPricing();
  const pricePer1k = pricing[model] || pricing['gpt-3.5-turbo'] || DEFAULT_PRICING['gpt-3.5-turbo'];
  const tokens = (usageObj && (usageObj.total_tokens || (usageObj.prompt_tokens||0)+(usageObj.completion_tokens||0))) || 0;
  const cost = (tokens / 1000) * pricePer1k;
  return { cost, breakdown: { pricePer1k, tokens, cost } };
}
