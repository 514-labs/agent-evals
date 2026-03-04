Fix the Postgres readiness race condition:

1. The startup script at /workspace/start_app.py connects to Postgres immediately with no retry.
2. When the app and Postgres start together, the app often fails with "connection refused" because Postgres is not ready yet.
3. Add retry logic with exponential backoff (e.g. up to 30 seconds, 5 attempts) before giving up.
4. Use POSTGRES_URL from the environment. The script should exit 0 only after a successful connection and schema check (e.g. SELECT 1).
