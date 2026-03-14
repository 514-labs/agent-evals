import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateModelCostUsd,
  calculateTokensUsed,
  deriveLlmMetrics,
  normalizePricingModel,
} from "./llm-pricing.mjs";

test("normalizes pricing model aliases", () => {
  assert.equal(normalizePricingModel("composer"), "composer-1.5");
  assert.equal(normalizePricingModel("Composer 1.5"), "composer-1.5");
  assert.equal(normalizePricingModel("gpt-5.1-codex-mini"), "gpt-5.1-codex-mini");
});

test("derives gpt-5.1-codex-mini metrics with cached input pricing", () => {
  const metrics = deriveLlmMetrics({
    model: "gpt-5.1-codex-mini",
    usage: {
      inputTokens: 92_917,
      cachedInputTokens: 82_304,
      outputTokens: 7_559,
      totalCostUsd: 0,
    },
  });

  assert.equal(metrics.tokensUsed, 182_780);
  assert.equal(metrics.llmApiCostUsd, 0.04040485);
});

test("applies gpt-5.4 long-context pricing multipliers", () => {
  const costUsd = calculateModelCostUsd("gpt-5.4", {
    inputTokens: 300_000,
    cachedInputTokens: 200_000,
    outputTokens: 1_000,
  });

  assert.equal(costUsd, 1.6225);
});

test("derives composer 1.5 cost from input and output tokens", () => {
  const metrics = deriveLlmMetrics({
    model: "composer",
    usage: {
      inputTokens: 462_887,
      outputTokens: 5_105,
    },
  });

  assert.equal(metrics.tokensUsed, 467_992);
  assert.equal(metrics.llmApiCostUsd, 1.709442);
  assert.equal(metrics.llmApiCostSource, "derived-from-published-pricing");
});

test("preserves explicit nonzero costs", () => {
  const metrics = deriveLlmMetrics({
    model: "gpt-5.4",
    usage: {
      inputTokens: 100,
      outputTokens: 50,
      totalCostUsd: 0.123,
    },
  });

  assert.equal(metrics.llmApiCostUsd, 0.123);
  assert.equal(calculateTokensUsed(metrics.usage), 150);
  assert.equal(metrics.llmApiCostSource, "agent-reported");
});

test("counts cache write tokens in totals", () => {
  const metrics = deriveLlmMetrics({
    model: "composer",
    usage: {
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 25,
      cacheWriteTokens: 10,
    },
  });

  assert.equal(metrics.tokensUsed, 185);
});

test("preserves derived pricing provenance on rewritten usage", () => {
  const metrics = deriveLlmMetrics({
    model: "gpt-5.4",
    usage: {
      inputTokens: 175_480,
      cachedInputTokens: 159_872,
      outputTokens: 5_146,
      totalCostUsd: 0.555858,
      pricingSource: "derived-from-published-pricing",
    },
  });

  assert.equal(metrics.llmApiCostUsd, 0.555858);
  assert.equal(metrics.llmApiCostSource, "derived-from-published-pricing");
});
