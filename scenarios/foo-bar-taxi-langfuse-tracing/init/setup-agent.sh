#!/bin/bash
set -euo pipefail

mkdir -p /workspace/agent

cat > /workspace/agent/package.json << 'PKGJSON'
{
  "name": "taxi-query-agent",
  "version": "1.0.0",
  "description": "NL-to-SQL query agent for NYC taxi data",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "@clickhouse/client": "^0.2.10"
  }
}
PKGJSON

cat > /workspace/agent/index.js << 'AGENTJS'
const express = require("express");
const { createClient } = require("@clickhouse/client");

const app = express();
app.use(express.json());

const clickhouse = createClient({
  url: process.env.CLICKHOUSE_URL || "http://localhost:8123",
});

// Simple NL-to-SQL: maps keywords to canned queries.
// A real agent would call an LLM here — this is intentionally simple.
function questionToSQL(question) {
  const q = question.toLowerCase();
  if (q.includes("total trips") || q.includes("how many trips")) {
    return "SELECT count() AS total_trips FROM raw.yellow_trips_2024_01";
  }
  if (q.includes("average fare") || q.includes("avg fare")) {
    return "SELECT round(avg(fare_amount), 2) AS avg_fare FROM raw.yellow_trips_2024_01";
  }
  if (q.includes("max tip") || q.includes("biggest tip")) {
    return "SELECT max(tip_amount) AS max_tip FROM raw.yellow_trips_2024_01";
  }
  if (q.includes("green")) {
    return "SELECT count() AS total_green_trips FROM raw.green_trips_2024_01";
  }
  // Default: total revenue
  return "SELECT round(sum(total_amount), 2) AS total_revenue FROM raw.yellow_trips_2024_01";
}

app.post("/query", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ error: "Missing question field" });
    }

    const sql = questionToSQL(question);
    const result = await clickhouse.query({ query: sql, format: "JSONEachRow" });
    const rows = await result.json();

    res.json({ question, sql, result: rows });
  } catch (err) {
    console.error("Query error:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Taxi query agent listening on port ${PORT}`);
});
AGENTJS

cd /workspace/agent && npm install --production 2>/dev/null || true
