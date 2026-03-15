const MILLION = 1_000_000;
const GPT_5_4_LONG_CONTEXT_THRESHOLD = 272_000;

const MODEL_ALIASES = new Map([
  ["composer", "composer-1.5"],
  ["composer-1.5", "composer-1.5"],
  ["composer 1.5", "composer-1.5"],
  ["gpt-5.1-codex-mini", "gpt-5.1-codex-mini"],
  ["gpt-5.1 codex mini", "gpt-5.1-codex-mini"],
  ["gpt-5 mini", "gpt-5-mini"],
  ["gpt-5-mini", "gpt-5-mini"],
  ["gpt-5.4", "gpt-5.4"],
]);

const MODEL_PRICING = {
  "composer-1.5": {
    inputPerMillion: 3.5,
    cachedInputPerMillion: 0.35,
    outputPerMillion: 17.5,
  },
  "gpt-5-mini": {
    inputPerMillion: 0.25,
    cachedInputPerMillion: 0.025,
    outputPerMillion: 2,
  },
  "gpt-5.1-codex-mini": {
    inputPerMillion: 0.25,
    cachedInputPerMillion: 0.025,
    outputPerMillion: 2,
  },
  "gpt-5.4": {
    inputPerMillion: 2.5,
    cachedInputPerMillion: 0.25,
    outputPerMillion: 15,
    longContextThreshold: GPT_5_4_LONG_CONTEXT_THRESHOLD,
    longContextInputMultiplier: 2,
    longContextCachedInputMultiplier: 2,
    longContextOutputMultiplier: 1.5,
  },
};

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function roundUsd(value) {
  return Number(value.toFixed(12));
}

export function normalizePricingModel(model) {
  if (typeof model !== "string") return null;
  const normalized = model.trim().toLowerCase();
  if (!normalized) return null;
  return MODEL_ALIASES.get(normalized) ?? normalized;
}

export function extractUsageMetrics(rawUsage) {
  const usage = rawUsage && typeof rawUsage === "object" ? rawUsage : {};
  return {
    inputTokens: toNumber(usage.inputTokens ?? usage.input_tokens ?? usage.promptTokens ?? usage.prompt_tokens),
    outputTokens: toNumber(
      usage.outputTokens ?? usage.output_tokens ?? usage.completionTokens ?? usage.completion_tokens,
    ),
    cachedInputTokens: toNumber(usage.cachedInputTokens ?? usage.cached_input_tokens),
    cacheCreationTokens: toNumber(usage.cacheCreationTokens ?? usage.cache_creation_tokens),
    cacheReadTokens: toNumber(usage.cacheReadTokens ?? usage.cache_read_tokens),
    cacheWriteTokens: toNumber(usage.cacheWriteTokens ?? usage.cache_write_tokens),
    totalCostUsd: toNumber(usage.totalCostUsd ?? usage.total_cost_usd ?? usage.costUsd ?? usage.cost_usd),
  };
}

export function calculateTokensUsed(rawUsage) {
  const usage = extractUsageMetrics(rawUsage);
  return (
    usage.inputTokens +
    usage.outputTokens +
    usage.cachedInputTokens +
    usage.cacheCreationTokens +
    usage.cacheReadTokens +
    usage.cacheWriteTokens
  );
}

export function calculateModelCostUsd(model, rawUsage) {
  const canonicalModel = normalizePricingModel(model);
  if (!canonicalModel) return null;

  const pricing = MODEL_PRICING[canonicalModel];
  if (!pricing) return null;

  const usage = extractUsageMetrics(rawUsage);
  let inputPerMillion = pricing.inputPerMillion;
  let cachedInputPerMillion = pricing.cachedInputPerMillion ?? 0;
  let outputPerMillion = pricing.outputPerMillion;

  if (
    pricing.longContextThreshold &&
    usage.inputTokens > pricing.longContextThreshold
  ) {
    inputPerMillion *= pricing.longContextInputMultiplier ?? 1;
    cachedInputPerMillion *= pricing.longContextCachedInputMultiplier ?? 1;
    outputPerMillion *= pricing.longContextOutputMultiplier ?? 1;
  }

  const cacheCreationPerMillion = pricing.cacheCreationPerMillion ?? inputPerMillion;
  const cacheReadPerMillion = pricing.cacheReadPerMillion ?? cachedInputPerMillion;
  const cacheWritePerMillion = pricing.cacheWritePerMillion ?? cacheCreationPerMillion;

  const total =
    (usage.inputTokens * inputPerMillion) / MILLION +
    (usage.cachedInputTokens * cachedInputPerMillion) / MILLION +
    (usage.cacheCreationTokens * cacheCreationPerMillion) / MILLION +
    (usage.cacheReadTokens * cacheReadPerMillion) / MILLION +
    (usage.cacheWriteTokens * cacheWritePerMillion) / MILLION +
    (usage.outputTokens * outputPerMillion) / MILLION;

  return roundUsd(total);
}

export function deriveLlmMetrics({ model, usage }) {
  const normalizedUsage = extractUsageMetrics(usage);
  const explicitCostUsd = normalizedUsage.totalCostUsd;
  const usagePricingSource =
    usage && typeof usage === "object" && usage.pricingSource === "derived-from-published-pricing"
      ? "derived-from-published-pricing"
      : usage && typeof usage === "object" && usage.pricingSource === "agent-reported"
        ? "agent-reported"
        : null;
  const shouldTreatCostAsExplicit = explicitCostUsd > 0 && usagePricingSource !== "derived-from-published-pricing";
  const derivedCostUsd = shouldTreatCostAsExplicit
    ? explicitCostUsd
    : calculateModelCostUsd(model, normalizedUsage) ?? explicitCostUsd;
  const llmApiCostSource = shouldTreatCostAsExplicit
    ? "agent-reported"
    : "derived-from-published-pricing";

  return {
    pricingModel: normalizePricingModel(model),
    tokensUsed: calculateTokensUsed(normalizedUsage),
    llmApiCostUsd: roundUsd(derivedCostUsd),
    llmApiCostSource,
    usage: {
      ...normalizedUsage,
      totalCostUsd: roundUsd(derivedCostUsd),
      pricingSource: llmApiCostSource,
    },
    hasExplicitCost: shouldTreatCostAsExplicit,
    hasDerivedCost: !shouldTreatCostAsExplicit && derivedCostUsd > 0,
  };
}
