export type CategoryId =
  | 'inversiones'
  | 'departamento'
  | 'ropa'
  | 'restaurantes'
  | 'supermercado'
  | 'deporte'
  | 'transporte'
  | 'carrete'
  | 'salud';

export type IncomeTypeId =
  | 'sueldo'
  | 'devolucion'
  | 'transferencia_in'
  | 'otros_ingresos';

export type TransactionDirection = 'in' | 'out';

export interface SplitInfo {
  totalPeople: number;
  myShare: number;
  recovered: number;
  description: string;
}

export interface Transaction {
  id: string;
  merchant: string;
  amount: number;
  type: string;
  direction: TransactionDirection;
  date: string;
  category: CategoryId | IncomeTypeId | null;
  aiConfident: boolean;
  aiSource: 'memory' | 'local' | 'ai' | 'income' | 'manual' | null;
  split: SplitInfo | null;
  rawNotificationText?: string;
}

export function effectiveAmount(tx: Transaction): number {
  if (tx.direction === 'out' && tx.split !== null) {
    return tx.split.myShare;
  }
  return tx.amount;
}

export interface MerchantMemory {
  [merchantLower: string]: CategoryId | IncomeTypeId;
}
