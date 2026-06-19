import { CategoryId, IncomeTypeId } from '../types';

export interface Category {
  id: CategoryId;
  label: string;
  icon: string;
  color: string;
}

export interface IncomeType {
  id: IncomeTypeId;
  label: string;
  icon: string;
}

export const CATEGORIES: Category[] = [
  { id: 'inversiones',  label: 'Inversiones',         icon: '📈', color: '#2E7D32' },
  { id: 'departamento', label: 'Departamento',        icon: '🏠', color: '#388E3C' },
  { id: 'ropa',         label: 'Ropa',                icon: '👕', color: '#43A047' },
  { id: 'restaurantes', label: 'Restaurantes',        icon: '🍽️', color: '#4CAF50' },
  { id: 'supermercado', label: 'Supermercado',        icon: '🛒', color: '#66BB6A' },
  { id: 'deporte',      label: 'Salud/Deporte',       icon: '⚽', color: '#81C784' },
  { id: 'transporte',   label: 'Transporte',          icon: '🚌', color: '#1B5E20' },
  { id: 'carrete',      label: 'Carrete',             icon: '🎉', color: '#558B2F' },
  { id: 'salud',        label: 'Salud',               icon: '💊', color: '#33691E' },
  { id: 'compras_imp',  label: 'Compras Impulsivas',  icon: '🛍️', color: '#7B1FA2' },
  { id: 'entretenim',   label: 'Entretención/Viajes', icon: '✈️', color: '#0288D1' },
  { id: 'suscripciones',label: 'Suscripciones',       icon: '📱', color: '#00838F' },
  { id: 'regalos',      label: 'Regalos',             icon: '🎁', color: '#E91E63' },
  { id: 'otras',        label: 'Otras',               icon: '📦', color: '#607D8B' },
  { id: 'pago_interno', label: 'Pago Interno',        icon: '🔄', color: '#546E7A' },
];

export const INCOME_TYPES: IncomeType[] = [
  { id: 'sueldo',           label: 'Sueldo',                icon: '💼' },
  { id: 'devolucion',       label: 'Devolución / Cobro',    icon: '🔄' },
  { id: 'transferencia_in', label: 'Transferencia recibida', icon: '📥' },
  { id: 'otros_ingresos',   label: 'Otros ingresos',        icon: '💰' },
];

export const CATEGORY_IDS = new Set(CATEGORIES.map(c => c.id));

export const LOCAL_MERCHANT_MAP: Record<string, CategoryId> = {
  // Supermercados
  jumbo: 'supermercado', lider: 'supermercado', tottus: 'supermercado',
  unimarc: 'supermercado', acuenta: 'supermercado', ekono: 'supermercado',
  // Tiendas de ropa
  paris: 'ropa', ripley: 'ropa', zara: 'ropa', hm: 'ropa',
  forever21: 'ropa', gap: 'ropa', levis: 'ropa', adidas: 'ropa', nike: 'ropa',
  // Transporte
  uber: 'transporte', cabify: 'transporte', didi: 'transporte',
  metro: 'transporte', bip: 'transporte', transantiago: 'transporte',
  // Restaurantes / Delivery
  mcdonalds: 'restaurantes', 'burger king': 'restaurantes', starbucks: 'restaurantes',
  rappi: 'restaurantes', ubereats: 'restaurantes', pedidosya: 'restaurantes',
  dominos: 'restaurantes', pizza: 'restaurantes', sushi: 'restaurantes',
  // Inversiones
  fintual: 'inversiones', 'bice vida': 'inversiones', banchile: 'inversiones',
  'la polar': 'inversiones', credicorp: 'inversiones',
  // Deporte
  smartfit: 'deporte', 'total fitness': 'deporte', decathlon: 'deporte',
  intersport: 'deporte',
  // Salud
  farmacia: 'salud', 'cruz verde': 'salud', salcobrand: 'salud',
  ahumada: 'salud', clinica: 'salud', isapre: 'salud', fonasa: 'salud',
  // Entretenimiento
  netflix: 'carrete', spotify: 'carrete', steam: 'carrete',
  'hbo max': 'carrete', disney: 'carrete', prime: 'carrete',
  // Departamento / Vivienda
  dividendo: 'departamento', 'gastos comunes': 'departamento',
  arriendo: 'departamento', 'banco estado': 'departamento',
};
