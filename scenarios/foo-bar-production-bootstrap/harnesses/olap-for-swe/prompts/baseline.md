I'm running a small product where I want to track events and look at simple
roll-ups in production. I just want a working URL — I don't want to manage
ClickHouse or Kubernetes myself.

Each event I'll send has these fields:

- `primaryKey` (string, unique per event)
- `timestamp` (Unix timestamp, seconds)
- `optionalText` (string, optional — free-form payload for some events)

I need:

- An HTTP endpoint I can POST events to.
- An HTTP endpoint I can GET aggregated counts back from (e.g. how many
  events landed today).
- A health endpoint so I can wire up an uptime check later.

Get me a production URL where this works. Write the deployed URL to
`/workspace/.deployed-url` and leave a note in `/workspace/README.md`
saying what you deployed.
