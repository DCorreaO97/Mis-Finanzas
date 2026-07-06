/**
 * Paleta Banco Falabella (extraída de la app oficial):
 * fondo claro gris-verdoso, tarjetas blancas flotantes, números en
 * casi-negro, verde solo como acento y magenta CMR para alertas.
 */
export const COLORS = {
  // Fondos
  background:    '#EEF3F1',   // Gris-verdoso claro (fondo app banco)
  surface:       '#FFFFFF',   // Tarjetas blancas
  surfaceHigh:   '#F5F8F6',   // Tarjetas secundarias
  border:        '#E6ECE9',   // Bordes casi invisibles

  // Verdes Falabella
  green:         '#3FA33C',   // Verde acento (barra "Has utilizado")
  greenDark:     '#2E8231',   // Verde oscuro
  greenMid:      '#3FA33C',   // Verde medio
  greenLight:    '#8CCB43',   // Lima de la hoja del logo
  greenFaint:    '#EAF6E7',   // Verde muy suave (fondos de chips)

  // Texto
  textPrimary:   '#20262B',   // Casi negro (números grandes del banco)
  textSecondary: '#5C6670',   // Gris medio (labels de tarjetas)
  textMuted:     '#98A39E',   // Gris verdoso claro

  // Semánticos
  income:        '#3FA33C',
  incomeText:    '#2E8231',
  expense:       '#E23B3B',
  expenseText:   '#C62828',
  pending:       '#E31C58',   // Magenta CMR (badge "HASTA 40% DCTO")
  pendingText:   '#C0154A',
  split:         '#2E8231',

  // Sombras (suaves — las tarjetas flotan, no se delinean)
  shadow:        'rgba(16,40,26,0.06)',
  shadowMd:      'rgba(16,40,26,0.10)',
};
