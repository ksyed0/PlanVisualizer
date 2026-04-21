// Plan-Status dashboard — REPORT mode.
// Editorial, calm, indigo accent. Sidebar + masthead + main + aside.

const { useState, useMemo } = React;

function Chip({ tone="mute", children }) {
  return <span className={`chip ${tone}`}><span className="d" />{children}</span>;
}

function Masthead({ tab, theme }) {
  const D = window.DATA;
  const titles = {
    status: "Status",
    hierarchy: "Hierarchy",
    kanban: "Kanban",
    traceability: "Traceability",
    trends: "Trends",
    costs: "Costs",
    bugs: "Bugs",
    lessons: "Lessons",
  };
  return (
    <header className="masthead">
      <div className="mh-head">
        <div className="eyebrow">{D.project.name} · Release {D.project.release}</div>
        <h1 className="mh-title">{titles[tab]} <em>report</em></h1>
      </div>
      <div className="mh-meta">
        <div className="item">
          <span className="eyebrow lbl">Progress</span>
          <span className="val">76% <span className="delta up">▲ +6.2</span></span>
        </div>
        <div className="item">
          <span className="eyebrow lbl">Coverage</span>
          <span className="val">82.4% <span className="delta up">▲ +0.4</span></span>
        </div>
        <div className="item">
          <span className="eyebrow lbl">Open bugs</span>
          <span className="val">4 <span className="delta dn">▼ −2</span></span>
        </div>
        <div className="item hide-md">
          <span className="eyebrow lbl">AI spend</span>
          <span className="val">$497</span>
        </div>
        <div className="item hide-lg">
          <span className="eyebrow lbl">Stories</span>
          <span className="val">94 / 124</span>
        </div>
        <div className="item hide-xl">
          <span className="eyebrow lbl">Issue</span>
          <span className="val">Vol. 03 · No. 14</span>
        </div>
        <div className="item hide-sm">
          <span className="eyebrow lbl">Updated</span>
          <span className="val">{D.project.updated}</span>
        </div>
        <div className="item hide-xl">
          <span className="eyebrow lbl">Editor</span>
          <span className="val">Conductor</span>
        </div>
      </div>
    </header>
  );
}

function KpiRow() {
  const D = window.DATA;
  return (
    <div className="kpi-row">
      {D.kpis.map(k => (
        <div className="kpi" key={k.id}>
          <div className="k-lbl">{k.label}</div>
          <div className="k-val">
            <span className="big tnum">{k.big}</span>
            <span className="small">{k.unit}</span>
          </div>
          <div className="k-foot">
            <span className={k.trend === "up" ? "trend-up" : "trend-dn"}>
              {k.trend === "up" ? "▲" : "▼"} {k.delta}
            </span>
            <span style={{color: "var(--text-mute)"}}>· {k.foot}</span>
          </div>
          <svg className="spark" width="80" height="28" viewBox="0 0 80 28">
            <polyline fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.35"
              points="0,20 10,18 20,22 30,16 40,14 50,18 60,12 70,8 80,10" />
          </svg>
        </div>
      ))}
    </div>
  );
}

function Donut({ value=82.4, label="Coverage" }) {
  const C = 2 * Math.PI * 52;
  const off = C - (value/100) * C;
  return (
    <div className="donut">
      <svg width="160" height="160" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="52" fill="none" stroke="var(--surface-2)" strokeWidth="12" />
        <circle cx="60" cy="60" r="52" fill="none" stroke="var(--plan-accent)" strokeWidth="12"
          strokeDasharray={C} strokeDashoffset={off} strokeLinecap="round" />
      </svg>
      <div className="center">
        <div className="n tnum">{value}<span style={{fontSize: 16, color: "var(--text-mute)"}}>%</span></div>
        <div className="l">{label}</div>
      </div>
    </div>
  );
}

function EpicList() {
  const D = window.DATA;
  return (
    <div className="card">
      <div className="card-head">
        <h3>Epic Progress</h3>
        <span className="mono-eye" style={{marginLeft: "auto"}}>8 epics · sorted by activity</span>
      </div>
      <div className="epic-list">
        {D.epics.map(e => (
          <div className="epic-row" key={e.id}>
            <span className="id">{e.id}</span>
            <span className="name">{e.name}</span>
            <span className="bar"><span style={{width: e.pct + "%"}} /></span>
            <span className="pct tnum">{e.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusHero() {
  return (
    <div className="card" style={{marginBottom: 20, padding: 0}}>
      <div style={{padding: "20px 22px 14px", borderBottom: "1px solid var(--border-soft)", display: "grid", gridTemplateColumns: "1fr auto", columnGap: 28, rowGap: 6, alignItems: "center"}}>
        <div className="eyebrow" style={{gridColumn: 1}}>Release health</div>
        <div style={{gridColumn: 1, display: "flex", alignItems: "baseline", gap: 12}}>
          <span className="disp tnum" style={{fontSize: 56, lineHeight: 1}}>On track</span>
          <Chip tone="ok">STABLE</Chip>
        </div>
        <div style={{gridColumn: "1 / -1", color: "var(--text-dim)", fontSize: 14, lineHeight: 1.5}}>
          R1.10 is projected to ship <span className="mono" style={{color: "var(--text)"}}>Apr 28 ± 2d</span>,
          ahead of the 30 Apr deadline. Velocity is steady at <span className="mono" style={{color: "var(--text)"}}>6.4 stories/wk</span>;
          bug intake has slowed; coverage is rising. Risk: <span style={{color: "var(--warn)"}}>Circuit blocked on theme.js fixture</span>.
        </div>
        <div style={{gridColumn: 2, gridRow: 2, display: "grid", gridTemplateColumns: "repeat(3, auto)", columnGap: 28, rowGap: 8, alignSelf: "center"}}>
          <div>
            <div className="eyebrow">Forecast</div>
            <div className="disp tnum" style={{fontSize: 22, marginTop: 2}}>Apr 28</div>
            <div className="mono-eye">P50 · ±2d</div>
          </div>
          <div>
            <div className="eyebrow">Velocity</div>
            <div className="disp tnum" style={{fontSize: 22, marginTop: 2}}>6.4<span style={{fontSize: 12, color: "var(--text-mute)", marginLeft: 4}}>/wk</span></div>
            <div className="mono-eye trend-up">▲ +0.8</div>
          </div>
          <div>
            <div className="eyebrow">Budget</div>
            <div className="disp tnum" style={{fontSize: 22, marginTop: 2}}>22.7%</div>
            <div className="mono-eye">$497 / $2,189</div>
          </div>
        </div>
      </div>
      <div style={{padding: "14px 22px", display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: 24, alignItems: "center"}}>
        <div>
          <div className="eyebrow" style={{marginBottom: 6}}>Progress · past 14 weeks</div>
          <div className="bars" style={{height: 60}}>
            {window.DATA.trendWeeks.map((v, i) => <div key={i} className={i > 9 ? "b alt" : "b"} style={{height: v + "%"}} />)}
          </div>
        </div>
        <div>
          <div className="eyebrow" style={{marginBottom: 6}}>Coverage · last 30 days</div>
          <div className="heat" style={{gridTemplateColumns: "repeat(30, 1fr)"}}>
            {window.DATA.coverageHeat.map((v, i) => {
              const a = Math.min(1, Math.max(0.1, (v - 60) / 30));
              return <div key={i} className="cell" style={{background: `color-mix(in oklab, var(--plan-accent) ${Math.round(a*100)}%, var(--surface-2))`}} />;
            })}
          </div>
        </div>
        <div>
          <div className="eyebrow" style={{marginBottom: 6}}>Burn · cumulative</div>
          <svg width="100%" height="60" viewBox="0 0 200 60" preserveAspectRatio="none">
            <defs>
              <linearGradient id="burnG" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--plan-accent)" stopOpacity="0.4" />
                <stop offset="100%" stopColor="var(--plan-accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polyline fill="none" stroke="var(--plan-accent)" strokeWidth="1.5"
              points={window.DATA.burn.map((v,i)=>`${(i/13)*200},${60 - (v/500)*60}`).join(" ")} />
            <polygon fill="url(#burnG)"
              points={`0,60 ${window.DATA.burn.map((v,i)=>`${(i/13)*200},${60 - (v/500)*60}`).join(" ")} 200,60`} />
          </svg>
        </div>
      </div>
    </div>
  );
}

function KpiStack() {
  const D = window.DATA;
  return (
    <div className="kpi-stack">
      {D.kpis.map(k => (
        <div className="kpi kpi-h" key={k.id}>
          <div className="k-main">
            <div className="k-lbl">{k.label}</div>
            <div className="k-val">
              <span className="big tnum">{k.big}</span>
              <span className="small">{k.unit}</span>
            </div>
          </div>
          <div className="k-side">
            <svg className="k-spark" width="64" height="22" viewBox="0 0 80 28" preserveAspectRatio="none">
              <polyline fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.45"
                points="0,20 10,18 20,22 30,16 40,14 50,18 60,12 70,8 80,10" />
            </svg>
            <div className="k-foot">
              <span className={k.trend === "up" ? "trend-up" : "trend-dn"}>
                {k.trend === "up" ? "▲" : "▼"} {k.delta}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ThisWeekCard() {
  return (
    <div className="card">
      <div className="card-head">
        <h3>This Week</h3>
        <span className="mono-eye" style={{marginLeft: "auto"}}>Apr 13—19</span>
      </div>
      <div className="card-body col" style={{justifyContent: "center", flex: 1}}>
        <div className="row" style={{justifyContent: "space-between"}}><span className="mono-eye">Stories shipped</span><span className="disp tnum" style={{fontSize: 20}}>6</span></div>
        <div className="row" style={{justifyContent: "space-between"}}><span className="mono-eye">PRs merged</span><span className="disp tnum" style={{fontSize: 20}}>11</span></div>
        <div className="row" style={{justifyContent: "space-between"}}><span className="mono-eye">Bugs opened</span><span className="disp tnum" style={{fontSize: 20}}>2</span></div>
        <div className="row" style={{justifyContent: "space-between"}}><span className="mono-eye">Bugs fixed</span><span className="disp tnum" style={{fontSize: 20, color: "var(--ok)"}}>4</span></div>
        <div className="row" style={{justifyContent: "space-between"}}><span className="mono-eye">AI spend</span><span className="disp tnum" style={{fontSize: 20}}>$38.20</span></div>
      </div>
    </div>
  );
}

function StatusTab() {
  return (
    <div>
      <StatusHero />
      <div className="grid-epic-kpi">
        <EpicList />
        <KpiStack />
        <ThisWeekCard />
        <div className="card">
          <div className="card-head"><h3>Top Risks</h3></div>
          <div className="card-body col" style={{justifyContent: "center", flex: 1}}>
            <div>
              <div className="row"><Chip tone="risk">HIGH</Chip><span style={{fontSize: 13}}>Coverage fixture missing</span></div>
              <div style={{marginTop: 6, fontSize: 12, color: "var(--text-dim)"}}>Blocks US-0134 · Circuit agent · est. 4h to unblock</div>
            </div>
            <div>
              <div className="row"><Chip tone="warn">MED</Chip><span style={{fontSize: 13}}>Stakeholder view unstarted</span></div>
              <div style={{marginTop: 6, fontSize: 12, color: "var(--text-dim)"}}>EPIC-0012 at 30% · 3 stories unassigned</div>
            </div>
            <div>
              <div className="row"><Chip tone="info">LOW</Chip><span style={{fontSize: 13}}>Font license review pending</span></div>
              <div style={{marginTop: 6, fontSize: 12, color: "var(--text-dim)"}}>Legal review due 22 Apr</div>
            </div>
          </div>
        </div>
      </div>
      <div className="card" style={{marginBottom: 14}}>
          <div className="card-head">
            <h3>Quality</h3>
            <span className="mono-eye" style={{marginLeft: "auto"}}>312 tests · jest</span>
          </div>
          <div className="card-body" style={{display: "flex", flexDirection: "column", gap: 16}}>
            {/* Top: donut + 4 stats */}
            <div style={{display: "grid", gridTemplateColumns: "auto 1fr", gap: 20, alignItems: "center"}}>
              <Donut value={82.4} label="Coverage" />
              <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", rowGap: 14, columnGap: 12}}>
                <div>
                  <div className="eyebrow">Passed</div>
                  <div className="disp tnum" style={{fontSize: 22, color: "var(--ok)"}}>312</div>
                </div>
                <div>
                  <div className="eyebrow">Failed</div>
                  <div className="disp tnum" style={{fontSize: 22}}>0</div>
                </div>
                <div>
                  <div className="eyebrow">Skipped</div>
                  <div className="disp tnum" style={{fontSize: 22, color: "var(--text-mute)"}}>4</div>
                </div>
                <div>
                  <div className="eyebrow">Open bugs</div>
                  <div className="disp tnum" style={{fontSize: 22, color: "var(--warn)"}}>4</div>
                </div>
              </div>
            </div>

            {/* Middle: 14-day pass-rate strip */}
            <div style={{borderTop: "1px solid var(--border-soft)", paddingTop: 14}}>
              <div style={{display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8}}>
                <div className="eyebrow">Pass rate · last 14 runs</div>
                <span className="mono-eye" style={{color: "var(--ok)"}}>100.0%</span>
              </div>
              <div style={{display: "grid", gridTemplateColumns: "repeat(14, 1fr)", gap: 3, height: 36, alignItems: "end"}}>
                {[96,97,98,99,100,99,100,98,99,100,100,99,100,100].map((v, i) => (
                  <div key={i} title={`Run ${i+1}: ${v}%`}
                    style={{height: `${Math.max(10, (v - 90) * 10)}%`,
                      background: v === 100 ? "var(--ok)" : "color-mix(in oklab, var(--ok) 55%, var(--warn))",
                      borderRadius: 2, opacity: 0.85}} />
                ))}
              </div>
            </div>

            {/* Bottom: per-epic coverage list to fill vertical space */}
            <div style={{borderTop: "1px solid var(--border-soft)", paddingTop: 14}}>
              <div className="eyebrow" style={{marginBottom: 10}}>Coverage by epic</div>
              <div style={{display: "flex", flexDirection: "column", gap: 7}}>
                {[
                  {id: "EPIC-0003", name: "CD-Core",          cov: 94, d: "+1.2"},
                  {id: "EPIC-0005", name: "Agent-Pool",       cov: 88, d: "+0.4"},
                  {id: "EPIC-0007", name: "Observability",    cov: 86, d: "+2.1"},
                  {id: "EPIC-0009", name: "Release-Plan",     cov: 81, d: "+0.0"},
                  {id: "EPIC-0011", name: "Traceability",     cov: 74, d: "+3.6"},
                  {id: "EPIC-0012", name: "Stakeholder-View", cov: 42, d: "\u20130.8"},
                ].map(e => (
                  <div key={e.id} style={{display: "grid", gridTemplateColumns: "88px 1fr 1fr 38px 44px", gap: 10, alignItems: "center"}}>
                    <span className="mono" style={{fontSize: 10.5, color: "var(--text-mute)"}}>{e.id}</span>
                    <span style={{fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>{e.name}</span>
                    <span style={{height: 5, background: "var(--surface-2)", borderRadius: 3, overflow: "hidden"}}>
                      <span style={{display: "block", height: "100%", width: e.cov + "%",
                        background: e.cov >= 80 ? "var(--ok)" : e.cov >= 60 ? "var(--warn)" : "var(--risk)"}} />
                    </span>
                    <span className="mono tnum" style={{fontSize: 11, textAlign: "right"}}>{e.cov}%</span>
                    <span className="mono tnum" style={{fontSize: 10.5, textAlign: "right",
                      color: e.d.startsWith("\u2013") ? "var(--risk)" : "var(--text-mute)"}}>{e.d}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      <div className="card">
          <div className="card-head">
            <h3>Agent utilization</h3>
            <span className="mono-eye" style={{marginLeft: "auto"}}>% busy · open tasks</span>
          </div>
          <div className="card-body col" style={{gap: 6}}>
            {[
              {n: "Pixel",    role: "Frontend",    c: 4, pct: 90, status: "active"},
              {n: "Forge",    role: "Backend",     c: 2, pct: 45, status: "idle"},
              {n: "Palette",  role: "UI",          c: 3, pct: 70, status: "active"},
              {n: "Lens",     role: "Review",      c: 3, pct: 70, status: "review"},
              {n: "Compass",  role: "PO",          c: 2, pct: 40, status: "active"},
              {n: "Sentinel", role: "QA",          c: 1, pct: 20, status: "idle"},
            ].map(a => {
              const dot = a.status === "active" ? "var(--ok)" :
                          a.status === "review" ? "var(--info)" :
                          a.status === "blocked" ? "var(--risk)" : "var(--text-mute)";
              const bar = a.pct >= 80 ? "var(--risk)" : a.pct >= 60 ? "var(--warn)" : "var(--plan-accent)";
              return (
                <div key={a.n} style={{display: "grid", gridTemplateColumns: "8px 78px 1fr 40px 34px", gap: 10, alignItems: "center"}}>
                  <span style={{width: 6, height: 6, borderRadius: 999, background: dot, display: "inline-block"}} />
                  <div style={{minWidth: 0}}>
                    <div className="disp" style={{fontSize: 12.5, lineHeight: 1}}>{a.n}</div>
                    <div className="mono" style={{fontSize: 9.5, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2}}>{a.role}</div>
                  </div>
                  <span style={{height: 6, background: "var(--surface-2)", borderRadius: 4, overflow: "hidden"}} title={`${a.pct}% busy`}>
                    <span style={{display: "block", height: "100%", width: a.pct + "%", background: bar}} />
                  </span>
                  <span className="mono tnum" style={{fontSize: 11, color: "var(--text-dim)", textAlign: "right"}}>{a.pct}%</span>
                  <span className="mono tnum" style={{fontSize: 11, color: "var(--text)", textAlign: "right"}} title="Open tasks">
                    {a.c}<span style={{color: "var(--text-mute)", marginLeft: 2}}>t</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
    </div>
  );
}

function KanbanTab() {
  const cols = [
    { id: "todo", title: "To Do", items: window.DATA.kanban.todo },
    { id: "planned", title: "Planned", items: window.DATA.kanban.planned },
    { id: "inprog", title: "In Progress", items: window.DATA.kanban.inprog },
    { id: "blocked", title: "Blocked", items: window.DATA.kanban.blocked },
  ];
  return (
    <div>
      <div className="kanban">
        {cols.map(c => (
          <div className="kcol" key={c.id}>
            <header>
              <h4>{c.title}</h4>
              <span className="n">{c.items.length}</span>
            </header>
            {c.items.map(it => (
              <div className="kcard" key={it.id} data-epic={it.epic}>
                <div className="row" style={{justifyContent: "space-between"}}>
                  <span className="id">{it.id}</span>
                  <Chip tone={c.id === "blocked" ? "risk" : c.id === "inprog" ? "info" : "mute"}>EPIC-{String(it.epic).padStart(4,"0")}</Chip>
                </div>
                <div className="title">{it.title}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlaceholderTab({ name }) {
  return (
    <div className="card" style={{padding: "42px 28px", display: "grid", placeItems: "center"}}>
      <div style={{textAlign: "center"}}>
        <div className="eyebrow">Tab preview</div>
        <div className="disp" style={{fontSize: 32, marginTop: 8}}>{name}</div>
        <div style={{color: "var(--text-dim)", fontSize: 13, marginTop: 8, maxWidth: 480}}>
          This tab would adopt the same editorial masthead, shared KPI row, and chart palette — no more
          mismatched chart legends or orphan color systems.
        </div>
      </div>
    </div>
  );
}

function Sidebar({ tab, setTab }) {
  const nav = [
    { id: "status", name: "Status" },
    { id: "hierarchy", name: "Hierarchy", count: 124 },
    { id: "kanban", name: "Kanban", count: 31 },
    { id: "traceability", name: "Traceability" },
    { id: "trends", name: "Trends" },
    { id: "costs", name: "Costs" },
    { id: "bugs", name: "Bugs", count: 4 },
    { id: "lessons", name: "Lessons" },
  ];
  return (
    <aside className="plan-side">
      <div className="eyebrow" style={{marginBottom: 10}}>Report</div>
      <nav className="nav">
        {nav.map(n => (
          <button key={n.id} aria-current={tab === n.id ? "page" : undefined} onClick={() => setTab(n.id)}>
            <span>{n.name}</span>
            {n.count != null && <span className="count">{n.count}</span>}
          </button>
        ))}
      </nav>
      <div className="hair" />
      <div className="eyebrow" style={{marginBottom: 10}}>Jump</div>
      <nav className="nav">
        <button><span>Agents</span></button>
        <button><span>Releases</span></button>
        <button><span>Search · ⌘K</span></button>
      </nav>
    </aside>
  );
}

function Aside() {
  const D = window.DATA;
  return (
    <aside className="plan-aside">
      <div className="eyebrow" style={{marginBottom: 10}}>Recent activity</div>
      <div className="stream">
        {D.activity.map((a, i) => (
          <div className="item" key={i}>
            <div className="head">
              <span className="who disp">{a.who}</span>
              <span className="when">{a.when}</span>
            </div>
            <div className="msg">{a.msg}</div>
          </div>
        ))}
      </div>
    </aside>
  );
}

function PlanDashboard({ theme }) {
  const [tab, setTab] = useState("status");
  return (
    <div className="plan">
      <Sidebar tab={tab} setTab={setTab} />
      <main className="plan-main">
        <Masthead tab={tab} theme={theme} />
        {tab === "status" && <StatusTab />}
        {tab === "kanban" && <KanbanTab />}
        {!["status", "kanban"].includes(tab) && <PlaceholderTab name={tab.charAt(0).toUpperCase() + tab.slice(1)} />}
      </main>
      <Aside />
    </div>
  );
}

window.PlanDashboard = PlanDashboard;
