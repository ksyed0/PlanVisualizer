// Agentic LIVE dashboard — amber/signal accent, mission-control voice.

const { useState: useStateL } = React;

function LiveBar() {
  return (
    <div className="live-bar">
      <span className="on-air">ON AIR</span>
      <div className="exec">
        <div className="exec-lbl">Now executing</div>
        <div className="exec-body">
          <span className="exec-plan">
            R1.10 <span className="exec-sep">›</span> EPIC-0020 <span className="exec-sep">›</span>{' '}
            <strong>US-0133 · Status masthead</strong>
          </span>
        </div>
      </div>
      <div className="heartbeat">
        <div className="hb-row">
          <span className="hb-lbl">Assigned</span>
          <span className="hb-val">Palette</span>
          <span className="hb-sep">·</span>
          <span className="hb-lbl">ETA</span>
          <span className="hb-val tnum">~18m</span>
        </div>
        <div className="hb-row hb-sub">
          <span className="hb-pulse" />
          <span>Last event 4s ago · story 62% complete</span>
        </div>
      </div>
      <div className="bar-meta">
        <div>
          <span className="bar-meta-lbl">Elapsed</span>
          <span className="bar-meta-val tnum">00:42:18</span>
        </div>
        <div>
          <span className="bar-meta-lbl">Cycle</span>
          <span className="bar-meta-val tnum">#012</span>
        </div>
        <div>
          <span className="bar-meta-lbl">Clock</span>
          <span className="bar-meta-val tnum">14:28:04</span>
        </div>
      </div>
    </div>
  );
}

function LiveMasthead() {
  const D = window.DATA;
  const stats = [
    { lbl: 'Phase', val: '03 / 06', tone: 'text', foot: 'Build' },
    { lbl: 'Active', val: '4', tone: 'live', foot: 'of 9 agents', dot: 'live' },
    { lbl: 'Queue', val: '7', tone: 'text', foot: 'stories' },
    { lbl: 'Reviews', val: '2', tone: 'info', foot: 'awaiting verdict' },
    { lbl: 'Blocked', val: '1', tone: 'risk', foot: 'Circuit · fixture' },
    { lbl: 'Tests', val: '312/312', tone: 'ok', foot: '14:26 · Sentinel' },
    { lbl: 'Coverage', val: '82.4%', tone: 'text', foot: '▲ +0.4%' },
    { lbl: 'AI spend', val: '$38.20', tone: 'text', foot: 'today' },
  ];
  return (
    <header className="masthead live-masthead">
      <div className="lm-head">
        <div className="lm-title-row">
          <div className="lm-crumbs mono-eye">
            <span>Agentic SDLC</span>
            <span className="sep">›</span>
            <span>R1.10</span>
            <span className="sep">›</span>
            <span>EPIC-0020</span>
            <span className="sep">›</span>
            <span style={{ color: 'var(--text)' }}>US-0133 · Status masthead</span>
          </div>
          <h1 className="mh-title lm-title">
            Mission Control<em>LIVE</em>
          </h1>
        </div>
        <div className="lm-signal">
          <span className="lm-sig-dot" />
          <span className="lm-sig-val">HEALTHY</span>
          <span className="lm-sig-sub">Signal · 1s refresh</span>
        </div>
      </div>
      <div className="lm-stats">
        {stats.map((s) => (
          <div className="lm-stat" key={s.lbl} data-tone={s.tone}>
            <span className="lm-stat-lbl">{s.lbl}</span>
            <span className="lm-stat-val tnum">
              {s.dot && <span className="lm-stat-dot" />}
              {s.val}
            </span>
            <span className="lm-stat-foot">{s.foot}</span>
          </div>
        ))}
      </div>
    </header>
  );
}

function Pipeline() {
  const D = window.DATA;
  return (
    <div>
      <div className="row" style={{ marginBottom: 8, justifyContent: 'space-between' }}>
        <div className="eyebrow">Pipeline</div>
        <div className="mono-eye">Cycle 012 · 00:42:18</div>
      </div>
      <div className="pipeline">
        {D.pipeline.map((p, i) => (
          <div key={i} className={`ph ${p.status}`}>
            <div className="n">PHASE {p.n}</div>
            <div className="name">{p.name}</div>
            <div className="meta">{p.agents}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentsGrid() {
  const D = window.DATA;
  const active = D.agents.filter((a) => a.status === 'active');
  return (
    <div>
      <div className="row" style={{ marginBottom: 8, justifyContent: 'space-between' }}>
        <div className="eyebrow">Roster</div>
        <div className="mono-eye">
          <span style={{ color: 'var(--live-accent-ink)' }}>● {active.length} ACTIVE</span>
          <span style={{ marginLeft: 10 }}>○ {D.agents.filter((a) => a.status === 'idle').length} idle</span>
          <span style={{ marginLeft: 10, color: 'var(--risk)' }}>
            ! {D.agents.filter((a) => a.status === 'blocked').length} blocked
          </span>
        </div>
      </div>
      <div className="agents">
        {D.agents.map((a) => (
          <div key={a.name} id={`agent-${a.name}`} className={`agent is-${a.status}`}>
            <div className="port">
              <span className="glyph">{a.name[0]}</span>
              <span className="live-dot" />
            </div>
            <div className="info">
              <div className="top-row">
                <span className="name">{a.name}</span>
                <span className="dot-sep">·</span>
                <span className="role">{a.role}</span>
                <span className={`flag flag-${a.status}`}>
                  {a.status === 'active' && <span className="flag-pulse" />}
                  {a.status}
                </span>
              </div>
              <div className="bot-row">
                <span className="task">{a.task}</span>
                {a.branch && (
                  <>
                    <span className="em-dash">—</span>
                    <span className="branch" title={a.branch}>
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path
                          d="M5 3v10M11 7v6M5 7a3 3 0 0 0 3 3h3"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                        <circle cx="5" cy="3" r="1.5" fill="currentColor" />
                        <circle cx="11" cy="5" r="1.5" fill="currentColor" />
                        <circle cx="5" cy="13" r="1.5" fill="currentColor" />
                      </svg>
                      <span>{a.branch}</span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LiveKpiRow() {
  return (
    <div className="kpi-row" style={{ marginTop: 16 }}>
      <div className="kpi">
        <div className="k-lbl">Phases complete</div>
        <div className="k-val">
          <span className="big tnum">2</span>
          <span className="small">/ 6</span>
        </div>
        <div className="k-foot">
          <span className="trend-up">▲ Build in progress</span>
        </div>
      </div>
      <div className="kpi">
        <div className="k-lbl">Tests passing</div>
        <div className="k-val">
          <span className="big tnum" style={{ color: 'var(--ok)' }}>
            312
          </span>
          <span className="small">/ 312</span>
        </div>
        <div className="k-foot">
          <span style={{ color: 'var(--text-mute)' }}>14:26 · Sentinel</span>
        </div>
      </div>
      <div className="kpi">
        <div className="k-lbl">Coverage</div>
        <div className="k-val">
          <span className="big tnum">82.4</span>
          <span className="small">%</span>
        </div>
        <div className="k-foot">
          <span className="trend-up">▲ +0.4%</span>
        </div>
      </div>
      <div className="kpi">
        <div className="k-lbl">Incidents</div>
        <div className="k-val">
          <span className="big tnum" style={{ color: 'var(--risk)' }}>
            1
          </span>
          <span className="small">open</span>
        </div>
        <div className="k-foot">
          <span style={{ color: 'var(--risk)' }}>Circuit · fixture missing</span>
        </div>
      </div>
    </div>
  );
}

function EventLog() {
  const D = window.DATA;
  return (
    <div style={{ marginTop: 16 }} id="event-log">
      <div className="row" style={{ marginBottom: 8, justifyContent: 'space-between' }}>
        <div className="eyebrow">Event Log</div>
        <div className="mono-eye">Last 10 events · auto-scroll</div>
      </div>
      <div className="log">
        {D.eventFeed.map((e, i) => (
          <div key={i} className={`row evt-${e.tag}`}>
            <span className="t tnum">{e.t}</span>
            <span className="a">{e.who}</span>
            <span className="m">{e.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LiveFeed() {
  // Right rail — "Needs attention", complementary to the chronological Event Log.
  // Holds blocked agents, open incidents, pending reviews, flagged risks.
  const items = [
    { kind: 'block', who: 'Circuit', title: 'Coverage fixture missing', meta: 'BLOCKED · 16m', chip: 'risk' },
    { kind: 'review', who: 'Lens', title: 'PR #413 awaiting verdict', meta: 'QUEUED · 4m', chip: 'info' },
    { kind: 'review', who: 'Lens', title: 'PR #414 awaiting verdict', meta: 'QUEUED · 1m', chip: 'info' },
    { kind: 'bug', who: 'Sentinel', title: 'BUG-0187 · pipeline/roster overlap', meta: 'HIGH', chip: 'warn' },
    { kind: 'bug', who: 'Sentinel', title: 'BUG-0186 · Conductor invisible', meta: 'MED', chip: 'warn' },
    { kind: 'risk', who: 'Compass', title: 'EPIC-0012 unstarted', meta: '3 stories', chip: 'mute' },
  ];
  return (
    <>
      <div className="head">
        <h3>Needs Attention</h3>
        <span className="mono-eye">
          <span style={{ color: 'var(--risk)' }}>●</span> 1 blocked · 2 review
        </span>
      </div>
      <div className="feed">
        {items.map((it, i) => (
          <div key={i} className={`evt attn attn-${it.kind}`}>
            <div className="meta">
              <span className="tnum">{it.meta}</span>
              <span>{it.kind}</span>
            </div>
            <div className="who">{it.who}</div>
            <div className="msg">{it.title}</div>
          </div>
        ))}
      </div>
    </>
  );
}

// Shared attention items — used by both the top banner and the right-rail "Needs Attention".
const ATTN_ITEMS = [
  {
    id: 'attn-block-circuit',
    kind: 'block',
    who: 'Circuit',
    title: 'Coverage fixture missing',
    meta: 'BLOCKED · 16m',
    target: 'agent-Circuit',
    tone: 'risk',
    cta: 'View agent',
  },
  {
    id: 'attn-review-413',
    kind: 'review',
    who: 'Lens',
    title: 'PR #413 awaiting verdict',
    meta: 'QUEUED · 4m',
    target: 'agent-Lens',
    tone: 'info',
    cta: 'Review',
  },
  {
    id: 'attn-review-414',
    kind: 'review',
    who: 'Lens',
    title: 'PR #414 awaiting verdict',
    meta: 'QUEUED · 1m',
    target: 'agent-Lens',
    tone: 'info',
    cta: 'Review',
  },
  {
    id: 'attn-bug-187',
    kind: 'bug',
    who: 'Sentinel',
    title: 'BUG-0187 · pipeline/roster overlap',
    meta: 'HIGH',
    target: 'event-log',
    tone: 'warn',
    cta: 'Open bug',
  },
  {
    id: 'attn-bug-186',
    kind: 'bug',
    who: 'Sentinel',
    title: 'BUG-0186 · Conductor invisible',
    meta: 'MED',
    target: 'event-log',
    tone: 'warn',
    cta: 'Open bug',
  },
  {
    id: 'attn-risk-epic12',
    kind: 'risk',
    who: 'Compass',
    title: 'EPIC-0012 unstarted',
    meta: '3 stories',
    target: 'agent-Compass',
    tone: 'mute',
    cta: 'View plan',
  },
];

function scrollToTarget(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('attn-flash');
  setTimeout(() => el.classList.remove('attn-flash'), 1600);
}

function AttentionBanner() {
  const blocked = ATTN_ITEMS.filter((i) => i.kind === 'block');
  const reviews = ATTN_ITEMS.filter((i) => i.kind === 'review');
  const bugs = ATTN_ITEMS.filter((i) => i.kind === 'bug');
  const top = blocked[0] || reviews[0] || bugs[0];
  if (!top) return null;
  return (
    <div className="attn-banner" data-tone={top.tone}>
      <div className="ab-main">
        <div className="ab-head">
          <span className="ab-title">Needs attention</span>
          <span className="ab-counts">
            {blocked.length > 0 && <span className="ab-count risk">{blocked.length} blocked</span>}
            {reviews.length > 0 && <span className="ab-count info">{reviews.length} review</span>}
            {bugs.length > 0 && <span className="ab-count warn">{bugs.length} bugs</span>}
          </span>
        </div>
        <div className="ab-lead">
          <span className="ab-who">{top.who}</span>
          <span className="ab-sep">·</span>
          <span>{top.title}</span>
          <span className="ab-meta">{top.meta}</span>
        </div>
      </div>
      <div className="ab-actions">
        <button className="ab-btn primary" onClick={() => scrollToTarget(top.target)}>
          Jump to {top.who}
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 2v11M3 8l5 5 5-5"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button className="ab-btn" onClick={() => scrollToTarget('attn-list')}>
          All {ATTN_ITEMS.length}
        </button>
      </div>
    </div>
  );
}

function LiveDashboard() {
  return (
    <div className="live-stage live">
      <main className="live-main">
        <LiveBar />
        <LiveMasthead />
        <Pipeline />
        <div style={{ height: 16 }} />
        <AgentsGrid />
      </main>
      <aside className="live-aside" id="attn-list">
        <AttentionBanner />
        <LiveFeed />
        <div style={{ height: 20 }} />
        <EventLog />
      </aside>
    </div>
  );
}

window.LiveDashboard = LiveDashboard;
