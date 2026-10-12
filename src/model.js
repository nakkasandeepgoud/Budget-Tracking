export const categories = ['Food & dining', 'Shopping', 'Transport', 'Housing', 'Health', 'Entertainment', 'Other'];
export function summarize(transactions, month) {
  const selected = transactions.filter(t => t.date.startsWith(month));
  const income = selected.filter(t => t.type === 'income').reduce((s,t) => s + t.amount,0);
  const expenses = selected.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount,0);
  return {income, expenses, balance: income - expenses, selected};
}
export function validTransaction(t) {
  return t && typeof t.id === 'string' && typeof t.name === 'string' && t.name.trim().length > 0 && Number.isFinite(t.amount) && t.amount > 0 && ['income','expense'].includes(t.type) && typeof t.category === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.date) && !Number.isNaN(Date.parse(t.date));
}
