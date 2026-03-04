#!/bin/bash
set -euo pipefail
mkdir -p /workspace
# Broken API: shared mutable result buffer causes race under concurrency
cat > /workspace/server.js << 'EOF'
const http = require("http");
const { createClient } = require("@clickhouse/client");
const client = createClient({ url: process.env.CLICKHOUSE_URL || "http://localhost:8123" });

let cachedResult = null;
const server = http.createServer(async (req, res) => {
  if (req.url !== "/api/metrics") {
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }
  try {
    const r = await client.query({ query: "SELECT sum(value) AS total FROM analytics.metrics", format: "JSONEachRow" });
    cachedResult = await r.json();
    const total = cachedResult[0]?.total ?? 0;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ total }));
  } catch (e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: String(e.message) }));
  }
});

server.listen(3000, () => console.log("API on :3000"));
EOF
