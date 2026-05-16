export function monthsUntil(targetDate) {
  const now = new Date();
  const t = new Date(targetDate);
  return Math.max(1, (t.getFullYear() - now.getFullYear()) * 12 + (t.getMonth() - now.getMonth()));
}

export function calcGoalMonthly(goal) {
  const remaining = (goal.targetAmount || 0) - (goal.savedAmount || 0);
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / monthsUntil(goal.targetDate));
}

export function calcGoalProgress(goal) {
  if (!goal.targetAmount) return 0;
  return Math.min(100, Math.round(((goal.savedAmount || 0) / goal.targetAmount) * 100));
}

export function calcCommitmentsTotal(commitments) {
  return commitments.filter(c => c.active !== false).reduce((s, c) => s + (c.amount || 0), 0);
}

export function calcGoalsMonthlyTotal(goals) {
  return goals.filter(g => !g.completed).reduce((s, g) => s + (g.monthlyContribution || 0), 0);
}

export function calcSpent(expenses, month) {
  return expenses.filter(e => e.month === month).reduce((s, e) => s + (e.amount || 0), 0);
}

export function calcRemaining(salary, commitmentsTotal, goalsTotal, expenseBudget) {
  return (salary || 0) - commitmentsTotal - goalsTotal - (expenseBudget || 0);
}
