// Mock data for the prototype. Numbers are plausible but not live.
window.DATA = {
  // The project BEING REPORTED ON (the host codebase that installed Plan Visualizer).
  project: {
    name: "Acme Platform",
    subtitle: "Payments & identity platform for Acme Co.",
    release: "R1.10",
    updated: "Apr 19, 2026 · 14:28",
    tagline: "Payments & identity platform for Acme Co.",
    version: "1.10.0",
    buildNumber: "412",
    commitSha: "a4f11c2",
    branch: "feature/EPIC-0020-cross-dashboard-redesign",
    githubUrl: "https://github.com/acme/platform",
  },

  // The tool itself (Plan Visualizer / Agentic Dashboard generator).
  tool: {
    name: "Plan Visualizer",
    version: "1.10.0",
    appName: "Plan Visualizer",
    generatedAt: "Apr 19, 2026 · 14:28 UTC",
    author: "Implemented by Kamal Syed, 2026",
    githubUrl: "https://github.com/yourorg/plan-visualizer",
    mission: "A self-documenting dashboard pair for agentic SDLC platforms. Plan-Status is the editorial report; Pipeline is live mission control. Both read from the same JSON fixtures and roster.",
  },

  roster: [
    { name: "Conductor", role: "Delivery Manager",   icon: "🎯" },
    { name: "Compass",   role: "Product Owner",      icon: "🧭" },
    { name: "Keystone",  role: "Architect",          icon: "🏗️" },
    { name: "Lens",      role: "Code Reviewer",      icon: "🔍" },
    { name: "Palette",   role: "UI Designer",        icon: "🎨" },
    { name: "Forge",     role: "Backend Developer",  icon: "⚒️" },
    { name: "Pixel",     role: "Frontend Developer", icon: "📱" },
    { name: "Sentinel",  role: "Functional Tester",  icon: "🛡️" },
    { name: "Circuit",   role: "Automation Tester",  icon: "⚡" },
  ],

  roster: [
    { name: "Conductor", role: "Delivery Manager",   icon: "🎯" },
    { name: "Compass",   role: "Product Owner",      icon: "🧭" },
    { name: "Keystone",  role: "Architect",          icon: "🏗️" },
    { name: "Lens",      role: "Code Reviewer",      icon: "🔍" },
    { name: "Palette",   role: "UI Designer",        icon: "🎨" },
    { name: "Forge",     role: "Backend Developer",  icon: "⚒️" },
    { name: "Pixel",     role: "Frontend Developer", icon: "📱" },
    { name: "Sentinel",  role: "Functional Tester",  icon: "🛡️" },
    { name: "Circuit",   role: "Automation Tester",  icon: "⚡" },
  ],

  kpis: [
    { id: "progress",   label: "Overall progress",  big: "76",  unit: "%",  foot: "94 of 124 stories done", trend: "up",   delta: "+6.2% wk" },
    { id: "coverage",   label: "Test coverage",     big: "82.4",unit: "%",  foot: "Statements · last run 14:12", trend: "up",  delta: "+0.4% wk" },
    { id: "bugs",       label: "Open bugs",         big: "4",   unit: "",   foot: "1 high · 2 med · 1 low", trend: "dn",  delta: "−2 wk" },
    { id: "spend",      label: "AI spend",          big: "$497",unit: "",   foot: "of $2,189 budget (22.7%)", trend: "up", delta: "+$38 wk" },
  ],

  epics: [
    { id: "EPIC-0006", name: "Dashboard UX & Quality Improvements", pct: 100, status: "done"   },
    { id: "EPIC-0010", name: "Risk Analytics",                      pct: 18,  status: "planning" },
    { id: "EPIC-0011", name: "Search",                              pct: 100, status: "done"   },
    { id: "EPIC-0012", name: "Stakeholder View",                    pct: 30,  status: "planning" },
    { id: "EPIC-0015", name: "UI Review and Redesign",              pct: 100, status: "done"   },
    { id: "EPIC-0016", name: "Agentic Mission Control Redesign",    pct: 100, status: "done"   },
    { id: "EPIC-0019", name: "Dashboard Cycle History",             pct: 42,  status: "in-progress" },
    { id: "EPIC-0020", name: "Cross-Dashboard Redesign",            pct: 8,   status: "in-progress" },
  ],

  activity: [
    { when: "14:28", who: "Conductor",  msg: "Dispatched US-0133 → Palette for visual review." },
    { when: "14:21", who: "Sentinel",   msg: "Test run complete · 312 passed · 0 failed · +0.4% coverage." },
    { when: "14:05", who: "Lens",       msg: "Review verdict APPROVE on PR #412 (US-0131)." },
    { when: "13:47", who: "Forge",      msg: "Merged feature/US-0131 → develop (12 files changed)." },
    { when: "13:02", who: "Compass",    msg: "Refined 4 ACs under EPIC-0019 (Cycle History)." },
    { when: "12:18", who: "Pixel",      msg: "Integrated cycle-lap strip into dashboard.html." },
  ],

  agents: [
    { name: "Conductor", role: "Delivery Manager", status: "active",  task: "Dispatching US-0133", count: "37 tasks", branch: null },
    { name: "Compass",   role: "Product Owner",    status: "active",  task: "Refining EPIC-0020 ACs", count: "12 stories", branch: "spec/EPIC-0020-redesign" },
    { name: "Keystone",  role: "Architect",        status: "idle",    task: "—",                    count: "—", branch: null },
    { name: "Lens",      role: "Code Reviewer",    status: "review",  task: "Reviewing PR #413",    count: "3 queued", branch: "feat/US-0132-masthead" },
    { name: "Palette",   role: "UI Designer",      status: "active",  task: "Redesign canvas v3",   count: "US-0135", branch: "feat/US-0135-redesign-canvas" },
    { name: "Forge",     role: "Backend",          status: "idle",    task: "—",                    count: "—", branch: null },
    { name: "Pixel",     role: "Frontend",         status: "active",  task: "CD-Redesign scaffold", count: "US-0137", branch: "feat/US-0137-cd-redesign" },
    { name: "Sentinel",  role: "QA / Tests",       status: "idle",    task: "Standby",              count: "312 / 312", branch: null },
    { name: "Circuit",   role: "Coverage",         status: "blocked", task: "Missing fixture",      count: "82.4%", branch: "fix/US-0134-coverage-fixture" },
  ],

  pipeline: [
    { n: "01", name: "Blueprint",   agents: "Compass",              status: "done"   },
    { n: "02", name: "Architect",   agents: "Keystone",             status: "done"   },
    { n: "03", name: "Build",       agents: "Pixel · Forge · Palette", status: "active" },
    { n: "04", name: "Integration", agents: "Pixel",                status: "pending" },
    { n: "05", name: "Test",        agents: "Sentinel · Circuit",   status: "pending" },
    { n: "06", name: "Polish",      agents: "Pixel · Forge",        status: "pending" },
  ],

  eventFeed: [
    { t: "14:28:04", who: "Conductor", tag: "dispatch", msg: "Assigned US-0133 → Palette for visual review." },
    { t: "14:27:51", who: "Palette",   tag: "start",    msg: "Picked up US-0133 · branch feature/US-0133-redesign." },
    { t: "14:26:02", who: "Sentinel",  tag: "done",     msg: "312 tests pass · coverage 82.4% (+0.4)." },
    { t: "14:25:40", who: "Sentinel",  tag: "start",    msg: "Running jest --coverage on develop@a4f11c2." },
    { t: "14:22:18", who: "Lens",      tag: "review",   msg: "APPROVE · PR #412 · 1 minor comment." },
    { t: "14:19:07", who: "Forge",     tag: "start",    msg: "Pushed 3 commits to feature/US-0131." },
    { t: "14:12:33", who: "Circuit",   tag: "block",    msg: "BLOCKED · coverage fixture missing for tools/lib/theme.js." },
    { t: "14:10:01", who: "Conductor", tag: "dispatch", msg: "Dispatched US-0131 → Forge (backend)." },
    { t: "14:08:44", who: "Compass",   tag: "done",     msg: "Refined 4 ACs on US-0135; ready for dispatch." },
    { t: "14:02:12", who: "Pixel",     tag: "done",     msg: "Shipped lap-strip to staging (US-0116)." },
  ],

  kanban: {
    todo:     [ { id: "US-0137", epic: 20, title: "Shared theme.js tokens for cross-dashboard reuse" },
                { id: "US-0138", epic: 20, title: "Mode badge (REPORT / LIVE) in global chrome" } ],
    planned:  [ { id: "US-0139", epic: 20, title: "Redesign Status tab with hero + forecast" },
                { id: "US-0140", epic: 20, title: "Consolidate chart palette across Trends + Charts" },
                { id: "US-0141", epic: 20, title: "Active-agent prominence on Agentic dashboard" } ],
    inprog:   [ { id: "US-0135", epic: 20, title: "Replace navy header with editorial masthead" },
                { id: "US-0116", epic: 19, title: "Lap-history strip for last 10 cycles" } ],
    blocked:  [ { id: "US-0134", epic: 19, title: "Coverage fixture for theme.js" } ],
  },

  trendWeeks: [ 12, 14, 18, 22, 26, 31, 34, 40, 45, 52, 60, 68, 74, 76 ], // progress %
  coverageHeat: Array.from({length: 30}, (_, i) => {
    // fake 30-day coverage heat
    const base = 72 + Math.sin(i * 0.4) * 8 + (i > 22 ? 8 : 0);
    return Math.round(base);
  }),
  burn: [ 12, 28, 44, 68, 102, 148, 196, 248, 310, 362, 408, 451, 478, 497 ],
};
