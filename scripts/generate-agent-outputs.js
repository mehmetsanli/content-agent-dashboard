import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '..', 'dashboard', 'data.json');
const OUT_PATH = join(__dirname, '..', 'dashboard', 'agent-outputs.json');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const data = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
const own = data.own;
const competitors = data.competitors;

function snippet(caption, len = 90) {
  if (!caption) return '';
  const c = caption.trim().replace(/\s+/g, ' ');
  return c.length > len ? c.slice(0, len).trimEnd() + '…' : c;
}

// ---------- Ideator: best-performing competitor posts, ranked as ideas ----------
const allCompetitorPosts = competitors.flatMap((c) =>
  c.topPosts.map((p) => ({ ...p, competitorHandle: c.handle })),
);
const rankedCompetitorIdeas = [...allCompetitorPosts]
  .sort((a, b) => (b.views ?? -1) - (a.views ?? -1))
  .slice(0, 8)
  .map((p) => ({
    source: p.competitorHandle,
    url: p.url,
    type: p.type,
    views: p.views,
    likes: p.likes,
    caption: snippet(p.caption),
    angle: p.type === 'Video'
      ? `Video format worked for @${p.competitorHandle} — worth a version in your own voice.`
      : `Photo/carousel that outperformed peers for @${p.competitorHandle}.`,
  }));

const ideator = {
  postsAnalyzed: allCompetitorPosts.length + own.postsScraped,
  topIdea: rankedCompetitorIdeas[0] ?? null,
  ideas: rankedCompetitorIdeas,
};

// ---------- Hook & Script: draft hooks from your own top-performing posts ----------
const hookTemplates = [
  (c) => `Stop scrolling if you're buying property in Dubai — here's what nobody tells you: ${c}`,
  (c) => `I get asked this every week: ${c}`,
  (c) => `This one post did ${'{{views}}'} views because of one line: "${c}"`,
];

const scripts = own.topPosts.slice(0, 3).map((p, i) => ({
  basedOn: p.url,
  originalViews: p.views,
  originalCaption: snippet(p.caption, 140),
  draftHook: hookTemplates[i % hookTemplates.length](snippet(p.caption, 70)).replace(
    '{{views}}',
    p.views != null ? p.views.toLocaleString() : 'strong',
  ),
}));

const hookScript = {
  draftedFrom: own.topPosts.length,
  scripts,
};

// ---------- Planner: posting cadence from real timestamps ----------
const dayCounts = new Array(7).fill(0);
const dayViewTotals = new Array(7).fill(0);
const dayViewCounts = new Array(7).fill(0);

for (const p of own.allPosts) {
  if (!p.timestamp) continue;
  const day = new Date(p.timestamp).getUTCDay();
  dayCounts[day] += 1;
  if (p.views != null) {
    dayViewTotals[day] += p.views;
    dayViewCounts[day] += 1;
  }
}

const dayStats = DAY_NAMES.map((name, i) => ({
  day: name,
  postsHistorical: dayCounts[i],
  avgViews: dayViewCounts[i] ? Math.round(dayViewTotals[i] / dayViewCounts[i]) : null,
}));

const bestDays = [...dayStats]
  .filter((d) => d.avgViews != null)
  .sort((a, b) => b.avgViews - a.avgViews)
  .slice(0, 3)
  .map((d) => d.day);

const ideaQueue = rankedCompetitorIdeas.slice(0, 7);
const today = new Date();
const calendar = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() + i);
  const dayName = DAY_NAMES[d.getUTCDay()];
  return {
    date: d.toISOString().slice(0, 10),
    day: dayName,
    recommended: bestDays.includes(dayName),
    slot: ideaQueue[i] ? `${ideaQueue[i].type} idea from @${ideaQueue[i].source}` : 'Open slot — needs new idea',
  };
});

const planner = { dayStats, bestDays, calendar };

// ---------- Analyst: real stats summary + competitor comparison ----------
const competitorComparison = competitors.map((c) => {
  const top = [...c.topPosts].sort((a, b) => (b.views ?? -1) - (a.views ?? -1))[0] ?? null;
  return {
    handle: c.handle,
    postsScraped: c.postsScraped,
    topPostViews: top?.views ?? null,
    topPostUrl: top?.url ?? null,
  };
});

const analyst = {
  followers: own.followers,
  postsScraped: own.postsScraped,
  totalViews: own.totalViews,
  avgEngagementRate: own.avgEngagementRate,
  topPost: own.topPosts[0] ?? null,
  competitorComparison,
};

// ---------- DM Manager: honest not-yet-connected state ----------
const dmManager = {
  connected: false,
  status: 'Not connected yet — DM access wires up once the Telegram bot is live (Step 4).',
};

const output = {
  generatedAt: new Date().toISOString(),
  ideator,
  hookScript,
  planner,
  analyst,
  dmManager,
};

writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));
console.log('Saved', OUT_PATH);
console.log('Top idea:', ideator.topIdea?.source, ideator.topIdea?.views, 'views');
console.log('Best historical days:', bestDays.join(', '));
