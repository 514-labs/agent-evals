# Launch Checklist and Post-Launch Sustain Plan

## T-3: Final Review

Before launching, confirm each item:

- [ ] All CTO feedback blockers resolved (514-758, 514-761, 514-756, 514-760, 514-759, 514-757)
- [ ] PR #22 merged (preflight checks, leaderboard, audit state, docs, comparison panel)
- [ ] At least 15 scenarios run across all 3 agents with valid scores (Evals plan)
- [ ] Leaderboard shows meaningful multi-agent comparison data
- [ ] README leads with research preview story and quick-start
- [ ] Landing page framing matches HN post and README
- [ ] Show HN draft reviewed and ready to post
- [ ] Channel copy drafted for X, Reddit, newsletters
- [ ] FAQ and talking points reviewed by team
- [ ] Demo video recorded (or decision to launch without it)
- [ ] Early users briefed 3-5 days prior
- [ ] `decbench.ai/install.sh` tested from a clean machine
- [ ] `dec-bench list`, `build`, `run`, `results`, `audit open` path works end-to-end
- [ ] OG cards and social preview images render correctly when shared

## Launch Day

### Channel Ownership

| Channel | Owner | Time | Asset |
|---------|-------|------|-------|
| Hacker News | Tim | Morning (PST) | Show HN post |
| X / Twitter | Tim | Same time as HN | Thread from channel copy |
| r/dataengineering | Tim | 30 min after HN | Reddit post from channel copy |
| r/programming | Tim | 30 min after HN | Reddit post from channel copy |
| r/MachineLearning | Tim | 30 min after HN | Reddit post from channel copy |
| Newsletter pitches | Tim | T-1 (day before) | Pitch emails from channel copy |
| Slack / Discord | Tim | After HN goes live | Internal launch kit short post |

### Response Protocol

- Monitor HN comments for the first 6 hours. Respond to technical questions using the FAQ.
- Monitor Reddit comments for the first 12 hours. Same FAQ-based responses.
- X replies: respond to genuine questions within 2 hours during the first day.
- Do not argue with critics. Acknowledge scope limitations directly: "Fair point -- this is a research preview, and [X] is explicitly deferred to v0.2."

### Day-of Checklist

- [ ] Post Show HN
- [ ] Post X thread
- [ ] Post Reddit threads (3 subreddits)
- [ ] Send newsletter pitches
- [ ] Post in internal Slack
- [ ] Monitor and respond to comments (6-hour block)
- [ ] Screenshot HN placement for metrics

## Post-Launch: Days 1-5

### Day 1

- Respond to all HN, Reddit, and X comments from launch day
- Track early metrics (stars, site visits, CLI installs)
- Note any recurring friction in feedback

### Day 2

- Post a "what we learned in the first 24 hours" internal update
- Fix any urgent issues surfaced by real users (don't wait for triage)
- Follow up with early users who tried it

### Day 3

- Second content beat: share a specific benchmark finding or comparison
- Post to any channels that missed the initial push
- Update the feedback triage with new items

### Days 4-5

- Compile first-week metrics against targets
- Write a short retrospective: what worked, what didn't, what to change for the next push
- Create follow-up issues for deferred feedback items
- Decide whether to do a second Reddit or newsletter push

## Assets Referenced

| Asset | Location | Status |
|-------|----------|--------|
| Show HN draft | Linear document | Done (514-744) |
| Channel-specific copy | `releases/0.1/channel-copy.md` | Draft |
| FAQ and talking points | `releases/0.1/faq-talking-points.md` | Done |
| Demo script | `releases/0.1/demo-script.md` | Done |
| Success metrics | `releases/0.1/success-metrics.md` | Done |
| Early users plan | `releases/0.1/early-users.md` | Done |
| Internal launch kit | `releases/0.1/internal-launch-kit.md` | Done |
| Competitive positioning | Linear document | Done (514-735) |
