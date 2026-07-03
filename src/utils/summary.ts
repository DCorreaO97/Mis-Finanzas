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

  // Pago interno = plata entre cuentas propias: no es ingreso ni gasto.
  // Los montos se toman en valor absoluto porque devoluciones y pagos
  // internos pueden venir con signo negativo desde el banco.
  const real = txs.filter(t => t.type !== 'pago_interno');

  const income = real
    .filter(t => t.direction === 'in' && t.type !== 'devolucion')
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  const refunds = real
    .filter(t => t.type === 'devolucion')
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  const expenses = real
    .filter(t => t.direction === 'out')
    .reduce((s, t) => s + Math.abs(effectiveAmount(t)), 0);

  const balance     = income + refunds - expenses;
  const savingsRate = income > 0
    ? Math.round((balance / income) * 100)
    : (expenses > 0 ? -100 : 0);
  const pending     = txs.filter(t => t.direction === 'out' && t.category === null).length;

  return { income, expenses, balance, savingsRate, pending, txCount: txs.length };
}

export function getCategoryTotals(
  transactions: Transaction[],
  year: number,
  month: number
): Array<{ id: string; label: string; icon: string; color: string; total: number; count: number }> {
  return CATEGORIES.map(cat => {
    const catTxs = transactions.filter(t =>
      t.direction === 'out' &&
      t.type !== 'pago_interno' &&
      t.category === cat.id &&
      new Date(t.date).getFullYear() === year &&
      new Date(t.date).getMonth() === month
    );
    return {
      ...cat,
      total: catTxs.reduce((s, t) => s + Math.abs(effectiveAmount(t)), 0),
      count: catTxs.length,
    };
  }).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
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
