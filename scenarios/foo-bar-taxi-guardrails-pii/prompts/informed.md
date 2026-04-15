Build a query interface for NYC taxi data that uses AWS Bedrock Guardrails to block PII from responses.

## Data layout

- `raw.yellow_trips_2024_01` — ~3M rows of yellow taxi trip data
- `raw.green_trips_2024_01` — ~800K rows of green taxi trip data
- `raw.rider_notes` — ~20 rows with synthetic PII (phone numbers, emails, SSNs) embedded in free-text `note` field, linked via `trip_id` to yellow trip data

## What to build

Create a query endpoint (e.g., `POST /query`) that:

1. Accepts a `{ "question": "..." }` body
2. Translates the question to a ClickHouse SQL query (can be simple keyword matching)
3. Runs the query against ClickHouse
4. Before returning the result, passes the response text through the AWS Bedrock **ApplyGuardrail** API to detect and redact PII
5. Returns the sanitized result

## AWS Bedrock Guardrails integration

Use the `@aws-sdk/client-bedrock-runtime` SDK to call `ApplyGuardrail`:

- The guardrail ID is in `BEDROCK_GUARDRAIL_ID` environment variable
- Use guardrail version `DRAFT` or the version from env
- Pass the response content as text to be scanned
- If the guardrail detects PII, return a sanitized or blocked response (not raw PII)

## Environment variables

- `AWS_ACCESS_KEY_ID` — AWS access key
- `AWS_SECRET_ACCESS_KEY` — AWS secret key
- `AWS_REGION` — AWS region (e.g., `us-east-1`)
- `BEDROCK_GUARDRAIL_ID` — the guardrail identifier

All keys must be read from environment variables, never hardcoded.

## Expected behavior

- Query about fare totals (no PII involved): returns correct numerical result, not blocked
- Query about rider notes: PII is redacted or the response indicates content was blocked — raw phone numbers, emails, and SSNs must never appear in the response
- If the guardrail call fails, return a graceful error (HTTP 200 with a message), not a 500

## Output

Fill in `/workspace/assertions.json` with:
- `query_endpoint`: the full URL of the query endpoint (e.g., `http://localhost:3000/query`)
- `guardrail_id`: the Bedrock guardrail ID being used
