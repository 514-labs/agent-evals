Build a natural language chat interface that translates user questions about taxi data into ClickHouse SQL.

## Data

Pre-seeded in ClickHouse:
- `raw.yellow_trips_2024_01` — ~2.96M rows of yellow taxi trips
- `raw.green_trips_2024_01` — ~85K rows of green taxi trips

First, design an analytics table that unifies both datasets with a `taxi_type` column (`'yellow'` or `'green'`), common column names (e.g., `pickup_datetime`, `fare_amount`, `total_amount`), and `ORDER BY (taxi_type, pickup_datetime)`.

## Chat Endpoint

`POST /chat` on `http://localhost:3000`

### Request Body
```json
{"question": "How many trips were there?"}
```

### Response Body
```json
{"answer": 3049670, "sql": "SELECT count() FROM analytics.trips", "explanation": "Counted all rows in the trips table."}
```

The endpoint should:
1. Parse the natural language question
2. Generate appropriate ClickHouse SQL
3. Execute the query
4. Return the answer with the SQL used

### SQL Translation Patterns
- "How many trips?" → `SELECT count() FROM ...`
- "Total revenue" → `SELECT sum(total_amount) FROM ...`
- "Average fare" → `SELECT avg(fare_amount) FROM ...`
- "How many green taxi trips?" → `SELECT count() FROM ... WHERE taxi_type = 'green'`

## Test Questions

Test questions with expected approximate answers are in `/data/taxi/test_questions.json`:
- "How many trips were there?" → ~3,000,000 (5% tolerance)
- "What was the total revenue?" → ~55,000,000 (5% tolerance)
- "What was the average fare?" → ~18 (10% tolerance)
- "How many green taxi trips?" → ~80,000 (5% tolerance)

## Output

Fill in `/workspace/assertions.json`:
- `chat_endpoint`: the endpoint path (e.g., `/chat`)
- `supported_question_types`: array of supported types (e.g., `["count", "sum", "average", "filter"]`)
