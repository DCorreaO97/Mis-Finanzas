import { TransactionDirection } from '../types';

export interface ParsedTransaction {
  merchant:  string;
  amount:    number;
  type:      string;
  direction: TransactionDirection;
  rawText:   string;
}

export function parseNotification(
  title: string,
  text: string
): ParsedTransaction | null {
  const fullText = `${title} ${text}`.trim();

  const isIncome =
    /abono|depósito|deposito|transferencia recibida|ingreso|sueldo|salario|remuneración/i
    .test(fullText);

  const isExpense =
    /compra aprobada|cargo|débito|debito|compra con|pago realizado|transferencia enviada|giro/i
    .test(fullText);

  if (!isIncome && !isExpense) return null;

  const direction: TransactionDirection = isIncome ? 'in' : 'out';

  const amountPatterns = [
    /\$\s?([\d]{1,3}(?:\.[\d]{3})*)/,
    /\$\s?([\d]+)/,
  ];

  let amount = 0;
  for (const pattern of amountPatterns) {
    const match = fullText.match(pattern);
    if (match) {
      amount = parseInt(match[1].replace(/\./g, ''), 10);
      break;
    }
  }

  if (amount <= 0) return null;

  let merchant = 'Desconocido';

  const patterns = [
    /en\s+([A-ZÁÉÍÓÚÑ][^\n\r$]{2,50?}?)(?:\s+por\s|\s+monto\s|\s*$)/i,
    /de\s+([A-ZÁÉÍÓÚÑ][^\n\r$]{2,50?}?)(?:\s+por\s|\s+\$|\s*$)/i,
    /comercio[:\s]+([A-ZÁÉÍÓÚÑ][^\n\r$]{2,50?}?)(?:\s*$|\s+\$)/i,
  ];

  for (const pattern of patterns) {
    const match = fullText.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].trim().replace(/\s+/g, ' ');
      if (candidate.length > 2 && !['la', 'el', 'un', 'una'].includes(candidate.toLowerCase())) {
        merchant = candidate;
        break;
      }
    }
  }

  let type: string;
  if (direction === 'in') {
    if (/sueldo|salario|remuneración/i.test(fullText)) type = 'sueldo';
    else type = 'transferencia_in';
  } else {
    if (/transferencia enviada|transferencia a\s/i.test(fullText)) type = 'transferencia';
    else if (/dividendo|cuota|pago de\s/i.test(fullText)) type = 'pago';
    else type = 'compra';
  }

  return { merchant, amount, type, direction, rawText: fullText };
}

export function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function timeAgo(dateString: string): string {
  const diff = (Date.now() - new Date(dateString).getTime()) / 1000;
  if (diff < 60)    return 'ahora';
  if (diff < 3600)  return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  const days = Math.floor(diff / 86400);
  if (days === 1)   return 'ayer';
  return `hace ${days} días`;
}
