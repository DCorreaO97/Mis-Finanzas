import { Transaction, effectiveAmount } from '../types';
import { CATEGORIES } from '../constants/categories';

export interface MonthSummary {
  income:      number;
  expenses:    number;
  balance:     number;
  savingsRate: number;
  pending:     number;
  txCount:     number;
}

export interface MonthKey {
  year:  number;
  month: number;
  label: string;
}

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

export function getMonthKey(dateString: string): string {
  const d = new Date(dateString);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

export function getMonthLabel(dateString: string): string {
  const d = new Date(dateString);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

export function getMonthSummary(
  transactions: Transaction[],
  year: number,
  month: number
): MonthSummary {
  const txs = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const income   = txs
    .filter(t => t.direction === 'in')
    .reduce((s, t) => s + t.amount, 0);

  const expenses = txs
    .filter(t => t.direction === 'out')
    .reduce((s, t) => s + effectiveAmount(t), 0);

  const balance     = income - expenses;
  const savingsRate = income > 0 ? Math.round((balance / income) * 100) : 0;
  const pending     = txs.filter(t => t.direction === 'out' && t.category === null).length;

  return { income, expenses, balance, savingsRate, pending, txCount: txs.length };
}

export function getCategoryTotals(
  transactions: Transaction[],
  year: number,
  month: number
): Array<{ id: string; label: string; icon: string; color: string; total: number; count: number }> {
  return CATEGORIES.map(cat => ({
    ...cat,
    total: transactions
      .filter(t =>
        t.direction === 'out' &&
        t.category === cat.id &&
        new Date(t.date).getFullYear() === year &&
        new Date(t.date).getMonth() === month
      )
      .reduce((s, t) => s + effectiveAmount(t), 0),
    count: transactions
      .filter(t =>
        t.direction === 'out' &&
        t.category === cat.id &&
        new Date(t.date).getFullYear() === year &&
        new Date(t.date).getMonth() === month
      ).length,
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
}

export function getAllMonths(transactions: Transaction[]): MonthKey[] {
  const seen = new Map<string, MonthKey>();
  transactions.forEach(t => {
    const d   = new Date(t.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!seen.has(key)) {
      seen.set(key, {
        year:  d.getFullYear(),
        month: d.getMonth(),
        label: getMonthLabel(t.date),
      });
    }
  });
  return Array.from(seen.values())
    .sort((a, b) => b.year - a.year || b.month - a.month);
}
