import 'dotenv/config';
import { ApifyClient } from 'apify-client';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '..', 'dashboard', 'data.json');

const OWN_HANDLE = 'kamil.ozornek.dubai';
const COMPETITOR_HANDLES = [
  'jake_nazer',
  'mattsiddell',
  'kamilmagrealestate',
  'jameshsahota',
  'adel_chynystanov_',
];

const OWN_RESULTS_LIMIT = 500; // full post history
const COMPETITOR_RESULTS_LIMIT = 30; // recent posts only

const token = process.env.APIFY_API_TOKEN;
if (!token) {
  console.error('Missing APIFY_API_TOKEN in .env');
  process.exit(1);
}

const client = new ApifyClient({ token });
const ACTOR = 'apify/instagram-scraper';

function profileUrl(handle) {
  return `https://www.instagram.com/${handle}/`;
}

async function runActor(input, label) {
  console.log(`\n-> Running ${ACTOR} (${label})...`);
  const run = await client.actor(ACTOR).call(input, { memory: 4096 });
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  console.log(`   done: ${items.length} item(s)`);
  return items;
}

function normalizePost(item) {
  const views = item.videoViewCount ?? item.videoPlayCount ?? null;
  const likes = item.likesCount ?? 0;
  const comments = item.commentsCount ?? 0;
  return {
    username: item.ownerUsername ?? null,
    shortCode: item.shortCode ?? null,
    url: item.url ?? null,
    type: item.type ?? null,
    caption: (item.caption ?? '').slice(0, 200),
    timestamp: item.timestamp ?? null,
    views,
    likes,
    comments,
    engagement: likes + comments,
  };
}

function rankPosts(posts) {
  return [...posts].sort((a, b) => {
    const aScore = a.views ?? -1;
    const bScore = b.views ?? -1;
    if (bScore !== aScore) return bScore - aScore;
    return b.engagement - a.engagement;
  });
}

async function main() {
  // 1. Own profile details -> real follower count, bio, posts count
  const detailsItems = await runActor(
    { resultsType: 'details', directUrls: [profileUrl(OWN_HANDLE)] },
    'own profile details',
  );
  const details = detailsItems[0] ?? {};

  // 2. Own full post history -> rank for true all-time top posts
  const ownRaw = await runActor(
    {
      resultsType: 'posts',
      directUrls: [profileUrl(OWN_HANDLE)],
      resultsLimit: OWN_RESULTS_LIMIT,
    },
    `own posts (limit ${OWN_RESULTS_LIMIT})`,
  );
  const ownPosts = rankPosts(ownRaw.map(normalizePost));

  // 3. Competitors' recent posts
  const competitorRaw = await runActor(
    {
      resultsType: 'posts',
      directUrls: COMPETITOR_HANDLES.map(profileUrl),
      resultsLimit: COMPETITOR_RESULTS_LIMIT,
    },
    `competitor posts (limit ${COMPETITOR_RESULTS_LIMIT} each)`,
  );
  const competitorPosts = rankPosts(competitorRaw.map(normalizePost));

  const competitorsByHandle = COMPETITOR_HANDLES.map((handle) => {
    const posts = competitorPosts.filter((p) => p.username === handle);
    return { handle, postsScraped: posts.length, topPosts: posts.slice(0, 5) };
  });

  const totalViews = ownPosts.reduce((sum, p) => sum + (p.views ?? 0), 0);
  const totalEngagement = ownPosts.reduce((sum, p) => sum + p.engagement, 0);
  const followers = details.followersCount ?? null;
  const avgEngagementRate =
    followers && ownPosts.length
      ? (totalEngagement / ownPosts.length / followers) * 100
      : null;

  const data = {
    fetchedAt: new Date().toISOString(),
    own: {
      handle: OWN_HANDLE,
      followers,
      followsCount: details.followsCount ?? null,
      postsCountOnProfile: details.postsCount ?? null,
      biography: details.biography ?? null,
      postsScraped: ownPosts.length,
      totalViews,
      totalEngagement,
      avgEngagementRate,
      topPosts: ownPosts.slice(0, 10),
      allPosts: ownPosts,
    },
    competitors: competitorsByHandle,
  };

  await writeFile(OUT_PATH, JSON.stringify(data, null, 2));
  console.log(`\nSaved ${OUT_PATH}`);
  console.log(`\nFollowers: ${followers}`);
  console.log(`Posts scraped (own): ${ownPosts.length}`);
  console.log(`True top post: ${ownPosts[0]?.url} (views: ${ownPosts[0]?.views}, likes: ${ownPosts[0]?.likes})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
