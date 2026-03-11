Ingest five CSV files from /data/csv/ into a single ClickHouse table `analytics.events`.

Known issues in the source files:
- `events_01.csv`: standard, clean baseline
- `events_02.csv`: dates are in `DD/MM/YYYY` format instead of ISO-8601
- `events_03.csv`: nulls represented as "N/A", "null", and empty strings
- `events_04.csv`: duplicate header row mid-file
- `events_05.csv`: trailing comma on every row

Target schema:
- event_id: String
- event_ts: DateTime
- user_id: String
- event_type: String
- value: Float64 (nullable values should be 0)
