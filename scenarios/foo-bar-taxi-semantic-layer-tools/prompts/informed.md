Raw NYC taxi trip data is pre-loaded in ClickHouse:
- `raw.yellow_trips_2024_01` -- ~3M rows of yellow taxi trips
- `raw.green_trips_2024_01` -- ~85K rows of green taxi trips

## Schema differences

- Yellow uses `tpep_pickup_datetime` / `tpep_dropoff_datetime`; green uses `lpep_pickup_datetime` / `lpep_dropoff_datetime`.
- Green has an extra `trip_type` column.
- Unify into a single analytics table with a `taxi_type` discriminator column.

## Analytics schema

Design a clean analytics table with:
- Unified `pickup_datetime` / `dropoff_datetime` columns
- A `taxi_type` column (`'yellow'` or `'green'`)
- Proper ORDER BY for time-range and taxi-type queries, e.g. `ORDER BY (taxi_type, pickup_datetime)`
- Consider PARTITION BY `toYYYYMM(pickup_datetime)` for future scalability

## Metrics to define

Define at least these four semantic metrics:
1. **avg_fare** -- average `fare_amount` across trips
2. **total_revenue** -- sum of `total_amount`
3. **trips_per_day** -- count of trips grouped by date
4. **avg_distance** -- average `trip_distance`

Store metric definitions in a YAML or JSON config file so they are declarative and inspectable.

## MCP tools

Expose the metrics as MCP tools using the Model Context Protocol. Each tool should:
- Accept parameters for filtering: `taxi_type` (optional, enum: `"yellow"`, `"green"`), `start_date` (optional, ISO date string), `end_date` (optional, ISO date string)
- Return a JSON object with `metric`, `value`, and `filters` fields

Expected MCP tool interface:
```json
{
  "name": "get_total_revenue",
  "description": "Get total revenue from taxi trips",
  "inputSchema": {
    "type": "object",
    "properties": {
      "taxi_type": {"type": "string", "enum": ["yellow", "green"]},
      "start_date": {"type": "string", "format": "date"},
      "end_date": {"type": "string", "format": "date"}
    }
  }
}
```

Start the MCP server and set the `MCP_SERVER_URL` environment variable. A tool call with invalid parameters should return a structured error message, not crash the server.

## Output

Fill in `/workspace/assertions.json` with `analytics_table_name`, `metric_names` (array), `definition_file` (path to metric definitions), `tool_names` (array of MCP tool names), and `mcp_server_url`.
