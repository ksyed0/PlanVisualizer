'use strict';

function computeBudgetMetrics(data, config, snapshots) {
  const budget = config.budget || {};
  const explicitTotalBudget = budget.totalUsd !== null && budget.totalUsd !== undefined;
  const byEpic = budget.byEpic || {};
  const thresholds = budget.thresholds || [50, 75, 90, 100];

  const totals = data.costs && data.costs._totals ? data.costs._totals : {};
  const totalSpent = (totals.costUsd !== null && totals.costUsd !== undefined) ? totals.costUsd : 0;
  const totalProjected = Object.values(data.costs || {}).reduce((sum, c) => {
    if (c && typeof c === 'object' && c.projectedUsd) {
      return sum + c.projectedUsd;
    }
    return sum;
  }, 0);

  const plannedProjected = (data.stories || [])
    .filter(s => s.status === 'Planned' || s.status === 'To Do')
    .reduce((sum, st) => sum + ((data.costs[st.id] && data.costs[st.id].projectedUsd) || 0), 0);

  const totalBudget = explicitTotalBudget 
    ? budget.totalUsd 
    : (totalSpent + plannedProjected);

  let burnRate = 0;
  let daysRemaining = null;
  let projectedExhaustion = null;

  if (snapshots && snapshots.length >= 2) {
    const sorted = [...snapshots].sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt));
    const latest = sorted[0];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recent = sorted.filter(s => new Date(s.generatedAt) >= thirtyDaysAgo);
    if (recent.length >= 2) {
      const oldest = recent[recent.length - 1];
      const costDiff = (latest.data.costs._totals?.costUsd || 0) - (oldest.data.costs._totals?.costUsd || 0);
      const daysDiff = Math.max(1, Math.ceil((new Date(latest.generatedAt) - new Date(oldest.generatedAt)) / (1000 * 60 * 60 * 24)));
      burnRate = costDiff / daysDiff;

      if (burnRate > 0 && totalBudget && totalSpent < totalBudget) {
        const remaining = totalBudget - totalSpent;
        daysRemaining = Math.floor(remaining / burnRate);
        projectedExhaustion = daysRemaining;
      }
    }
  }

  const percentUsed = totalBudget ? Math.round((totalSpent / totalBudget) * 100) : null;
  const crossedThresholds = thresholds.filter(t => percentUsed !== null && percentUsed >= t);

  const epicBudgets = (data.epics || []).map(epic => {
    const epicStories = (data.stories || []).filter(s => s.epicId === epic.id);
    const spent = epicStories.reduce((sum, st) => sum + ((data.costs[st.id] && data.costs[st.id].costUsd) || 0), 0);
    const epicPlanned = epicStories.filter(s => s.status === 'Planned' || s.status === 'To Do');
    const plannedProjected = epicPlanned.reduce((sum, st) => sum + ((data.costs[st.id] && data.costs[st.id].projectedUsd) || 0), 0);
    const explicitEpicBudget = byEpic[epic.id];
    const epicBudget = explicitEpicBudget !== undefined 
      ? explicitEpicBudget 
      : (spent + plannedProjected);
    const remaining = epicBudget !== undefined ? epicBudget - spent : null;
    const pctUsed = epicBudget !== undefined ? Math.round((spent / epicBudget) * 100) : null;
    return {
      id: epic.id,
      title: epic.title,
      budget: epicBudget,
      spent: spent,
      remaining: remaining,
      percentUsed: pctUsed,
    };
  }).sort((a, b) => {
    if (a.percentUsed === null && b.percentUsed === null) return 0;
    if (a.percentUsed === null) return 1;
    if (b.percentUsed === null) return -1;
    return b.percentUsed - a.percentUsed;
  });

  return {
    totalBudget,
    totalSpent,
    totalProjected,
    percentUsed,
    burnRate,
    daysRemaining,
    projectedExhaustion,
    thresholds,
    crossedThresholds,
    epicBudgets,
    hasBudget: totalBudget !== null && totalBudget > 0,
  };
}

function generateBudgetCSV(data, budgetMetrics, snapshots) {
  if (!budgetMetrics) return '';
  const lines = ['Date,Epic ID,Epic Title,Budget,Spent,Remaining,% Used,Burn Rate,Projected Exhaustion'];
  const today = new Date().toISOString().split('T')[0];
  const burnRate = (budgetMetrics.burnRate !== null ? budgetMetrics.burnRate : 0).toFixed(2);
  const exhaustion = budgetMetrics.daysRemaining !== null ? `${budgetMetrics.daysRemaining} days` : 'N/A';

  for (const epic of (budgetMetrics.epicBudgets || [])) {
    const budget = epic.budget !== null ? Number(epic.budget).toFixed(2) : '';
    const spent = Number(epic.spent || 0).toFixed(2);
    const remaining = epic.remaining !== null ? Number(epic.remaining).toFixed(2) : '';
    const pct = epic.percentUsed !== null ? `${epic.percentUsed}%` : '';

    lines.push(`${today},${epic.id},"${epic.title}",${budget},${spent},${remaining},${pct},${burnRate},${exhaustion}`);
  }

  if (snapshots && snapshots.length > 0) {
    const sorted = [...snapshots].sort((a, b) => new Date(a.generatedAt) - new Date(b.generatedAt));
    const epicMap = {};
    for (const epic of (budgetMetrics.epicBudgets || [])) {
      epicMap[epic.id] = epic;
    }

    for (const snap of sorted) {
      const date = snap.generatedAt.split('T')[0];
      const snapCosts = snap.data.costs || {};

      for (const epic of (data.epics || [])) {
        const epicStories = (snap.data.stories || []).filter(s => s.epicId === epic.id);
        const spent = epicStories.reduce((sum, st) => sum + ((snapCosts[st.id] && snapCosts[st.id].costUsd) || 0), 0);
        const epicBudget = epicMap[epic.id];
        const budget = epicBudget && epicBudget.budget !== null ? Number(epicBudget.budget).toFixed(2) : '';
        const remaining = epicBudget && epicBudget.budget !== null ? (Number(epicBudget.budget) - spent).toFixed(2) : '';
        const pct = epicBudget && epicBudget.percentUsed !== null ? `${epicBudget.percentUsed}%` : '';

        lines.push(`${date},${epic.id},"${epic.title}",${budget},${Number(spent).toFixed(2)},${remaining},${pct},,`);
      }
    }
  }

  return lines.join('\n');
}

module.exports = {
  computeBudgetMetrics,
  generateBudgetCSV,
};
