#!/bin/bash
mkdir -p /workspace

cat > /workspace/start_app.py << 'PYEOF'
import psycopg2
import os
# Broken: no retry - fails if Postgres not ready
conn = psycopg2.connect(os.environ.get("POSTGRES_URL", "postgresql://postgres@localhost:5432/postgres"))
conn.close()
print("Connected")
PYEOF

echo "Broken startup script created."