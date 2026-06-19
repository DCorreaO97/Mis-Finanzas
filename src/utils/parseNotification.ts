import { TransactionDirection } from '../types';

export interface ParsedTransaction {
  merchant:  string;
  amount:    number;
  type:      string;
  direction: TransactionDirection;
  rawText:   string;
}

/**
 * Parsea el título y texto de una notificación del Banco Falabella / CMR.
 *
 * Formatos observados en la práctica:
 *  - "Compra aprobada por $25.990 en LIDER.CL con Tarjeta CMR"
 *  - "Cargo en tu cuenta corriente por $330.196 en PAC Credito Hipotecario"
 *  - "Abono en tu cuenta corriente de $619.254"
 *  - "Transferencia recibida de Benjamin Richasse San Martin por $619.254"
 *  - "Débito automático por $22.742 KHIPU CLBS"
 *  - "Pago de cuota por $584.991 FALABELLA.COM"
 */
export function parseNotification(
  title: string,
  text: string
): ParsedTransaction | null {
  const fullText = `${title} ${text}`.trim();
  const lower    = fullText.toLowerCase();

  // ── Detectar dirección ────────────────────────────────────
  const isIncome =
    /abono|depósito|deposito|transferencia recibida|ingreso|sueldo|salario|remuneración|remuneracion|devolución|devolucion/i
    .test(fullText);

  const isExpense =
    /compra aprobada|cargo en tu|débito|debito|compra con|pago realizado|transferencia enviada|giro|pago de cuota|débito automático|debito automatico/i
    .test(fullText);

  // Si no es ni ingreso ni gasto reconocible → ignorar
  if (!isIncome && !isExpense) return null;

  const direction: TransactionDirection = isIncome ? 'in' : 'out';

  // ── Extraer monto ─────────────────────────────────────────
  const amountPatterns = [
    /\$\s?([\d]{1,3}(?:\.[\d]{3})+)/,   // $1.234.567
    /\$\s?([\d]+)/,                       // $25990
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

  // ── Extraer comercio / origen ─────────────────────────────
  let merchant = 'Desconocido';

  const merchantPatterns = [
    // "compra aprobada por $XX en COMERCIO"
    /(?:en|at)\s+([A-ZÁÉÍÓÚÑ*][^\n\r$]{2,60?})(?:\s+con\s|\s+tarjeta|\s*$)/i,
    // "cargo en tu cuenta por $XX en COMERCIO"
    /\$[\d.,]+\s+(?:en\s+)?([A-ZÁÉÍÓÚÑ*][^\n\r$]{2,60?})(?:\s*$|\s+con\s)/i,
    // "transferencia recibida de NOMBRE"
    /(?:recibida|recibido)\s+de\s+([A-ZÁÉÍÓÚÑa-z][^\n\r$]{2,60?})(?:\s+por\s|\s*$)/i,
    // "abono de NOMBRE" / "débito de NOMBRE"
    /(?:abono|débito|debito)\s+de\s+([A-ZÁÉÍÓÚÑ][^\n\r$]{2,60?})(?:\s+por\s|\s*$)/i,
    // genérico: después de "por $XXXX "
    /(?:por\s+\$[\d.,]+)\s+([A-ZÁÉÍÓÚÑ*][^\n\r$]{2,60?})(?:\s*$)/i,
  ];

  const SKIP_WORDS = new Set(['la', 'el', 'un', 'una', 'los', 'las', 'tu', 'su']);

  for (const pattern of merchantPatterns) {
    const match = fullText.match(pattern);
    if (match?.[1]) {
      const candidate = match[1].trim()
        .replace(/\s+/g, ' ')
        .replace(/\.$/, '')          // quita punto final
        .replace(/\s+(con|via|tarjeta|cmr)$/i, ''); // quita sufijos
      if (
        candidate.length > 2 &&
        !SKIP_WORDS.has(candidate.toLowerCase()) &&
        !/^\d+$/.test(candidate)
      ) {
        merchant = candidate.toUpperCase();
        break;
      }
    }
  }

  // ── Clasificar tipo ───────────────────────────────────────
  let type: string;
  if (direction === 'in') {
    if (/sueldo|salario|remuneración|remuneracion/i.test(lower))   type = 'sueldo';
    else if (/devolución|devolucion/i.test(lower))                  type = 'devolucion';
    else                                                             type = 'transferencia_in';
  } else {
    if (/transferencia enviada|transferencia a\s/i.test(lower))    type = 'transferencia';
    else if (/cuota|pago de\s|pac\s|débito automático/i.test(lower)) type = 'pago';
    else                                                             type = 'compra';
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
