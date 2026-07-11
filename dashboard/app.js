function compactNumber(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

async function main() {
  const [data, outputs] = await Promise.all([
    fetch('data.json').then((r) => r.json()),
    fetch('agent-outputs.json').then((r) => r.json()),
  ]);

  const own = data.own;

  document.getElementById('handle-line').textContent = `@${own.handle} · ${own.businessCategoryName ?? ''}`;
  document.getElementById('updated-line').textContent = `Data pulled ${timeAgo(data.fetchedAt)}`;

  document.getElementById('stat-followers').textContent = compactNumber(own.followers);
  document.getElementById('stat-top-post').textContent = compactNumber(own.topPosts[0]?.views);
  document.getElementById('stat-top-post-sub').textContent = own.topPosts[0]
    ? `${own.topPosts[0].type} · ${own.topPosts[0].likes.toLocaleString()} likes`
    : '';
  document.getElementById('stat-total-views').textContent = compactNumber(own.totalViews);
  document.getElementById('stat-engagement').textContent =
    own.avgEngagementRate != null ? own.avgEngagementRate.toFixed(2) + '%' : '—';

  const agents = [
    {
      key: 'ideator',
      icon: '💡',
      name: 'Ideator',
      active: true,
      status: `Scanned ${outputs.ideator.postsAnalyzed} posts`,
      metrics: [
        ['Top idea source', `@${outputs.ideator.topIdea?.source ?? '—'}`],
        ['Top idea views', compactNumber(outputs.ideator.topIdea?.views)],
        ['Ideas ranked', String(outputs.ideator.ideas.length)],
      ],
    },
    {
      key: 'hookScript',
      icon: '✍️',
      name: 'Hook & Script',
      active: true,
      status: `Drafted from ${outputs.hookScript.draftedFrom} top posts`,
      metrics: [
        ['Scripts drafted', String(outputs.hookScript.scripts.length)],
        ['Best source views', compactNumber(outputs.hookScript.scripts[0]?.originalViews)],
      ],
    },
    {
      key: 'planner',
      icon: '🗓️',
      name: 'Planner',
      active: true,
      status: `Best days: ${outputs.planner.bestDays.join(', ')}`,
      metrics: [
        ['7-day slots planned', String(outputs.planner.calendar.length)],
        ['Recommended days', String(outputs.planner.calendar.filter((c) => c.recommended).length)],
      ],
    },
    {
      key: 'analyst',
      icon: '📊',
      name: 'Analyst',
      active: true,
      status: `Tracking ${outputs.analyst.competitorComparison.length} competitors`,
      metrics: [
        ['Followers', compactNumber(outputs.analyst.followers)],
        ['Avg engagement', outputs.analyst.avgEngagementRate?.toFixed(2) + '%'],
      ],
    },
    {
      key: 'dmManager',
      icon: '💬',
      name: 'DM Manager',
      active: outputs.dmManager.connected,
      status: outputs.dmManager.connected ? 'Handling inbound DMs' : 'Awaiting Telegram (Step 4)',
      metrics: [['Status', outputs.dmManager.connected ? 'Connected' : 'Not connected']],
    },
  ];

  const agentsContainer = document.getElementById('agents');
  for (const agent of agents) {
    const card = el(`
      <button class="agent-card ${agent.active ? '' : 'inactive'}" data-key="${agent.key}">
        <div class="icon">${agent.icon}</div>
        <div class="name">${agent.name}</div>
        <div class="status-line"><span class="live-dot"></span>${agent.status}</div>
        <div class="work-bar"><span></span></div>
        <div class="metrics">
          ${agent.metrics.map(([label, value]) => `<div class="metric"><span>${label}</span><b>${value}</b></div>`).join('')}
        </div>
        <div class="click-hint">View details →</div>
      </button>
    `);
    card.addEventListener('click', () => openPanel(agent.key, data, outputs));
    agentsContainer.appendChild(card);
  }

  document.getElementById('panel-close').addEventListener('click', closePanel);
  document.getElementById('overlay').addEventListener('click', (e) => {
    if (e.target.id === 'overlay') closePanel();
  });
}

function closePanel() {
  document.getElementById('overlay').classList.remove('open');
}

function openPanel(key, data, outputs) {
  const titleEl = document.getElementById('panel-title');
  const bodyEl = document.getElementById('panel-body');
  bodyEl.innerHTML = '';

  const renderers = {
    ideator: () => {
      titleEl.textContent = '💡 Ideator — ranked ideas from competitor top posts';
      const list = el('<div class="panel-list"></div>');
      for (const idea of outputs.ideator.ideas) {
        list.appendChild(el(`
          <div class="panel-item">
            <div class="row1"><span>@${idea.source} · ${idea.type}</span><a href="${idea.url}" target="_blank" rel="noopener">open ↗</a></div>
            <div class="row2">${idea.caption || '(no caption)'}</div>
            <div class="row3">${compactNumber(idea.views)} views · ${idea.likes.toLocaleString()} likes — ${idea.angle}</div>
          </div>
        `));
      }
      bodyEl.appendChild(list);
    },
    hookScript: () => {
      titleEl.textContent = '✍️ Hook & Script — drafts from your top posts';
      const list = el('<div class="panel-list"></div>');
      for (const s of outputs.hookScript.scripts) {
        list.appendChild(el(`
          <div class="panel-item">
            <div class="row1"><span>Draft hook</span><a href="${s.basedOn}" target="_blank" rel="noopener">source ↗</a></div>
            <div class="row2">"${s.draftHook}"</div>
            <div class="row3">Based on a post with ${compactNumber(s.originalViews)} views: "${s.originalCaption}"</div>
          </div>
        `));
      }
      bodyEl.appendChild(list);
    },
    planner: () => {
      titleEl.textContent = '🗓️ Planner — next 7 days';
      const grid = el('<div class="calendar-grid"></div>');
      for (const c of outputs.planner.calendar) {
        grid.appendChild(el(`
          <div class="calendar-row ${c.recommended ? 'recommended' : ''}">
            <span>${c.day} · ${c.date}</span>
            <span>${c.slot}</span>
          </div>
        `));
      }
      bodyEl.appendChild(grid);
      bodyEl.appendChild(el(`<div class="panel-item" style="margin-top:12px"><div class="row2">Best historical posting days (by avg views): <b>${outputs.planner.bestDays.join(', ')}</b></div></div>`));
    },
    analyst: () => {
      titleEl.textContent = '📊 Analyst — you vs. competitors';
      const table = el(`
        <table class="table-mini">
          <thead><tr><th>Account</th><th>Posts scraped</th><th>Top post views</th></tr></thead>
          <tbody>
            <tr><td><b>@${data.own.handle} (you)</b></td><td>${data.own.postsScraped}</td><td>${compactNumber(outputs.analyst.topPost?.views)}</td></tr>
            ${outputs.analyst.competitorComparison
              .map((c) => `<tr><td>@${c.handle}</td><td>${c.postsScraped}</td><td>${compactNumber(c.topPostViews)}</td></tr>`)
              .join('')}
          </tbody>
        </table>
      `);
      bodyEl.appendChild(table);
    },
    dmManager: () => {
      titleEl.textContent = '💬 DM Manager';
      bodyEl.appendChild(el(`<div class="empty-state">${outputs.dmManager.status}</div>`));
    },
  };

  renderers[key]();
  document.getElementById('overlay').classList.add('open');
}

main();
