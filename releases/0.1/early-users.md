# Pre-Launch Seeding Plan

## Approach

Reach out to 5-10 people 3-5 days before the wider research preview push. Give them enough context to try the benchmark and form real opinions. Do not script responses. The goal is authentic engagement from credible voices.

## Target Profiles

Prioritize people who:
- Build or evaluate AI coding agents professionally
- Work in data engineering and would recognize the scenarios as realistic
- Have a public presence (blog, Twitter, conference talks) that could amplify organically
- Are likely to give honest, critical feedback rather than polite silence

## Shortlist

| Name | Why | Channel | Status |
|------|-----|---------|--------|
| _[Data engineering lead at a company using AI agents]_ | Uses coding agents daily for DE work | DM / email | Not contacted |
| _[Author of a popular DE blog or newsletter]_ | Credible voice in the DE community | DM / email | Not contacted |
| _[Maintainer of an open-source DE tool]_ | Understands the tooling landscape | GitHub / DM | Not contacted |
| _[AI agent researcher or builder]_ | Works on agent evaluation | DM / email | Not contacted |
| _[Developer advocate at a cloud/data company]_ | Has audience and credibility | DM / email | Not contacted |
| _[Conference speaker on data engineering topics]_ | Known in the community | DM / email | Not contacted |
| _[Open-source contributor to SWE-bench or similar]_ | Understands eval methodology | GitHub / DM | Not contacted |

Fill in real names before outreach begins. Aim for 7-10 names; expect 3-5 to actually try it.

## Outreach Template

Keep it short. One paragraph of context, one concrete ask.

```
Subject: Early look at DEC Bench -- data engineering evals for AI agents

Hey [name],

We're about to release DEC Bench as a research preview -- an open-source benchmark that tests AI agents on real data engineering tasks (schema design, query optimization, pipeline debugging) against live Postgres, Redpanda, and ClickHouse.

Would you be willing to try one scenario before we push it wider? Install takes one line, the first eval runs in under 5 minutes, and I'd value your honest take on whether the methodology holds up.

https://github.com/514-labs/agent-evals

No pressure to post about it. If you try it and have thoughts, reply here or open a GitHub issue.

-- Tim
```

## Timeline

| Day | Action |
|-----|--------|
| T-5 | Finalize shortlist with real names |
| T-4 | Send outreach messages |
| T-3 | Follow up with anyone who hasn't responded |
| T-1 | Share launch timing with anyone who tried it |
| T+0 | Launch publicly |
| T+2 | Follow up with early users for feedback |
