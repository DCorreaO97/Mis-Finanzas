import { Transaction, effectiveAmount } from '../types';
import { CATEGORIES, INCOME_REFUND_MAP } from '../constants/categories';
import { Budgets } from '../storage';

// ────────────────────────────────────────────────────────────
// Presupuestos sugeridos
// ────────────────────────────────────────────────────────────

/**
 * Sugiere un presupuesto mensual por categoría: promedio de los últimos
 * 6 meses COMPLETOS (excluye el mes en curso), neto de devoluciones,
 * redondeado a los $10.000 más cercanos.
 */
export function suggestBudgets(transactions: Transaction[]): Budgets {
  const now = new Date();
  const currentKey = now.getFullYear() * 12 + now.getMonth();

  // Meses completos presentes en los datos (hasta 6, excluyendo el actual)
  const monthKeys = new Set<number>();
  transactions.forEach(t => {
    const d = new Date(t.date);
    const key = d.getFullYear() * 12 + d.getMonth();
    if (key < currentKey) monthKeys.add(key);
  });
  const months = Array.from(monthKeys).sort((a, b) => b - a).slice(0, 6);
  if (months.length === 0) return {};

  const budgets: Budgets = {};
  for (const cat of CATEGORIES) {
    if (cat.id === 'pago_interno') continue;
    let total = 0;
    for (const t of transactions) {
      const d = new Date(t.date);
      const key = d.getFullYear() * 12 + d.getMonth();
      if (!months.includes(key) || t.category !== cat.id || t.type === 'pago_interno') continue;
      if (t.direction === 'out')       total += Math.abs(effectiveAmount(t));
      else if (t.type === 'devolucion') total -= Math.abs(t.amount);
    }
    const avg = total / months.length;
    if (avg > 5000) {
      budgets[cat.id] = Math.round(avg / 10000) * 10000 || 10000;
    }
  }
  return budgets;
}

/** Gasto neto acumulado de una categoría en un mes (gastos - devoluciones). */
export function categoryMonthTotal(
  transactions: Transaction[],
  categoryId: string,
  year: number,
  month: number
): number {
  let total = 0;
  for (const t of transactions) {
    const d = new Date(t.date);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    if (t.category !== categoryId || t.type === 'pago_interno') continue;
    if (t.direction === 'out')        total += Math.abs(effectiveAmount(t));
    else if (t.type === 'devolucion') total -= Math.abs(t.amount);
  }
  return total;
}

// ────────────────────────────────────────────────────────────
// Gastos recurrentes
// ────────────────────────────────────────────────────────────

export interface RecurringExpense {
  merchant:    string;      // nombre normalizado para mostrar
  category:    string | null;
  amount:      number;      // último monto cobrado
  occurrences: number;
  lastDate:    string;      // ISO de la última ocurrencia
  avgInterval: number;      // días promedio entre cobros
}

function normalizeMerchant(m: string): string {
  return m.toUpperCase().replace(/\s+/g, ' ').trim();
}

/**
 * Detecta gastos recurrentes: mismo comercio, ≥3 ocurrencias,
 * intervalo típico mensual (20–40 días) y monto estable (±25%).
 */
export function detectRecurring(transactions: Transaction[]): RecurringExpense[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (t.direction !== 'out' || t.type === 'pago_interno') continue;
    const key = normalizeMerchant(t.merchant);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  const result: RecurringExpense[] = [];
  for (const [merchant, txs] of groups) {
    if (txs.length < 3) continue;
    const sorted = [...txs].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Intervalos entre ocurrencias consecutivas (en días)
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push(
        (new Date(sorted[i].date).getTime() - new Date(sorted[i - 1].date).getTime()) / 86400000
      );
    }
    const avgInterval = intervals.reduce((s, x) => s + x, 0) / intervals.length;
    if (avgInterval < 20 || avgInterval > 40) continue;

    // Estabilidad del monto: todos dentro de ±25% de la mediana
    const amounts = sorted.map(t => Math.abs(t.amount)).sort((a, b) => a - b);
    const median  = amounts[Math.floor(amounts.length / 2)];
    if (median <= 0) continue;
    const stable = amounts.every(a => Math.abs(a - median) / median <= 0.25);
    if (!stable) continue;

    const last = sorted[sorted.length - 1];
    result.push({
      merchant,
      category:    last.category,
      amount:      Math.abs(last.amount),
      occurrences: sorted.length,
      lastDate:    last.date,
      avgInterval: Math.round(avgInterval),
    });
  }
  return result.sort((a, b) => b.amount - a.amount);
}

// ────────────────────────────────────────────────────────────
// Aportes de arriendo desalineados
// ────────────────────────────────────────────────────────────

export interface MoveSuggestion {
  tx:          Transaction;
  targetYear:  number;
  targetMonth: number;   // 0-based (como Date.getMonth())
  targetLabel: string;
}

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

/**
 * Detecta aportes de arriendo (devoluciones de departamento de los
 * remitentes conocidos) que llegaron en los primeros 5 días del mes
 * y quedaron en el mes equivocado. Solo sugiere mover cuando:
 *  1. el mes del aporte queda con departamento NEGATIVO (el aporte no
 *     tiene gasto que compensar en su mes), y
 *  2. el mes anterior tiene departamento POSITIVO (allá está el gasto).
 * Así no se sugiere mover aportes que ya están alineados con su pago.
 */
export function detectMisalignedRefunds(
  transactions: Transaction[],
  dismissedIds: string[]
): MoveSuggestion[] {
  const dismissed = new Set(dismissedIds);
  const refundKeys = Object.keys(INCOME_REFUND_MAP);

  return transactions
    .filter(t => {
      if (t.type !== 'devolucion' || t.category !== 'departamento') return false;
      if (dismissed.has(t.id)) return false;
      const ml = t.merchant.toLowerCase();
      if (!refundKeys.some(k => ml.includes(k))) return false;
      const d = new Date(t.date);
      if (d.getDate() > 5) return false;

      const netHere = categoryMonthTotal(
        transactions, 'departamento', d.getFullYear(), d.getMonth()
      );
      if (netHere >= 0) return false;   // su mes ya cuadra: no sugerir

      const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      const netPrev = categoryMonthTotal(
        transactions, 'departamento', prev.getFullYear(), prev.getMonth()
      );
      return netPrev > 0;               // el mes anterior tiene gasto que compensar
    })
    .map(t => {
      const d = new Date(t.date);
      const target = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      return {
        tx: t,
        targetYear:  target.getFullYear(),
        targetMonth: target.getMonth(),
        targetLabel: `${MONTH_NAMES[target.getMonth()]} ${target.getFullYear()}`,
      };
    })
    .sort((a, b) => new Date(b.tx.date).getTime() - new Date(a.tx.date).getTime());
}
