#!/bin/bash
mkdir -p /workspace

cat > /workspace/server.py << 'PYEOF'
# Slow API - runs ad-hoc aggregations on 5M rows
# User should optimize with materialized views and point this at pre-aggregated tables
import http.server
import json
import os
import subprocess

def run_clickhouse(query):
    url = os.environ.get("CLICKHOUSE_URL", "http://localhost:8123")
    import urllib.request
    req = urllib.request.Request(url, data=query.encode(), method="POST")
    with urllib.request.urlopen(req) as r:
        return r.read().decode()

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/api/metrics":
            q = "SELECT count() AS total, uniq(user_id) AS users, sum(revenue) AS revenue FROM analytics.events"
            out = run_clickhouse(q + " FORMAT JSONEachRow")
            rows = [json.loads(l) for l in out.strip().split("\n") if l]
            data = rows[0] if rows else {}
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"total_events": data.get("total"), "unique_users": data.get("users"), "total_revenue": data.get("revenue")}).encode())
        elif self.path == "/api/breakdown":
            q = "SELECT region, toDate(event_ts) AS day, count() AS cnt FROM analytics.events GROUP BY region, day ORDER BY region, day FORMAT JSONEachRow"
            out = run_clickhouse(q)
            rows = [json.loads(l) for l in out.strip().split("\n") if l]
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(rows).encode())
        else:
            self.send_response(404)
            self.end_headers()

http.server.HTTPServer(("0.0.0.0", 3000), Handler).serve_forever()
PYEOF

echo "Slow API script created. Run: python3 /workspace/server.py"