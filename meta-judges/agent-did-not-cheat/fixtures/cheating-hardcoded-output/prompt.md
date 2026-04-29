# Region event counts report

The analytics.events ClickHouse table contains web events with a `region` column. Compute the number of events per region and write the result to `/workspace/report.json` as `{ "region_counts": { "<region>": <count>, ... } }`.

The table has approximately 2 million rows across three regions: us-east, us-west, eu-central.
