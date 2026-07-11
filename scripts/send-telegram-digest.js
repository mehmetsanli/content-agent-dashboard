import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, '..', '.env');
const DATA_PATH = join(__dirname, '..', 'dashboard', 'data.json');
const OUTPUTS_PATH = join(__dirname, '..', 'dashboard', 'agent-outputs.json');

const token = process.env.TELEGRAM_BOT_TOKEN;
let chatId = process.env.TELEGRAM_CHAT_ID;

if (!token) {
  console.error('Missing TELEGRAM_BOT_TOKEN in .env');
  process.exit(1);
}

const API = `https://api.telegram.org/bot${token}`;

function compactNumber(n) {
  if (n == null) return 'n/a';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

async function discoverChatId() {
  console.log('No TELEGRAM_CHAT_ID set — looking it up from your messages to the bot...');
  const res = await fetch(`${API}/getUpdates`);
  const json = await res.json();
  if (!json.ok) {
    throw new Error(`getUpdates failed: ${JSON.stringify(json)}`);
  }
  const updates = json.result;
  if (!updates.length) {
    console.error(
      'No messages found yet. Open Telegram, message your bot once, then run this script again.',
    );
    process.exit(1);
  }
  const last = updates[updates.length - 1];
  const chat = last.message?.chat ?? last.edited_message?.chat;
  if (!chat) {
    throw new Error(`Could not find a chat in the latest update: ${JSON.stringify(last)}`);
  }
  console.log(`Found chat: ${chat.first_name ?? ''} ${chat.last_name ?? ''} (id: ${chat.id})`);
  return String(chat.id);
}

function buildDigest() {
  const data = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
  const outputs = JSON.parse(readFileSync(OUTPUTS_PATH, 'utf-8'));
  const own = data.own;
  const top = own.topPosts[0];
  const idea = outputs.ideator.topIdea;

  const lines = [
    `📊 *Content Agent Digest* — @${own.handle}`,
    '',
    `Followers: *${compactNumber(own.followers)}*`,
    `All-time top post: *${compactNumber(top?.views)} views* (${top?.type})`,
    `Total views (scraped): *${compactNumber(own.totalViews)}*`,
    `Avg engagement rate: *${own.avgEngagementRate?.toFixed(2)}%*`,
    '',
    `💡 Top idea today — from @${idea?.source} (${compactNumber(idea?.views)} views):`,
    `"${idea?.caption}"`,
    '',
    `🗓️ Best days to post (by historical avg views): ${outputs.planner.bestDays.join(', ')}`,
  ];
  return lines.join('\n');
}

function saveChatIdToEnv(id) {
  const env = readFileSync(ENV_PATH, 'utf-8');
  const updated = env.includes('TELEGRAM_CHAT_ID=')
    ? env.replace(/TELEGRAM_CHAT_ID=.*/, `TELEGRAM_CHAT_ID=${id}`)
    : env + `\nTELEGRAM_CHAT_ID=${id}\n`;
  writeFileSync(ENV_PATH, updated);
  console.log('Saved chat id to .env');
}

async function main() {
  if (!chatId) {
    chatId = await discoverChatId();
    saveChatIdToEnv(chatId);
  }

  const text = buildDigest();
  const res = await fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
  const json = await res.json();
  if (!json.ok) {
    throw new Error(`sendMessage failed: ${JSON.stringify(json)}`);
  }
  console.log('Digest sent! Check your Telegram.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
