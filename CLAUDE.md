# Content Agent Dashboard

## Who this is for
- Instagram: @kamil.ozornek.dubai (https://www.instagram.com/kamil.ozornek.dubai/)
- Niche: Dubai real estate (agent/broker content — property showcases, market commentary, lifestyle/personal branding)
- Voice: TBD — refine once we see top-performing posts (Step 2). Placeholder: confident, local-market-expert, high-energy, Dubai lifestyle aesthetic.

## Competitors tracked
- @jake_nazer
- @mattsiddell
- @kamilmagrealestate
- @jameshsahota
- @adel_chynystanov_

## What this project is
Five AI "agents" that run this creator's Instagram content operation:
1. **Ideator** — scouts content ideas from own + competitor top posts
2. **Hook & Script** — drafts hooks/scripts for chosen ideas
3. **Planner** — lays out a daily content calendar
4. **Analyst** — analyses real stats (own + competitors)
5. **DM Manager** — handles/triages DMs

All five are surfaced on a dashboard (`dashboard/`) driven by real scraped data
(`dashboard/data.json`), and report a digest to Telegram.

## Structure
- `scripts/` — Node scripts (Apify scraping, ranking, Telegram sender, scheduler)
- `dashboard/` — self-contained static dashboard (index.html + JS/CSS + data.json)
- `.env` — secrets (Apify token, Telegram bot token/chat id). Gitignored. Never committed, never printed.

## Data rules
- Use Apify's `instagram-scraper` Actor with `resultsType: posts` for full post history —
  NOT `instagram-profile-scraper`'s `latestPosts` field, which only returns recent posts
  and will misrepresent all-time top performers.
- Rank posts by views (video plays) to find true top content.

## Status
- [x] Step 1: Project scaffolded
- [ ] Step 2: Pull real Instagram data (own + competitors), find true top posts
- [ ] Step 3: Build the dashboard
- [ ] Step 4: Telegram bot wired up
- [ ] Step 5: Scheduled automated run
- [ ] Step 6: Full end-to-end proof run
