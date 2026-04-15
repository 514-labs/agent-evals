Instrument the taxi data query agent in /workspace/ with Langfuse tracing.

## Agent overview

The agent is a Node.js Express app (`/workspace/agent/index.js`) that exposes a `POST /query` endpoint. It accepts a `{ "question": "..." }` body, translates the question into a ClickHouse SQL query, runs it, and returns the result. The agent currently has zero observability instrumentation.

## What to add

Use the Langfuse Node.js SDK (`langfuse`) to wrap the agent's request lifecycle:

1. **Trace per request** — Create a Langfuse trace for each `/query` invocation. Set the trace name to something descriptive (e.g., `taxi-query`). Attach the input question as trace input.
2. **Span for tool calls** — Wrap the SQL generation step in a span (e.g., `generate-sql`). Record the generated SQL as the span output.
3. **Generation for LLM calls** — If the agent calls an LLM to produce the SQL, record it as a Langfuse generation with model name, prompt, and completion.
4. **Span for query execution** — Wrap the ClickHouse query execution in a span (e.g., `execute-query`). Record row count and latency.
5. **Trace output** — Set the final response as the trace output and end the trace.

## Environment variables

- `LANGFUSE_PUBLIC_KEY` — Langfuse public key
- `LANGFUSE_SECRET_KEY` — Langfuse secret key
- `LANGFUSE_HOST` — Langfuse API base URL (e.g., `https://cloud.langfuse.com`)

All keys must be read from environment variables, never hardcoded.

## Graceful degradation

If Langfuse is unreachable (network error, wrong keys), the agent must still return query answers. Tracing failures should be caught and logged, not thrown.

## Output

Fill in `/workspace/assertions.json` with:
- `agent_endpoint`: the full URL of the agent's query endpoint (e.g., `http://localhost:3000/query`)
- `langfuse_project`: the Langfuse project name or ID being used
