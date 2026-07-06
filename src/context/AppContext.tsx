import React, {
  createContext, useContext, useState, useEffect, useCallback, useRef
} from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Transaction, MerchantMemory } from '../types';
import { Storage, Budgets } from '../storage';
import { parseNotification } from '../utils/parseNotification';
import { categorizeTransaction } from '../utils/categorizeWithAI';
import { INCOME_REFUND_MAP, CATEGORIES } from '../constants/categories';
import { suggestBudgets, categoryMonthTotal } from '../utils/insights';
import { useNotificationListener, FalabellaNotification } from '../hooks/useNotificationListener';

interface AppContextValue {
  transactions:    Transaction[];
  merchantMemory:  MerchantMemory;
  apiKey:          string;
  pendingCount:    number;
  isLoading:       boolean;
  budgets:         Budgets;
  dismissedMoves:  string[];
  setApiKey:       (key: string) => Promise<void>;
  addTransaction:  (params: AddTransactionParams) => Promise<void>;
  categorize:      (txId: string, categoryId: string) => Promise<void>;
  deleteTransaction: (txId: string) => Promise<void>;
  moveTransaction: (txId: string, newYear: number, newMonth: number) => Promise<void>;
  updateTransaction: (txId: string, changes: { merchant?: string; category?: string }) => Promise<void>;
  setBudget:       (categoryId: string, amount: number) => Promise<void>;
  dismissMoveSuggestion: (txId: string) => Promise<void>;
  clearData:       () => Promise<void>;
  requestNotificationPermission: () => void;
}

export interface AddTransactionParams {
  merchant:   string;
  amount:     number;
  type:       string;
  direction:  'in' | 'out';
  split?:     { totalPeople: number; recovered: number; description: string } | null;
  rawText?:   string;
  date?:      string;   // ISO; si no viene, se usa la fecha actual
}

const AppContext = createContext<AppContextValue | null>(null);

function buildSampleData(): Transaction[] {
  const txs: Transaction[] = [
    { id: 'import-363', merchant: "TRANSF. PARA ANDRES HUMUD", amount: 7922, type: 'compra', direction: 'out', date: '2026-07-03T12:00:00.000Z', category: 'carrete', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-364', merchant: "TRANSF. DE VICENTE RODRIGUEZ CANO", amount: -8139, type: 'devolucion', direction: 'in', date: '2026-07-03T12:00:00.000Z', category: 'carrete', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-365', merchant: "TRANSF. PARA CATERINA LEYL", amount: 156000, type: 'compra', direction: 'out', date: '2026-07-03T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-366', merchant: "TRANSF. DE NICOLAS LASSERRE", amount: -8139, type: 'devolucion', direction: 'in', date: '2026-07-03T12:00:00.000Z', category: 'carrete', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-367', merchant: "TRANSF. DE JACINTA SALINAS GANA", amount: -8139, type: 'devolucion', direction: 'in', date: '2026-07-03T12:00:00.000Z', category: 'carrete', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-368', merchant: "TRANSF. DE MACARENA DEL CARMEN CA", amount: -8139, type: 'devolucion', direction: 'in', date: '2026-07-03T12:00:00.000Z', category: 'carrete', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-369', merchant: "TRANSF. DE JOSEFA BARROS", amount: -8140, type: 'devolucion', direction: 'in', date: '2026-07-03T12:00:00.000Z', category: 'carrete', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-370', merchant: "TRANSF. DE JOSE MANUEL SUAZO ZEPEDA", amount: -9156, type: 'devolucion', direction: 'in', date: '2026-07-03T12:00:00.000Z', category: 'carrete', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-371', merchant: "TRANSF. DE MARIA DEL PILAVARGAS", amount: -8139, type: 'devolucion', direction: 'in', date: '2026-07-03T12:00:00.000Z', category: 'carrete', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-372', merchant: "TRANSF. DE 003", amount: 288761, type: 'deposito', direction: 'in', date: '2026-07-02T12:00:00.000Z', category: 'otros_ingresos', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-373', merchant: "PAGO SERVIPAG SANTIAGO CHL", amount: 29500, type: 'compra', direction: 'out', date: '2026-07-01T12:00:00.000Z', category: 'transporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-374', merchant: "TRANSF. PARA COMUNIDAD EDI", amount: 357072, type: 'compra', direction: 'out', date: '2026-07-01T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-375', merchant: "TRANSF. DE BENJAMIN RICHASSE", amount: 565582, type: 'devolucion', direction: 'in', date: '2026-07-01T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-376', merchant: "TRANSF. DE FRANCISCO JOSE RENCORET MOSQU", amount: 656000, type: 'devolucion', direction: 'in', date: '2026-07-01T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-377', merchant: "REMUNERACIONES", amount: 3142879, type: 'deposito', direction: 'in', date: '2026-06-26T12:00:00.000Z', category: 'sueldo', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-378', merchant: "TRANSF. PARA COMUNIDAD EDI", amount: 190000, type: 'compra', direction: 'out', date: '2026-06-24T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-379', merchant: "TRANSF PARA PAGO TARJETA CMR", amount: -2881170, type: 'pago_interno', direction: 'in', date: '2026-06-22T12:00:00.000Z', category: 'pago_interno', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-380', merchant: "TRANSF. DE JOAQUIN ANTONISUBIABRE", amount: 4252, type: 'deposito', direction: 'in', date: '2026-06-16T12:00:00.000Z', category: 'sueldo', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-381', merchant: "TRANSF. DE FABIOLA YOLANDGONZALEZ", amount: 15000, type: 'deposito', direction: 'in', date: '2026-06-16T12:00:00.000Z', category: 'sueldo', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-382', merchant: "TRANSF. DE 003", amount: 288761, type: 'deposito', direction: 'in', date: '2026-06-12T12:00:00.000Z', category: 'otros_ingresos', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-296', merchant: "COMPRA SMART FIT GIMNASIOS", amount: 29016, type: 'compra', direction: 'out', date: '2026-07-01T12:00:00.000Z', category: 'deporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-297', merchant: "COMPRA NEAT PAYER 1", amount: 1470155, type: 'compra', direction: 'out', date: '2026-07-01T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-298', merchant: "COMPRA FURO GROUP SPA", amount: 73249, type: 'compra', direction: 'out', date: '2026-07-01T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-299', merchant: "COMPRA Glovo 29JUN BHJMXYFQ", amount: 1060, type: 'compra', direction: 'out', date: '2026-06-29T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-300', merchant: "COMPRA Disney Plus", amount: 15990, type: 'compra', direction: 'out', date: '2026-06-29T12:00:00.000Z', category: 'suscripciones', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-301', merchant: "COMPRA Glovo 29JUN BGLSEHYW", amount: 29636, type: 'compra', direction: 'out', date: '2026-06-29T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-302', merchant: "COMPRA LIDER.CL", amount: 45219, type: 'compra', direction: 'out', date: '2026-06-29T12:00:00.000Z', category: 'supermercado', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-303', merchant: "COMPRA DUTY FREE SHOP AIRPORT", amount: 43361, type: 'compra', direction: 'out', date: '2026-06-29T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-304', merchant: "COMPRA BCN GAUDI 2017", amount: 17104, type: 'compra', direction: 'out', date: '2026-06-28T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-305', merchant: "COMPRA BLING BLING", amount: 32131, type: 'compra', direction: 'out', date: '2026-06-28T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-306', merchant: "COMPRA TAXI LLIC. 1631", amount: 6694, type: 'compra', direction: 'out', date: '2026-06-28T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-307', merchant: "COMPRA GELATI DINO BORBON", amount: 8782, type: 'compra', direction: 'out', date: '2026-06-27T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-308', merchant: "COMPRA KIOSKO GRAN VIA RAMBLA", amount: 4820, type: 'compra', direction: 'out', date: '2026-06-27T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-309', merchant: "COMPRA PULL & BEAR", amount: 52449, type: 'compra', direction: 'out', date: '2026-06-27T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-310', merchant: "COMPRA JESPAC MALLORCA", amount: 27900, type: 'compra', direction: 'out', date: '2026-06-27T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-311', merchant: "COMPRA TXIRIMIRI", amount: 56497, type: 'compra', direction: 'out', date: '2026-06-27T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-312', merchant: "COMPRA OASIS NATURAL COOKING", amount: 22170, type: 'compra', direction: 'out', date: '2026-06-27T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-313', merchant: "COMPRA COFFEE PARK LES CASCAD", amount: 21421, type: 'compra', direction: 'out', date: '2026-06-27T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-314', merchant: "COMPRA METRO BARCELONA", amount: 8354, type: 'compra', direction: 'out', date: '2026-06-27T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-315', merchant: "DEVOLUCION COMPRA CENTAURO", amount: -38557, type: 'devolucion', direction: 'in', date: '2026-06-26T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-316', merchant: "COMPRA MARINER CLUB APARTMENT", amount: 8938, type: 'compra', direction: 'out', date: '2026-06-26T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-317', merchant: "COMPRA RESTAURANTE OLIMPIA", amount: 14141, type: 'compra', direction: 'out', date: '2026-06-26T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-318', merchant: "COMPRA ES SON OMS", amount: 30497, type: 'compra', direction: 'out', date: '2026-06-26T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-319', merchant: "COMPRA SUPERMERCADO SUNNY", amount: 16387, type: 'compra', direction: 'out', date: '2026-06-26T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-320', merchant: "COMPRA CECOSA SUPERMERCADOS", amount: 9875, type: 'compra', direction: 'out', date: '2026-06-26T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-321', merchant: "COMPRA PICCOLA GELATERIA", amount: 5320, type: 'compra', direction: 'out', date: '2026-06-25T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-322', merchant: "COMPRA FLAMENCO - SOMBRERO", amount: 64697, type: 'compra', direction: 'out', date: '2026-06-25T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-323', merchant: "COMPRA SumUp *Omare MSV393TJ", amount: 29807, type: 'compra', direction: 'out', date: '2026-06-25T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-324', merchant: "COMPRA Rivareno Gelateria", amount: 9581, type: 'compra', direction: 'out', date: '2026-06-25T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-325', merchant: "COMPRA VIATORTRIPADVISOREU", amount: 295937, type: 'compra', direction: 'out', date: '2026-06-25T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-326', merchant: "COMPRA MAX", amount: 14990, type: 'compra', direction: 'out', date: '2026-06-24T12:00:00.000Z', category: 'suscripciones', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-327', merchant: "COMPRA RAPPI PRO", amount: 4990, type: 'compra', direction: 'out', date: '2026-06-24T12:00:00.000Z', category: 'suscripciones', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-328', merchant: "COMPRA ALCUDIA KEBAB", amount: 24484, type: 'compra', direction: 'out', date: '2026-06-24T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-329', merchant: "COMPRA SA BOTIGUETA DE CALA L", amount: 4945, type: 'compra', direction: 'out', date: '2026-06-24T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-330', merchant: "COMPRA MARINER CLUB APARTMENT", amount: 18983, type: 'compra', direction: 'out', date: '2026-06-23T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-331', merchant: "COMPRA LIDL MALL-ALCUDIA", amount: 34085, type: 'compra', direction: 'out', date: '2026-06-23T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-332', merchant: "COMPRA TIB BUS TREN METRO", amount: 10345, type: 'compra', direction: 'out', date: '2026-06-22T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-333', merchant: "COMPRA E.S. BP PUERTO POLLENS", amount: 49714, type: 'compra', direction: 'out', date: '2026-06-22T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-334', merchant: "COMPRA FARMACIA RADO PORTELL", amount: 10703, type: 'compra', direction: 'out', date: '2026-06-22T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-335', merchant: "COMPRA TNA APARCA PASEO MALLO", amount: 5777, type: 'compra', direction: 'out', date: '2026-06-22T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-336', merchant: "COMPRA FORMENTOR - PARKING", amount: 10871, type: 'compra', direction: 'out', date: '2026-06-22T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-337', merchant: "COMPRA MARINER CLUB APARTMENT", amount: 18485, type: 'compra', direction: 'out', date: '2026-06-22T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-338', merchant: "COMPRA CAN PANXO", amount: 85730, type: 'compra', direction: 'out', date: '2026-06-22T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-339', merchant: "COMPRA CAN PESCADOR-P.POLLENS", amount: 7910, type: 'compra', direction: 'out', date: '2026-06-22T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-340', merchant: "COMPRA MDQ - PORTIXOL", amount: 2521, type: 'compra', direction: 'out', date: '2026-06-21T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-341', merchant: "COMPRA BALNEARIO ILLETAS", amount: 94621, type: 'compra', direction: 'out', date: '2026-06-21T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-342', merchant: "COMPRA RESTAURANTE TITANIC", amount: 16595, type: 'compra', direction: 'out', date: '2026-06-21T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-343', merchant: "COMPRA MINI MARKET", amount: 4096, type: 'compra', direction: 'out', date: '2026-06-21T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-344', merchant: "COMPRA BI CALA COMPTESSA", amount: 16595, type: 'compra', direction: 'out', date: '2026-06-21T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-345', merchant: "COMPRA CENTAURO", amount: 37811, type: 'compra', direction: 'out', date: '2026-06-21T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-346', merchant: "COMPRA SumUp *Taxi 6004 Palm", amount: 23317, type: 'compra', direction: 'out', date: '2026-06-21T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-347', merchant: "COMPRA UBER *TRIP HELP.UBER.C", amount: 24104, type: 'compra', direction: 'out', date: '2026-06-21T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-348', merchant: "PAGO TARJETA CMR", amount: -2881170, type: 'pago_interno', direction: 'in', date: '2026-06-21T12:00:00.000Z', category: 'pago_interno', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-349', merchant: "COMPRA eDreams", amount: 265190, type: 'compra', direction: 'out', date: '2026-06-20T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-350', merchant: "COMPRA BAR CENTRAL", amount: 26257, type: 'compra', direction: 'out', date: '2026-06-20T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-351', merchant: "COMPRA UBER", amount: 22871, type: 'compra', direction: 'out', date: '2026-06-20T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-352', merchant: "COMPRA AEROP. ADOLFO SUAREZ M", amount: 44953, type: 'compra', direction: 'out', date: '2026-06-20T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-353', merchant: "COMPRA MC DONALDS NUEVO BARAJ", amount: 5052, type: 'compra', direction: 'out', date: '2026-06-20T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-354', merchant: "COMPRA Cars on Booking", amount: 50281, type: 'compra', direction: 'out', date: '2026-06-20T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-355', merchant: "COMPRA MP *CUCHILLOSMUNDOPAT", amount: 61655, type: 'compra', direction: 'out', date: '2026-06-19T12:00:00.000Z', category: 'regalos', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-356', merchant: "COMPRA WELLHUB CL", amount: 49990, type: 'compra', direction: 'out', date: '2026-06-19T12:00:00.000Z', category: 'deporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-357', merchant: "COMPRA GUACAMOLE PRESIDENTE R", amount: 6900, type: 'compra', direction: 'out', date: '2026-06-19T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-358', merchant: "DEVOLUCION COMPRA FALABELLA.COM", amount: -9990, type: 'devolucion', direction: 'in', date: '2026-06-17T12:00:00.000Z', category: 'compras_imp', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-359', merchant: "COMPRA BKG*HOTEL AT BOOKING.C", amount: 421034, type: 'compra', direction: 'out', date: '2026-06-16T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-360', merchant: "COMPRA FALABELLA.COM", amount: 89990, type: 'compra', direction: 'out', date: '2026-06-16T12:00:00.000Z', category: 'compras_imp', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-361', merchant: "COMPRA FALABELLA.COM", amount: 9990, type: 'compra', direction: 'out', date: '2026-06-16T12:00:00.000Z', category: 'compras_imp', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-362', merchant: "COMPRA DOMANI CERRO EL PLOMO", amount: 45540, type: 'compra', direction: 'out', date: '2026-06-15T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-1', merchant: "TRANSF. PARA SOLEDAD FERNA", amount: 8000, type: 'compra', direction: 'out', date: '2026-06-11T12:00:00.000Z', category: 'otras', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-2', merchant: "TRANSF. PARA MAGDALENA CAS", amount: 10000, type: 'compra', direction: 'out', date: '2026-06-11T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-3', merchant: "PAC CREDITO HIPOTECARIO", amount: 330196, type: 'compra', direction: 'out', date: '2026-06-10T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-4', merchant: "TRANSF. PARA RODRIGO CORRE", amount: 20800, type: 'compra', direction: 'out', date: '2026-06-09T12:00:00.000Z', category: 'deporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-5', merchant: "TRANSF. PARA FERNANDA GARC", amount: 8000, type: 'compra', direction: 'out', date: '2026-06-09T12:00:00.000Z', category: 'otras', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-6', merchant: "TRANSF. DE MARIA OVALLE GANA", amount: 230000, type: 'deposito', direction: 'in', date: '2026-06-08T12:00:00.000Z', category: 'sueldo', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-7', merchant: "TRANSF. PARA ALVARO MERY", amount: 30000, type: 'compra', direction: 'out', date: '2026-06-08T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-8', merchant: "COMPRA LIDER.CL COMPRA DIRECT*", amount: 73820, type: 'compra', direction: 'out', date: '2026-06-07T12:00:00.000Z', category: 'supermercado', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-9', merchant: "COMPRA CANDELARIA", amount: 25000, type: 'compra', direction: 'out', date: '2026-06-06T12:00:00.000Z', category: 'carrete', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-10', merchant: "COMPRA MERCADOPAGO *BENJAMIN", amount: 7000, type: 'compra', direction: 'out', date: '2026-06-06T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-11', merchant: "COMPRA EVENTOS KROSS", amount: 5000, type: 'compra', direction: 'out', date: '2026-06-06T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-12', merchant: "COMPRA MERCADOPAGO *MANONEGR*", amount: 12000, type: 'compra', direction: 'out', date: '2026-06-06T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-13', merchant: "COMPRA ANTHROPIC* CLAUDE SUB", amount: 22054, type: 'compra', direction: 'out', date: '2026-06-05T12:00:00.000Z', category: 'suscripciones', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-14', merchant: "TRANSF. DE MARIA OVALLE GANA", amount: 250000, type: 'deposito', direction: 'in', date: '2026-06-04T12:00:00.000Z', category: 'sueldo', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-15', merchant: "COMPRA FALABELLA.COM", amount: 479981, type: 'compra', direction: 'out', date: '2026-06-03T12:00:00.000Z', category: 'otras', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-16', merchant: "COMPRA FALABELLA.COM", amount: 44990, type: 'compra', direction: 'out', date: '2026-06-03T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-17', merchant: "COMPRA MERCADOPAGO *MOVILLAN", amount: 6555, type: 'compra', direction: 'out', date: '2026-06-03T12:00:00.000Z', category: 'otras', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-18', merchant: "COMPRA FABRICS", amount: 48085, type: 'compra', direction: 'out', date: '2026-06-03T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-19', merchant: "TRANSF. PARA ANTONIO VERGA", amount: 9885, type: 'compra', direction: 'out', date: '2026-06-03T12:00:00.000Z', category: 'carrete', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-20', merchant: "TRANSF. DE FRANCISCO JOSE RENCORET MOSQU", amount: 710000, type: 'devolucion', direction: 'in', date: '2026-06-02T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-21', merchant: "IMPUESTO COMPRA CUOTAS FALABELLA.COM", amount: 2317, type: 'compra', direction: 'out', date: '2026-06-01T12:00:00.000Z', category: 'compras_imp', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-22', merchant: "COMPRA FALABELLA.COM", amount: 584991, type: 'compra', direction: 'out', date: '2026-06-01T12:00:00.000Z', category: 'compras_imp', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-23', merchant: "COMPRA NEAT PAYER 1", amount: 1470155, type: 'compra', direction: 'out', date: '2026-06-01T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-24', merchant: "COMPRA MP *COMERCIALFHCSPA", amount: 27133, type: 'compra', direction: 'out', date: '2026-06-01T12:00:00.000Z', category: 'deporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-25', merchant: "TRANSF. PARA KHIPU CLBS C", amount: 22742, type: 'compra', direction: 'out', date: '2026-06-01T12:00:00.000Z', category: 'otras', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-26', merchant: "TRANSF. PARA COMUNIDAD EDI", amount: 500000, type: 'compra', direction: 'out', date: '2026-06-01T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-27', merchant: "TRANSF. PARA CATERINA LEYL", amount: 156000, type: 'compra', direction: 'out', date: '2026-06-01T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-28', merchant: "TRANSF. DE BENJAMIN RICHASSE SAN MARTIN", amount: 619254, type: 'devolucion', direction: 'in', date: '2026-06-01T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-29', merchant: "PAGO TARJETA CMR", amount: -1172802, type: 'pago_interno', direction: 'in', date: '2026-05-29T12:00:00.000Z', category: 'pago_interno', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-30', merchant: "COMPRA OKM NUEVA LAS CONDES", amount: 1290, type: 'compra', direction: 'out', date: '2026-05-29T12:00:00.000Z', category: 'supermercado', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-31', merchant: "COMPRA MERCADOPAGO *BLACKCHI", amount: 15378, type: 'compra', direction: 'out', date: '2026-05-29T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-32', merchant: "TRANSF PARA PAGO TARJETA CMR", amount: -1172802, type: 'pago_interno', direction: 'in', date: '2026-05-29T12:00:00.000Z', category: 'pago_interno', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-33', merchant: "TRANSF. DE DOMINGO CORREA OVALLE", amount: 119638, type: 'deposito', direction: 'in', date: '2026-05-29T12:00:00.000Z', category: 'sueldo', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-34', merchant: "TRANSF. PARA NICOLAS VAREL", amount: 5000, type: 'compra', direction: 'out', date: '2026-05-28T12:00:00.000Z', category: 'regalos', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-35', merchant: "REMUNERACIONES", amount: 3135620, type: 'deposito', direction: 'in', date: '2026-05-28T12:00:00.000Z', category: 'sueldo', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-36', merchant: "COMPRA CASILLA DEPORTES SPO", amount: 7000, type: 'compra', direction: 'out', date: '2026-05-27T12:00:00.000Z', category: 'deporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-37', merchant: "COMPRA TUU*CLUB DE GOLF SPORT", amount: 17875, type: 'compra', direction: 'out', date: '2026-05-27T12:00:00.000Z', category: 'deporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-38', merchant: "COMPRA CASILLA DEPORTES SPO", amount: 13000, type: 'compra', direction: 'out', date: '2026-05-27T12:00:00.000Z', category: 'deporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-39', merchant: "DEVOLUCION COMPRA CASILLA DEPORTES SPO", amount: -13000, type: 'devolucion', direction: 'in', date: '2026-05-27T12:00:00.000Z', category: 'deporte', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-40', merchant: "DEVOLUCION DE IMPUESTO", amount: 49962, type: 'deposito', direction: 'in', date: '2026-05-27T12:00:00.000Z', category: 'sueldo', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-41', merchant: "TRANSF. PARA NICOLAS HESKI", amount: 15000, type: 'compra', direction: 'out', date: '2026-05-26T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-42', merchant: "TRANSF. PARA JORGE SARQUIS", amount: 15000, type: 'compra', direction: 'out', date: '2026-05-26T12:00:00.000Z', category: 'carrete', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-43', merchant: "COMPRA FORK NUEVA LAS CONDES", amount: 4613, type: 'compra', direction: 'out', date: '2026-05-25T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-44', merchant: "TRANSF. PARA DOMINGO CORRE", amount: -200000, type: 'pago_interno', direction: 'in', date: '2026-05-25T12:00:00.000Z', category: 'pago_interno', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-45', merchant: "COMPRA UBER *LIME HELP.UBER.C", amount: 957, type: 'compra', direction: 'out', date: '2026-05-24T12:00:00.000Z', category: 'transporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-46', merchant: "COMPRA WWW.ALIEXPRESS.COM", amount: 38918, type: 'compra', direction: 'out', date: '2026-05-24T12:00:00.000Z', category: 'compras_imp', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-47', merchant: "COMPRA LIDER.CL", amount: 80972, type: 'compra', direction: 'out', date: '2026-05-24T12:00:00.000Z', category: 'supermercado', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-48', merchant: "COMPRA COPEC ZERVO", amount: 40000, type: 'compra', direction: 'out', date: '2026-05-24T12:00:00.000Z', category: 'transporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-49', merchant: "COMPRA IL MAESTRALE", amount: 7400, type: 'compra', direction: 'out', date: '2026-05-24T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-50', merchant: "COMPRA UBER", amount: 12701, type: 'compra', direction: 'out', date: '2026-05-24T12:00:00.000Z', category: 'transporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-51', merchant: "COMPRA MAX", amount: 14990, type: 'compra', direction: 'out', date: '2026-05-24T12:00:00.000Z', category: 'suscripciones', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-52', merchant: "DEVOLUCION COMPRA WWW.ALIEXPRESS.COM", amount: -38918, type: 'devolucion', direction: 'in', date: '2026-05-24T12:00:00.000Z', category: 'compras_imp', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-53', merchant: "COMPRA LOS COLIGUES", amount: 6870, type: 'compra', direction: 'out', date: '2026-05-23T12:00:00.000Z', category: 'supermercado', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-54', merchant: "COMPRA FALABELLA.COM", amount: 36292, type: 'compra', direction: 'out', date: '2026-05-21T12:00:00.000Z', category: 'otras', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-55', merchant: "COMPRA LIDER.CL", amount: 47070, type: 'compra', direction: 'out', date: '2026-05-19T12:00:00.000Z', category: 'supermercado', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-56', merchant: "TRANSF. PARA MARIA PAROT", amount: 8000, type: 'compra', direction: 'out', date: '2026-05-19T12:00:00.000Z', category: 'regalos', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-57', merchant: "COMPRA WELLHUB CL", amount: 49990, type: 'compra', direction: 'out', date: '2026-05-18T12:00:00.000Z', category: 'deporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-58', merchant: "COMPRA FORK NUEVA LAS CONDES", amount: 5593, type: 'compra', direction: 'out', date: '2026-05-18T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-59', merchant: "TRANSF. PARA NICOLAS LASSE", amount: 7800, type: 'compra', direction: 'out', date: '2026-05-18T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-60', merchant: "COMPRA FALABELLA", amount: 35992, type: 'compra', direction: 'out', date: '2026-05-17T12:00:00.000Z', category: 'compras_imp', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-61', merchant: "COMPRA SABA ARAUCO KENNEDY", amount: 800, type: 'compra', direction: 'out', date: '2026-05-17T12:00:00.000Z', category: 'transporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-62', merchant: "COMPRA UNIMARC LOS TRAPENSES", amount: 53110, type: 'compra', direction: 'out', date: '2026-05-16T12:00:00.000Z', category: 'carrete', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-63', merchant: "COMPRA MERCADOPAGO *SUR365SP", amount: 11700, type: 'compra', direction: 'out', date: '2026-05-16T12:00:00.000Z', category: 'supermercado', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-64', merchant: "COMPRA JUMBO MARKET LO CASTILLO", amount: 43670, type: 'compra', direction: 'out', date: '2026-05-15T12:00:00.000Z', category: 'supermercado', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-65', merchant: "TRANSF. PARA BTG PACTUAL", amount: 1500000, type: 'compra', direction: 'out', date: '2026-05-15T12:00:00.000Z', category: 'inversiones', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-66', merchant: "TRANSF. PARA BTG PACTUAL", amount: 2000000, type: 'compra', direction: 'out', date: '2026-05-15T12:00:00.000Z', category: 'inversiones', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-67', merchant: "COMPRA MERCADOPAGO *SUSHIBLU", amount: 7590, type: 'compra', direction: 'out', date: '2026-05-14T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-68', merchant: "TRANSF. PARA ASESORIAS DCV", amount: 1500000, type: 'compra', direction: 'out', date: '2026-05-14T12:00:00.000Z', category: 'inversiones', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-69', merchant: "TRANSF. PARA MATIAS BELGER", amount: 51129, type: 'compra', direction: 'out', date: '2026-05-14T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-70', merchant: "PAGO SERVIPAG SANTIAGO CHL", amount: 16729, type: 'compra', direction: 'out', date: '2026-05-14T12:00:00.000Z', category: 'transporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-71', merchant: "TRANSF. DE AREA CERO PROPIEDADES SPA", amount: 537333, type: 'deposito', direction: 'in', date: '2026-05-13T12:00:00.000Z', category: 'sueldo', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-72', merchant: "TRANSF. DE AREA CERO PROPIEDADES SPA", amount: 315000, type: 'deposito', direction: 'in', date: '2026-05-13T12:00:00.000Z', category: 'sueldo', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-73', merchant: "TRANSF. PARA DOMINGO CORRE", amount: -150000, type: 'pago_interno', direction: 'in', date: '2026-05-13T12:00:00.000Z', category: 'pago_interno', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-74', merchant: "TRANSF. PARA DOMINGO CORRE", amount: -42000, type: 'pago_interno', direction: 'in', date: '2026-05-13T12:00:00.000Z', category: 'pago_interno', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-75', merchant: "TRANSF. PARA FRANCISCO JOS", amount: 10500, type: 'compra', direction: 'out', date: '2026-05-12T12:00:00.000Z', category: 'carrete', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-76', merchant: "TRANSF. PARA ASESORIAS DCV", amount: 500000, type: 'compra', direction: 'out', date: '2026-05-12T12:00:00.000Z', category: 'inversiones', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-77', merchant: "TRANSF. DE SANTIAGO TORO VIDAL", amount: 51000, type: 'deposito', direction: 'in', date: '2026-05-11T12:00:00.000Z', category: 'sueldo', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-78', merchant: "PAC CREDITO HIPOTECARIO", amount: 251590, type: 'compra', direction: 'out', date: '2026-05-11T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-79', merchant: "TRANSF. PARA CARLOS MENA", amount: 8000, type: 'compra', direction: 'out', date: '2026-05-08T12:00:00.000Z', category: 'regalos', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-80', merchant: "REMUNERACIONES", amount: 28686, type: 'deposito', direction: 'in', date: '2026-05-08T12:00:00.000Z', category: 'sueldo', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-81', merchant: "TRANSF. PARA MAGDALENA CAS", amount: 45000, type: 'compra', direction: 'out', date: '2026-05-05T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-82', merchant: "TRANSF. DE FRANCISCO JOSE RENCORET MOSQU", amount: 716473, type: 'devolucion', direction: 'in', date: '2026-05-05T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-83', merchant: "TRANSF. PARA TOMAS LATORRE", amount: 50000, type: 'compra', direction: 'out', date: '2026-05-05T12:00:00.000Z', category: 'carrete', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-84', merchant: "TRANSF. PARA CATERINA LEYL", amount: 10000, type: 'compra', direction: 'out', date: '2026-05-04T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-85', merchant: "TRANSF. PARA CATERINA LEYL", amount: 185000, type: 'compra', direction: 'out', date: '2026-05-04T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-86', merchant: "TRANSF. DE BENJAMIN RICHASSE", amount: 626473, type: 'devolucion', direction: 'in', date: '2026-05-04T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-87', merchant: "TRANSF. PARA ENRIQUE ORTIZ", amount: 1450000, type: 'compra', direction: 'out', date: '2026-05-04T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-88', merchant: "TRANSF. PARA KHIPU CLBS C", amount: 22742, type: 'compra', direction: 'out', date: '2026-04-30T12:00:00.000Z', category: 'otras', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-89', merchant: "TRANSF. PARA FELIPE ENEROS", amount: 14587, type: 'compra', direction: 'out', date: '2026-04-30T12:00:00.000Z', category: 'carrete', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-90', merchant: "TRANSF. PARA ROMERO MARTIN", amount: 35000, type: 'compra', direction: 'out', date: '2026-04-30T12:00:00.000Z', category: 'deporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-91', merchant: "REMUNERACIONES", amount: 3154042, type: 'deposito', direction: 'in', date: '2026-04-28T12:00:00.000Z', category: 'sueldo', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-92', merchant: "TRANSF. PARA VICENTE RODRI", amount: 14770, type: 'compra', direction: 'out', date: '2026-04-27T12:00:00.000Z', category: 'regalos', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-93', merchant: "TRANSF. PARA ANDRES HUMUD", amount: 140000, type: 'compra', direction: 'out', date: '2026-04-22T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-94', merchant: "TRANSF PARA PAGO TARJETA CMR", amount: -1425300, type: 'pago_interno', direction: 'in', date: '2026-04-20T12:00:00.000Z', category: 'pago_interno', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-95', merchant: "TRANSF. DE FABIOLA YOLANDGONZALEZ", amount: 3500, type: 'deposito', direction: 'in', date: '2026-04-15T12:00:00.000Z', category: 'sueldo', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-96', merchant: "COMPRA SIROKO", amount: 73100, type: 'compra', direction: 'out', date: '2026-04-13T12:00:00.000Z', category: 'deporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-97', merchant: "PAGO SERVIPAG SANTIAGO CHL", amount: 36350, type: 'compra', direction: 'out', date: '2026-04-13T12:00:00.000Z', category: 'transporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-98', merchant: "COMPRA PAYU *ADIDAS", amount: 49990, type: 'compra', direction: 'out', date: '2026-04-12T12:00:00.000Z', category: 'deporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-99', merchant: "COMPRA SEGFALA CL SOAP", amount: 7490, type: 'compra', direction: 'out', date: '2026-04-12T12:00:00.000Z', category: 'suscripciones', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-100', merchant: "COMPRA TIP Y TAP VITACURA", amount: 59400, type: 'compra', direction: 'out', date: '2026-04-11T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-101', merchant: "COMPRA GUACAMOLE PRESIDENTE R", amount: 6900, type: 'compra', direction: 'out', date: '2026-04-10T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-102', merchant: "TRANSF. DE FABIOLA YOLANDGONZALEZ", amount: 120000, type: 'deposito', direction: 'in', date: '2026-04-10T12:00:00.000Z', category: 'sueldo', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-103', merchant: "COMPRA MERCADOPAGO *SUSHI", amount: 8790, type: 'compra', direction: 'out', date: '2026-04-09T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-104', merchant: "DEVOLUCION COMPRA TOTTUS APP", amount: -2004, type: 'devolucion', direction: 'in', date: '2026-04-07T12:00:00.000Z', category: 'supermercado', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-105', merchant: "COMPRA TOTTUS APP", amount: 39708, type: 'compra', direction: 'out', date: '2026-04-06T12:00:00.000Z', category: 'supermercado', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-106', merchant: "TRANSF. PARA SILVIA CACERE", amount: 3000, type: 'compra', direction: 'out', date: '2026-04-06T12:00:00.000Z', category: 'otras', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-107', merchant: "TRANSF. PARA FABIOLA YOLAN", amount: 10000, type: 'compra', direction: 'out', date: '2026-04-06T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-108', merchant: "COMPRA MERCADOPAGO *MARCELAL", amount: 1600, type: 'compra', direction: 'out', date: '2026-04-04T12:00:00.000Z', category: 'otras', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-109', merchant: "COMPRA REDGLOBA*MARIBEL GAMBO", amount: 2300, type: 'compra', direction: 'out', date: '2026-04-04T12:00:00.000Z', category: 'otras', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-110', merchant: "COMPRA FARMACIA CONDELL", amount: 14990, type: 'compra', direction: 'out', date: '2026-04-04T12:00:00.000Z', category: 'deporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-111', merchant: "COMPRA MARTA ELENA FUENZALI", amount: 1900, type: 'compra', direction: 'out', date: '2026-04-04T12:00:00.000Z', category: 'otras', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-112', merchant: "COMPRA MERCADOPAGO *MARCELAL", amount: 11600, type: 'compra', direction: 'out', date: '2026-04-02T12:00:00.000Z', category: 'otras', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-113', merchant: "TRANSF. DE BENJAMIN RICHASSE", amount: 636973, type: 'devolucion', direction: 'in', date: '2026-03-31T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-114', merchant: "TRANSF. DE FRANCISCO JAVIER GARCI", amount: 18000, type: 'deposito', direction: 'in', date: '2026-04-02T12:00:00.000Z', category: 'sueldo', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-115', merchant: "COMPRA FALABELLA.COM", amount: 42970, type: 'compra', direction: 'out', date: '2026-04-01T12:00:00.000Z', category: 'compras_imp', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-116', merchant: "TRANSF. PARA ROMERO MARTIN", amount: 35000, type: 'compra', direction: 'out', date: '2026-04-01T12:00:00.000Z', category: 'deporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-117', merchant: "COMPRA OTROSPAGOS COM COND", amount: 336229, type: 'compra', direction: 'out', date: '2026-03-30T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-118', merchant: "TRANSF PARA PAGO TARJETA CMR", amount: -1000236, type: 'pago_interno', direction: 'in', date: '2026-03-30T12:00:00.000Z', category: 'pago_interno', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-119', merchant: "TRANSF. DE FRANCISCO JOSE RENCORET MOSQU", amount: 112073, type: 'devolucion', direction: 'in', date: '2026-03-30T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-120', merchant: "TRANSF. DE FRANCISCO JOSE RENCORET MOSQU", amount: 78230, type: 'devolucion', direction: 'in', date: '2026-03-30T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-121', merchant: "TRANSF. DE FRANCISCO JOSE RENCORET MOSQU", amount: 536667, type: 'devolucion', direction: 'in', date: '2026-03-30T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-122', merchant: "TRANSF. PARA ENRIQUE ORTIZ", amount: 1450000, type: 'compra', direction: 'out', date: '2026-03-30T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-123', merchant: "TRANSF. PARA DIEGO BRAVO", amount: 17350, type: 'compra', direction: 'out', date: '2026-03-30T12:00:00.000Z', category: 'otras', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-124', merchant: "COMPRA SABA ARAUCO KENNEDY", amount: 1000, type: 'compra', direction: 'out', date: '2026-03-29T12:00:00.000Z', category: 'transporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-125', merchant: "COMPRA FALABELLA.COM", amount: 39912, type: 'compra', direction: 'out', date: '2026-03-29T12:00:00.000Z', category: 'compras_imp', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-126', merchant: "COMPRA LOS COLIGUES", amount: 3490, type: 'compra', direction: 'out', date: '2026-03-28T12:00:00.000Z', category: 'supermercado', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-127', merchant: "COMPRA TAYPA", amount: 90200, type: 'compra', direction: 'out', date: '2026-03-28T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-128', merchant: "COMPRA PEDIDOSYA*MARGO ISIDOR", amount: 6000, type: 'compra', direction: 'out', date: '2026-03-28T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-129', merchant: "COMPRA PATIO BELLAVISTA", amount: 6800, type: 'compra', direction: 'out', date: '2026-03-28T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-130', merchant: "PAGO TARJETA CMR", amount: -1000236, type: 'pago_interno', direction: 'in', date: '2026-03-28T12:00:00.000Z', category: 'pago_interno', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-131', merchant: "COMPRA MP *MARATHON", amount: 179992, type: 'compra', direction: 'out', date: '2026-03-27T12:00:00.000Z', category: 'deporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-132', merchant: "REMUNERACIONES", amount: 3182557, type: 'deposito', direction: 'in', date: '2026-03-27T12:00:00.000Z', category: 'sueldo', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-133', merchant: "DEVOLUCION COMPRA TOTTUS APP", amount: -20453, type: 'devolucion', direction: 'in', date: '2026-03-26T12:00:00.000Z', category: 'supermercado', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-134', merchant: "COMPRA TOTTUS APP", amount: 122108, type: 'compra', direction: 'out', date: '2026-03-25T12:00:00.000Z', category: 'supermercado', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-135', merchant: "TRANSF. PARA JUEGOSYK", amount: 35000, type: 'compra', direction: 'out', date: '2026-03-25T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-136', merchant: "REMUNERACIONES", amount: 193029, type: 'deposito', direction: 'in', date: '2026-03-25T12:00:00.000Z', category: 'sueldo', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-137', merchant: "TRANSF. PARA ENRIQUE ORTIZ", amount: 234690, type: 'compra', direction: 'out', date: '2026-03-24T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-138', merchant: "COMPRA MP *WHOOSHCLSPA", amount: 175, type: 'compra', direction: 'out', date: '2026-03-23T12:00:00.000Z', category: 'transporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-139', merchant: "COMPRA MP *WHOOSHCLSPA", amount: 3995, type: 'compra', direction: 'out', date: '2026-03-23T12:00:00.000Z', category: 'transporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-140', merchant: "TRANSF. PARA KHIPU CLBS C", amount: 18742, type: 'compra', direction: 'out', date: '2026-03-23T12:00:00.000Z', category: 'otras', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-141', merchant: "TRANSF. PARA CATERINA ACOS", amount: 39000, type: 'compra', direction: 'out', date: '2026-03-23T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-142', merchant: "COMPRA COMERCIAL Y SERVICIOS", amount: 30300, type: 'compra', direction: 'out', date: '2026-03-22T12:00:00.000Z', category: 'deporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-143', merchant: "COMPRA LOS COLIGUES", amount: 2590, type: 'compra', direction: 'out', date: '2026-03-21T12:00:00.000Z', category: 'supermercado', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-144', merchant: "COMPRA FALABELLA.COM", amount: 23984, type: 'compra', direction: 'out', date: '2026-03-21T12:00:00.000Z', category: 'compras_imp', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-145', merchant: "COMPRA VITACURA-748", amount: 9382, type: 'compra', direction: 'out', date: '2026-03-20T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-146', merchant: "COMPRA VITACURA 2", amount: 552, type: 'compra', direction: 'out', date: '2026-03-20T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-147', merchant: "COMPRA MERCADOPAGO *VENDEME", amount: 3000, type: 'compra', direction: 'out', date: '2026-03-20T12:00:00.000Z', category: 'compras_imp', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-148', merchant: "COMPRA CANDELARIA", amount: 25000, type: 'compra', direction: 'out', date: '2026-03-20T12:00:00.000Z', category: 'carrete', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-149', merchant: "COMPRA MP *WALDOSPROVI", amount: 38956, type: 'compra', direction: 'out', date: '2026-03-19T12:00:00.000Z', category: 'compras_imp', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-150', merchant: "COMPRA MERCADOPAGO *SUSHIBLU", amount: 6293, type: 'compra', direction: 'out', date: '2026-03-19T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-151', merchant: "PAGO TARJETA CMR", amount: -47691, type: 'pago_interno', direction: 'in', date: '2026-03-17T12:00:00.000Z', category: 'pago_interno', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-152', merchant: "TRANSF. PARA TERESITA RODR", amount: 14838, type: 'compra', direction: 'out', date: '2026-03-17T12:00:00.000Z', category: 'carrete', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-153', merchant: "TRANSF PARA PAGO TARJETA CMR", amount: -5000, type: 'pago_interno', direction: 'in', date: '2026-03-16T12:00:00.000Z', category: 'pago_interno', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-154', merchant: "TRANSF. PARA UNIRED", amount: 32874, type: 'compra', direction: 'out', date: '2026-03-16T12:00:00.000Z', category: 'transporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-155', merchant: "COMPRA SABA ARAUCO KENNEDY", amount: 800, type: 'compra', direction: 'out', date: '2026-03-15T12:00:00.000Z', category: 'transporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-156', merchant: "COMPRA MP *ARUEDA", amount: 100830, type: 'compra', direction: 'out', date: '2026-03-15T12:00:00.000Z', category: 'deporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-157', merchant: "COMPRA FALABELLA.COM", amount: 47691, type: 'compra', direction: 'out', date: '2026-03-15T12:00:00.000Z', category: 'compras_imp', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-158', merchant: "PAGO TARJETA CMR", amount: -5000, type: 'pago_interno', direction: 'in', date: '2026-03-14T12:00:00.000Z', category: 'pago_interno', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-159', merchant: "COMPRA ARAMCO", amount: 10080, type: 'compra', direction: 'out', date: '2026-03-14T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-160', merchant: "COMPRA LOS COLIGUES", amount: 3180, type: 'compra', direction: 'out', date: '2026-03-14T12:00:00.000Z', category: 'supermercado', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-161', merchant: "COMPRA ARAMCO", amount: 8300, type: 'compra', direction: 'out', date: '2026-03-14T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-162', merchant: "DEVOLUCION COMPRA TOTTUS APP", amount: -2726, type: 'devolucion', direction: 'in', date: '2026-03-13T12:00:00.000Z', category: 'supermercado', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-163', merchant: "COMPRA TOTTUS APP", amount: 35047, type: 'compra', direction: 'out', date: '2026-03-13T12:00:00.000Z', category: 'supermercado', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-164', merchant: "COMPRA MP *WHOOSHCLSPA", amount: 1720, type: 'compra', direction: 'out', date: '2026-03-13T12:00:00.000Z', category: 'transporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-165', merchant: "TRANSF. PARA CATERINA ACOS", amount: 39000, type: 'compra', direction: 'out', date: '2026-03-13T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-166', merchant: "COMPRA TERREX PARQUE ARAUCO", amount: 5000, type: 'compra', direction: 'out', date: '2026-03-10T12:00:00.000Z', category: 'deporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-167', merchant: "IMPUESTO COMPRA CUOTAS REDBANC ATM", amount: 119, type: 'compra', direction: 'out', date: '2026-03-09T12:00:00.000Z', category: 'otras', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-168', merchant: "TRANSF. PARA TOMAS LATORRE", amount: 55000, type: 'compra', direction: 'out', date: '2026-03-09T12:00:00.000Z', category: 'carrete', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-169', merchant: "AVANCE EN CUOTAS REDBANC ATM", amount: 30000, type: 'compra', direction: 'out', date: '2026-03-08T12:00:00.000Z', category: 'otras', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-170', merchant: "COMPRA TUU*HOT DO HOME", amount: 6590, type: 'compra', direction: 'out', date: '2026-03-08T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-171', merchant: "COMPRA MERCADOPAGO *COLIBRI", amount: 11770, type: 'compra', direction: 'out', date: '2026-03-08T12:00:00.000Z', category: 'otras', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-172', merchant: "COMPRA TOTTUS APP", amount: 53937, type: 'compra', direction: 'out', date: '2026-03-08T12:00:00.000Z', category: 'supermercado', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-173', merchant: "COMPRA SENDERO DEL SOL SPA", amount: 1800, type: 'compra', direction: 'out', date: '2026-03-07T12:00:00.000Z', category: 'deporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-174', merchant: "COMPRA JUMBO LA SERENA", amount: 12715, type: 'compra', direction: 'out', date: '2026-03-06T12:00:00.000Z', category: 'supermercado', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-175', merchant: "COMPRA MERCADOPAGO *MERCADOL", amount: 20058, type: 'compra', direction: 'out', date: '2026-03-06T12:00:00.000Z', category: 'compras_imp', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-176', merchant: "TRANSF. PARA CATERINA ACOS", amount: 39000, type: 'compra', direction: 'out', date: '2026-03-06T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-177', merchant: "TRANSF. PARA NICOLAS BOLEL", amount: 900000, type: 'compra', direction: 'out', date: '2026-03-06T12:00:00.000Z', category: 'compras_imp', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-178', merchant: "TRANSF. PARA JOAQUIN SUBIA", amount: 11000, type: 'compra', direction: 'out', date: '2026-03-05T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-179', merchant: "TRANSF. PARA ENRIQUE ORTIZ", amount: 400000, type: 'compra', direction: 'out', date: '2026-03-05T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-180', merchant: "DEVOLUCION COMPRA RAPPI", amount: -630, type: 'devolucion', direction: 'in', date: '2026-03-03T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-181', merchant: "TRANSF. PARA ENRIQUE ORTIZ", amount: 1000000, type: 'compra', direction: 'out', date: '2026-03-03T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-182', merchant: "COMPRA RAPPI", amount: 9622, type: 'compra', direction: 'out', date: '2026-03-02T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-183', merchant: "COMPRA RAPPI", amount: 3050, type: 'compra', direction: 'out', date: '2026-03-02T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-184', merchant: "COMPRA RAPPI", amount: 4000, type: 'compra', direction: 'out', date: '2026-03-02T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-185', merchant: "COMPRA LOS TRONCOS", amount: 50000, type: 'compra', direction: 'out', date: '2026-03-01T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-186', merchant: "COMPRA DULCE MAR SPA", amount: 1590, type: 'compra', direction: 'out', date: '2026-03-01T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-187', merchant: "COMPRA TICKETPLUS IM30", amount: 8000, type: 'compra', direction: 'out', date: '2026-03-01T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-188', merchant: "COMPRA MP *SIMPLEPARK", amount: 1400, type: 'compra', direction: 'out', date: '2026-02-28T12:00:00.000Z', category: 'transporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-189', merchant: "COMPRA INVERSIONES SOL CARI", amount: 1300, type: 'compra', direction: 'out', date: '2026-02-28T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-190', merchant: "COMPRA TUU*PLAYA FARO", amount: 2500, type: 'compra', direction: 'out', date: '2026-02-28T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-191', merchant: "COMPRA MERCADOPAGO *SOCIEDAD", amount: 20000, type: 'compra', direction: 'out', date: '2026-02-27T12:00:00.000Z', category: 'otras', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-192', merchant: "TRANSF. DE BENJAMIN RICHASSE SAN MARTIN", amount: 542817, type: 'devolucion', direction: 'in', date: '2026-03-27T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-193', merchant: "COMPRA OTROSPAGOS COM COND", amount: 338462, type: 'compra', direction: 'out', date: '2026-02-26T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-194', merchant: "COMPRA TOTTUS APP", amount: 25500, type: 'compra', direction: 'out', date: '2026-02-26T12:00:00.000Z', category: 'supermercado', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-195', merchant: "PAGO TARJETA CMR", amount: -500000, type: 'pago_interno', direction: 'in', date: '2026-02-26T12:00:00.000Z', category: 'pago_interno', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-196', merchant: "TRANSF PARA PAGO TARJETA CMR", amount: -1311446, type: 'pago_interno', direction: 'in', date: '2026-02-26T12:00:00.000Z', category: 'pago_interno', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-197', merchant: "REMUNERACIONES", amount: 2920285, type: 'deposito', direction: 'in', date: '2026-02-26T12:00:00.000Z', category: 'sueldo', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-198', merchant: "TRANSF PARA PAGO TARJETA CMR", amount: -500000, type: 'pago_interno', direction: 'in', date: '2026-02-26T12:00:00.000Z', category: 'pago_interno', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-199', merchant: "TRANSF. PARA BTG PACTUAL", amount: 1500000, type: 'compra', direction: 'out', date: '2026-02-26T12:00:00.000Z', category: 'inversiones', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-200', merchant: "PAGO TARJETA CMR", amount: -1311446, type: 'pago_interno', direction: 'in', date: '2026-02-25T12:00:00.000Z', category: 'pago_interno', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-201', merchant: "TRANSF. DE FRANCISCO JOSE RENCORET MOSQU", amount: 632817, type: 'devolucion', direction: 'in', date: '2026-03-25T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-202', merchant: "COMPRA MERCADOPAGO *FURO", amount: 51084, type: 'compra', direction: 'out', date: '2026-02-24T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-203', merchant: "COMPRA FALABELLA.COM", amount: 25640, type: 'compra', direction: 'out', date: '2026-02-23T12:00:00.000Z', category: 'compras_imp', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-204', merchant: "PAGO TARJETA CMR", amount: -25640, type: 'pago_interno', direction: 'in', date: '2026-02-23T12:00:00.000Z', category: 'pago_interno', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-205', merchant: "TRANSF. PARA CATERINE ACOS", amount: 39000, type: 'compra', direction: 'out', date: '2026-02-23T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-206', merchant: "TRANSF. PARA MARIA TRINIDA", amount: 20000, type: 'compra', direction: 'out', date: '2026-02-23T12:00:00.000Z', category: 'carrete', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-207', merchant: "COMPRA SHELL EP140 PATAGONIA", amount: 40000, type: 'compra', direction: 'out', date: '2026-02-22T12:00:00.000Z', category: 'transporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-208', merchant: "COMPRA JUMBO LOS TRAPENSES", amount: 56810, type: 'compra', direction: 'out', date: '2026-02-22T12:00:00.000Z', category: 'supermercado', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-209', merchant: "COMPRA LOS COLIGUES", amount: 1990, type: 'compra', direction: 'out', date: '2026-02-21T12:00:00.000Z', category: 'supermercado', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-210', merchant: "COMPRA CCU", amount: 1800, type: 'compra', direction: 'out', date: '2026-02-20T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-211', merchant: "COMPRA VIDA PARQUE", amount: 6400, type: 'compra', direction: 'out', date: '2026-02-20T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-212', merchant: "COMPRA MERCADOPAGO *CANTABRI", amount: 14460, type: 'compra', direction: 'out', date: '2026-02-20T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-213', merchant: "COMPRA LA VICENTINA", amount: 14080, type: 'compra', direction: 'out', date: '2026-02-20T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-214', merchant: "COMPRA CCU", amount: 1200, type: 'compra', direction: 'out', date: '2026-02-20T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-215', merchant: "REMUNERACIONES", amount: 7578404, type: 'deposito', direction: 'in', date: '2026-02-20T12:00:00.000Z', category: 'sueldo', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-216', merchant: "TRANSF. PARA BTG PACTUAL", amount: 6000000, type: 'compra', direction: 'out', date: '2026-02-20T12:00:00.000Z', category: 'inversiones', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-217', merchant: "COMPRA FORK NUEVA LAS CONDES", amount: 6743, type: 'compra', direction: 'out', date: '2026-02-19T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-218', merchant: "COMPRA TRAVEL TIENDA M", amount: 364780, type: 'compra', direction: 'out', date: '2026-02-18T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-219', merchant: "COMPRA THFIT PLAYA", amount: 28000, type: 'compra', direction: 'out', date: '2026-02-18T12:00:00.000Z', category: 'deporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-220', merchant: "COMPRA FALABELLA", amount: 209990, type: 'compra', direction: 'out', date: '2026-02-18T12:00:00.000Z', category: 'compras_imp', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-221', merchant: "PAGO TARJETA CMR", amount: -300000, type: 'pago_interno', direction: 'in', date: '2026-02-18T12:00:00.000Z', category: 'pago_interno', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-222', merchant: "TRANSF PARA PAGO TARJETA CMR", amount: -300000, type: 'pago_interno', direction: 'in', date: '2026-02-18T12:00:00.000Z', category: 'pago_interno', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-223', merchant: "TRANSF. DE MARTINA DIUANA", amount: 210000, type: 'deposito', direction: 'in', date: '2026-02-18T12:00:00.000Z', category: 'sueldo', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-224', merchant: "COMPRA SALCOBRAND 559", amount: 9696, type: 'compra', direction: 'out', date: '2026-02-17T12:00:00.000Z', category: 'deporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-225', merchant: "TRANSF. PARA KHIPU CLBS C", amount: 18742, type: 'compra', direction: 'out', date: '2026-02-17T12:00:00.000Z', category: 'otras', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-226', merchant: "PAGO SERVIPAG SANTIAGO CHL", amount: 34085, type: 'compra', direction: 'out', date: '2026-02-17T12:00:00.000Z', category: 'transporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-227', merchant: "COMPRA FLOW *FINISHER.CL", amount: 16181, type: 'compra', direction: 'out', date: '2026-02-16T12:00:00.000Z', category: 'deporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-228', merchant: "TRANSF. PARA ROMERO MARTIN", amount: 35000, type: 'compra', direction: 'out', date: '2026-02-16T12:00:00.000Z', category: 'deporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-229', merchant: "TRANSF. PARA JOSE ANTON", amount: 10000, type: 'compra', direction: 'out', date: '2026-02-16T12:00:00.000Z', category: 'otras', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-230', merchant: "COMPRA MP *CARVUK", amount: 17990, type: 'compra', direction: 'out', date: '2026-02-15T12:00:00.000Z', category: 'transporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-231', merchant: "COMPRA MP *SIMPLEPARK", amount: 800, type: 'compra', direction: 'out', date: '2026-02-15T12:00:00.000Z', category: 'transporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-232', merchant: "COMPRA TICKETPLUS IM30", amount: 16000, type: 'compra', direction: 'out', date: '2026-02-15T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-233', merchant: "COMPRA TOTTUS APP", amount: 71674, type: 'compra', direction: 'out', date: '2026-02-15T12:00:00.000Z', category: 'supermercado', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-234', merchant: "DEVOLUCION COMPRA TOTTUS APP", amount: -5594, type: 'devolucion', direction: 'in', date: '2026-02-15T12:00:00.000Z', category: 'supermercado', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-235', merchant: "COMPRA MERCADOPAGO *JORGEHUG", amount: 1800, type: 'compra', direction: 'out', date: '2026-02-14T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-236', merchant: "DEVOLUCION COMPRA MERPAGO*SIMPLEPARK", amount: -50, type: 'devolucion', direction: 'in', date: '2026-02-14T12:00:00.000Z', category: 'transporte', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-237', merchant: "COMPRA JUMBO MAITENCILLO", amount: 3790, type: 'compra', direction: 'out', date: '2026-02-14T12:00:00.000Z', category: 'supermercado', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-238', merchant: "COMPRA MERPAGO*SIMPLEPARK", amount: 1600, type: 'compra', direction: 'out', date: '2026-02-14T12:00:00.000Z', category: 'transporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-239', merchant: "COMPRA MERPAGO*SIMPLEPARK", amount: 50, type: 'compra', direction: 'out', date: '2026-02-14T12:00:00.000Z', category: 'transporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-240', merchant: "COMPRA MUEVO COPEC", amount: 40000, type: 'compra', direction: 'out', date: '2026-02-13T12:00:00.000Z', category: 'transporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-241', merchant: "COMPRA CAFE AYEN", amount: 23200, type: 'compra', direction: 'out', date: '2026-02-13T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-242', merchant: "COMPRA GUACAMOLE PRESIDENTE R", amount: 6900, type: 'compra', direction: 'out', date: '2026-02-13T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-243', merchant: "COMPRA FORK NUEVA LAS CONDES", amount: 2303, type: 'compra', direction: 'out', date: '2026-02-12T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-244', merchant: "COMPRA SB 794", amount: 16040, type: 'compra', direction: 'out', date: '2026-02-11T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-245', merchant: "COMPRA MP *GOLDPLANSPA", amount: 37373, type: 'compra', direction: 'out', date: '2026-02-09T12:00:00.000Z', category: 'deporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-246', merchant: "COMPRA REDGLOBA*CARNICERIA Y", amount: 33230, type: 'compra', direction: 'out', date: '2026-02-07T12:00:00.000Z', category: 'supermercado', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-247', merchant: "COMPRA GUACAMOLE PRESIDENTE R", amount: 6900, type: 'compra', direction: 'out', date: '2026-02-06T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-248', merchant: "TRANSF. DE NICOLAS PUMPIN DEL REAL", amount: 88000, type: 'deposito', direction: 'in', date: '2026-02-06T12:00:00.000Z', category: 'sueldo', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-249', merchant: "COMPRA MERCADOPAGO *MITBURGE", amount: 112013, type: 'compra', direction: 'out', date: '2026-02-04T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-250', merchant: "COMPRA MP *CARVUK", amount: 173742, type: 'compra', direction: 'out', date: '2026-02-04T12:00:00.000Z', category: 'transporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-251', merchant: "TRANSF. DE RODRIGO CORREA", amount: 14300, type: 'deposito', direction: 'in', date: '2026-02-04T12:00:00.000Z', category: 'sueldo', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-252', merchant: "TRANSF. PARA BTG PACTUAL", amount: 500000, type: 'compra', direction: 'out', date: '2026-02-03T12:00:00.000Z', category: 'inversiones', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-253', merchant: "COMPRA FORK NUEVA LAS CONDES", amount: 7336, type: 'compra', direction: 'out', date: '2026-02-02T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-254', merchant: "COMPRA TOTTUS APP", amount: 76075, type: 'compra', direction: 'out', date: '2026-02-02T12:00:00.000Z', category: 'supermercado', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-255', merchant: "DEVOLUCION COMPRA TOTTUS APP", amount: -2464, type: 'devolucion', direction: 'in', date: '2026-02-02T12:00:00.000Z', category: 'supermercado', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-256', merchant: "TRANSF. DE BENJAMIN RICHASSE", amount: 546285, type: 'devolucion', direction: 'in', date: '2026-03-02T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-257', merchant: "TRANSF. PARA MAURICIO GOME", amount: 3000, type: 'compra', direction: 'out', date: '2026-02-02T12:00:00.000Z', category: 'otras', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-258', merchant: "COMPRA SUMUP * EL ROQUIN", amount: 2000, type: 'compra', direction: 'out', date: '2026-02-01T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-259', merchant: "COMPRA MASSALUD LICAN", amount: 1950, type: 'compra', direction: 'out', date: '2026-01-30T12:00:00.000Z', category: 'deporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-260', merchant: "COMPRA OTROSPAGOS COM COND", amount: 348866, type: 'compra', direction: 'out', date: '2026-01-29T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-261', merchant: "REMUNERACIONES", amount: 3141249, type: 'deposito', direction: 'in', date: '2026-01-29T12:00:00.000Z', category: 'sueldo', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-262', merchant: "TRANSF. PARA BTG PACTUAL", amount: 1300000, type: 'compra', direction: 'out', date: '2026-01-29T12:00:00.000Z', category: 'inversiones', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-263', merchant: "TRANSF. PARA FRANCISCO NAV", amount: 14418, type: 'compra', direction: 'out', date: '2026-01-27T12:00:00.000Z', category: 'carrete', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-264', merchant: "TRANSF PARA PAGO TARJETA CMR", amount: -1486130, type: 'pago_interno', direction: 'in', date: '2026-01-23T12:00:00.000Z', category: 'pago_interno', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-265', merchant: "TRANSF. DE FRANCISCO JOSE RENCORET MOSQU", amount: 520000, type: 'devolucion', direction: 'in', date: '2026-01-23T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-266', merchant: "COMPRA FORK NUEVA LAS CONDES", amount: 5993, type: 'compra', direction: 'out', date: '2026-01-22T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-267', merchant: "COMPRA NOTARIA MANRIQUEZ", amount: 220000, type: 'compra', direction: 'out', date: '2026-01-22T12:00:00.000Z', category: 'inversiones', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-268', merchant: "PAGO TARJETA CMR", amount: -1486130, type: 'pago_interno', direction: 'in', date: '2026-01-22T12:00:00.000Z', category: 'pago_interno', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-269', merchant: "COMPRA FALABELLA.COM", amount: 41982, type: 'compra', direction: 'out', date: '2026-01-21T12:00:00.000Z', category: 'compras_imp', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-270', merchant: "TRANSF. DE FRANCISCO JAVIER GARCI", amount: 100010, type: 'deposito', direction: 'in', date: '2026-01-20T12:00:00.000Z', category: 'sueldo', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-271', merchant: "COMPRA OKM NUEVA LAS CONDES", amount: 1290, type: 'compra', direction: 'out', date: '2026-01-19T12:00:00.000Z', category: 'supermercado', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-272', merchant: "COMPRA VENTIPAYCOM", amount: 73760, type: 'compra', direction: 'out', date: '2026-01-19T12:00:00.000Z', category: 'carrete', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-273', merchant: "COMPRA PRONTO LOS TRAPENSES", amount: 3690, type: 'compra', direction: 'out', date: '2026-01-18T12:00:00.000Z', category: 'transporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-274', merchant: "COMPRA MP *CHARGEFIXSPA", amount: 2250, type: 'compra', direction: 'out', date: '2026-01-17T12:00:00.000Z', category: 'carrete', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-275', merchant: "COMPRA MP *CHARGEFIXSPA", amount: 3000, type: 'compra', direction: 'out', date: '2026-01-17T12:00:00.000Z', category: 'carrete', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-276', merchant: "COMPRA MERCADOPAGO *COMEDYRE", amount: 61050, type: 'compra', direction: 'out', date: '2026-01-17T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-277', merchant: "COMPRA MERCADOPAGO *JETSET", amount: 85305, type: 'compra', direction: 'out', date: '2026-01-17T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-278', merchant: "COMPRA ROYAL BAR PROVIDENCIA", amount: 87868, type: 'compra', direction: 'out', date: '2026-01-17T12:00:00.000Z', category: 'carrete', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-279', merchant: "COMPRA VITACURA-748", amount: 23606, type: 'compra', direction: 'out', date: '2026-01-17T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-280', merchant: "COMPRA GASTRONOMIA ITALIA SPA", amount: 31845, type: 'compra', direction: 'out', date: '2026-01-17T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-281', merchant: "COMPRA HAULMER*COMEDYPASS", amount: 36000, type: 'compra', direction: 'out', date: '2026-01-17T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-282', merchant: "COMPRA GELATERIA FIRENZE", amount: 13400, type: 'compra', direction: 'out', date: '2026-01-17T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-283', merchant: "COMPRA GALPON ITALIA", amount: 48719, type: 'compra', direction: 'out', date: '2026-01-17T12:00:00.000Z', category: 'carrete', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-284', merchant: "COMPRA GUACAMOLE PRESIDENTE R", amount: 12000, type: 'compra', direction: 'out', date: '2026-01-16T12:00:00.000Z', category: 'restaurantes', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-285', merchant: "COMPRA OKM NUEVA LAS CONDES", amount: 2580, type: 'compra', direction: 'out', date: '2026-01-16T12:00:00.000Z', category: 'supermercado', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-286', merchant: "TRANSF. PARA CATERINE ACOS", amount: 39000, type: 'compra', direction: 'out', date: '2026-01-16T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-287', merchant: "COMPRA FALABELLA.COM", amount: 2930, type: 'compra', direction: 'out', date: '2026-01-15T12:00:00.000Z', category: 'compras_imp', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-288', merchant: "TRANSF. PARA ROMERO MARTIN", amount: 35000, type: 'compra', direction: 'out', date: '2026-01-15T12:00:00.000Z', category: 'deporte', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-289', merchant: "TRANSF. PARA KHIPU CLBS C", amount: 18742, type: 'compra', direction: 'out', date: '2026-01-14T12:00:00.000Z', category: 'otras', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-290', merchant: "TRANSF. DE FRANCISCO JOSE RENCORET MOSQU", amount: 250000, type: 'devolucion', direction: 'in', date: '2026-01-05T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-291', merchant: "TRANSF. PARA AGUSTIN SANTA", amount: 46053, type: 'compra', direction: 'out', date: '2026-01-05T12:00:00.000Z', category: 'entretenim', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-292', merchant: "TRANSF. DE BENJAMIN RICHASSE", amount: 200000, type: 'devolucion', direction: 'in', date: '2026-01-02T12:00:00.000Z', category: 'departamento', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-293', merchant: "TRANSF. DE FLORENCIA ALMENDRA PIZ", amount: 15190, type: 'deposito', direction: 'in', date: '2026-01-02T12:00:00.000Z', category: 'sueldo', aiConfident: true, aiSource: 'income', split: null },
    { id: 'import-294', merchant: "CARGO INTERES LC CTA CTE", amount: 5, type: 'compra', direction: 'out', date: '2026-01-02T12:00:00.000Z', category: 'otras', aiConfident: true, aiSource: 'local', split: null },
    { id: 'import-295', merchant: "IMPUESTO DL 3475", amount: 1, type: 'compra', direction: 'out', date: '2026-01-02T12:00:00.000Z', category: 'otras', aiConfident: true, aiSource: 'local', split: null },
  ];
  return txs;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [transactions,   setTransactions]   = useState<Transaction[]>([]);
  const [merchantMemory, setMerchantMemory] = useState<MerchantMemory>({});
  const [apiKey,         setApiKeyState]    = useState('');
  const [isLoading,      setIsLoading]      = useState(true);
  const [budgets,        setBudgets]        = useState<Budgets>({});
  const [dismissedMoves, setDismissedMoves] = useState<string[]>([]);

  const apiKeyRef = useRef(apiKey);
  useEffect(() => { apiKeyRef.current = apiKey; }, [apiKey]);

  // Refs para acceder al estado actual dentro de callbacks estables
  const transactionsRef = useRef(transactions);
  useEffect(() => { transactionsRef.current = transactions; }, [transactions]);
  const budgetsRef = useRef(budgets);
  useEffect(() => { budgetsRef.current = budgets; }, [budgets]);

  // Cargar datos persistidos al inicio; cargar muestra si está vacío
  useEffect(() => {
    Promise.all([
      Storage.getTransactions(),
      Storage.getMerchantMemory(),
      Storage.getApiKey(),
      Storage.getBudgets(),
      Storage.getDismissedMoves(),
    ]).then(([txs, mem, key, savedBudgets, dismissed]) => {
      const initial = txs.length === 0 ? buildSampleData() : txs;
      if (txs.length === 0) Storage.saveTransactions(initial);
      setTransactions(initial);
      setMerchantMemory(mem);
      setApiKeyState(key);
      setDismissedMoves(dismissed);
      // Primera vez sin presupuestos → sugerir del promedio histórico
      if (savedBudgets === null) {
        const suggested = suggestBudgets(initial);
        setBudgets(suggested);
        Storage.saveBudgets(suggested);
      } else {
        setBudgets(savedBudgets);
      }
      setIsLoading(false);
    });
  }, []);

  const setApiKey = useCallback(async (key: string) => {
    setApiKeyState(key);
    await Storage.saveApiKey(key);
  }, []);

  const addTransaction = useCallback(async (params: AddTransactionParams) => {
    const { merchant, amount, type, direction, split, rawText, date } = params;

    // Dedupe (solo transacciones de notificaciones): mismo comercio + monto
    // + dirección dentro de una ventana de 3 minutos → descartar silencioso
    if (rawText) {
      const txTime = new Date(date ?? Date.now()).getTime();
      const ml = merchant.toLowerCase();
      const isDup = transactionsRef.current.some(t =>
        t.direction === direction &&
        t.amount === amount &&
        t.merchant.toLowerCase() === ml &&
        Math.abs(new Date(t.date).getTime() - txTime) < 3 * 60 * 1000
      );
      if (isDup) return;
    }

    const splitInfo = (split && direction === 'out')
      ? {
          totalPeople: split.totalPeople,
          myShare:     Math.round(amount / split.totalPeople),
          recovered:   split.recovered,
          description: split.description,
        }
      : null;

    // Reembolsos conocidos: transferencias recibidas que reducen un gasto
    // (ej. aportes al arriendo de Rencoret/Richasse) en vez de ser ingreso
    let refundCategory: string | null = null;
    if (direction === 'in') {
      const ml = merchant.toLowerCase();
      for (const [key, cat] of Object.entries(INCOME_REFUND_MAP)) {
        if (ml.includes(key)) { refundCategory = cat; break; }
      }
    }
    const finalType = refundCategory ? 'devolucion' : type;

    const { category, confident, source } = refundCategory
      ? { category: refundCategory, confident: true, source: 'local' as const }
      : await categorizeTransaction(
          merchant, amount, type, direction, merchantMemory, apiKeyRef.current
        );

    const newTx: Transaction = {
      id:          `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      merchant,
      amount,
      type:        finalType,
      direction,
      date:        date ?? new Date().toISOString(),
      category:    category as any ?? null,
      aiConfident: confident,
      aiSource:    source as any,
      split:       splitInfo,
      rawNotificationText: rawText,
    };

    if (category && direction === 'out' && source !== 'fallback') {
      // Forma funcional: evita perder actualizaciones si llegan 2 notifs casi juntas
      setMerchantMemory(prev => {
        const updated: MerchantMemory = { ...prev, [merchant.toLowerCase()]: category as any };
        Storage.saveMerchantMemory(updated);
        return updated;
      });
    }

    setTransactions(prev => {
      const updated = [newTx, ...prev];
      Storage.saveTransactions(updated);
      return updated;
    });

    await showLocalConfirmation(merchant, amount, category, newTx.id);

    // Alerta de presupuesto: avisar al cruzar el 80% y el 100%
    if (direction === 'out' && category) {
      const budget = budgetsRef.current[category as string];
      if (budget && budget > 0) {
        const d = new Date(newTx.date);
        const before = categoryMonthTotal(
          transactionsRef.current, category as string, d.getFullYear(), d.getMonth()
        );
        const after   = before + Math.abs(amount);
        const catInfo = CATEGORIES.find(c => c.id === category);
        const label   = catInfo ? `${catInfo.icon} ${catInfo.label}` : category;
        if (before < budget && after >= budget) {
          await showBudgetAlert(
            '🚨 Presupuesto superado',
            `${label}: llevas $${after.toLocaleString('es-CL')} de $${budget.toLocaleString('es-CL')} este mes.`
          );
        } else if (before < budget * 0.8 && after >= budget * 0.8) {
          await showBudgetAlert(
            '⚠️ Cerca del límite',
            `${label}: llevas ${Math.round((after / budget) * 100)}% del presupuesto ($${after.toLocaleString('es-CL')} de $${budget.toLocaleString('es-CL')}).`
          );
        }
      }
    }
  }, [merchantMemory]);

  const categorize = useCallback(async (txId: string, categoryId: string) => {
    const tx = transactions.find(t => t.id === txId);
    if (!tx) return;

    setMerchantMemory(prev => {
      const updated: MerchantMemory = { ...prev, [tx.merchant.toLowerCase()]: categoryId as any };
      Storage.saveMerchantMemory(updated);
      return updated;
    });

    const updatedTxs = transactions.map(t =>
      t.id === txId
        ? { ...t, category: categoryId as any, aiConfident: false, aiSource: 'manual' as any }
        : t
    );
    setTransactions(updatedTxs);
    await Storage.saveTransactions(updatedTxs);
  }, [transactions, merchantMemory]);

  const deleteTransaction = useCallback(async (txId: string) => {
    setTransactions(prev => {
      const updated = prev.filter(t => t.id !== txId);
      Storage.saveTransactions(updated);
      return updated;
    });
  }, []);

  /**
   * Mueve una transacción a otro mes/año conservando el mismo día.
   * Útil para reasignar sueldo o arriendo al mes correcto.
   */
  const moveTransaction = useCallback(async (txId: string, newYear: number, newMonth: number) => {
    setTransactions(prev => {
      const updated = prev.map(t => {
        if (t.id !== txId) return t;
        const original = new Date(t.date);
        // Mantiene el mismo día; si el nuevo mes tiene menos días, clampea al último día
        const day = Math.min(
          original.getDate(),
          new Date(newYear, newMonth, 0).getDate() // día 0 del mes siguiente = último día del mes
        );
        const newDate = new Date(newYear, newMonth - 1, day, original.getHours(), original.getMinutes());
        return { ...t, date: newDate.toISOString() };
      });
      Storage.saveTransactions(updated);
      return updated;
    });
  }, []);

  /** Edita nombre de comercio y/o categoría de una transacción existente */
  const updateTransaction = useCallback(async (
    txId: string,
    changes: { merchant?: string; category?: string }
  ) => {
    const newMerchant = changes.merchant?.trim();
    setTransactions(prev => {
      const updated = prev.map(t => {
        if (t.id !== txId) return t;
        return {
          ...t,
          merchant: newMerchant || t.merchant,
          ...(changes.category !== undefined
            ? { category: changes.category as any, aiConfident: false, aiSource: 'manual' as any }
            : {}),
        };
      });
      Storage.saveTransactions(updated);
      return updated;
    });

    // Si cambió la categoría, recordar el comercio para futuras compras
    if (changes.category) {
      const merchantName = newMerchant
        ?? transactionsRef.current.find(t => t.id === txId)?.merchant
        ?? '';
      if (merchantName.trim()) {
        setMerchantMemory(prev => {
          const updated: MerchantMemory = {
            ...prev, [merchantName.trim().toLowerCase()]: changes.category as any,
          };
          Storage.saveMerchantMemory(updated);
          return updated;
        });
      }
    }
  }, []);

  const setBudget = useCallback(async (categoryId: string, amount: number) => {
    setBudgets(prev => {
      const updated = { ...prev };
      if (amount > 0) updated[categoryId] = amount;
      else            delete updated[categoryId];
      Storage.saveBudgets(updated);
      return updated;
    });
  }, []);

  const dismissMoveSuggestion = useCallback(async (txId: string) => {
    setDismissedMoves(prev => {
      const updated = prev.includes(txId) ? prev : [...prev, txId];
      Storage.saveDismissedMoves(updated);
      return updated;
    });
  }, []);

  const clearData = useCallback(async () => {
    // Recargar los datos de muestra inmediatamente (sin esperar reinicio de la app)
    const fresh = buildSampleData();
    setTransactions(fresh);
    setMerchantMemory({});
    await Storage.clearAll();
    await Storage.saveTransactions(fresh);
  }, []);

  const { requestPermission } = useNotificationListener(
    useCallback(async (notif: FalabellaNotification) => {
      const parsed = parseNotification(notif.title, notif.text);
      if (!parsed) return;
      await addTransaction({
        merchant:  parsed.merchant,
        amount:    parsed.amount,
        type:      parsed.type,
        direction: parsed.direction,
        rawText:   parsed.rawText,
        // Usar la hora real de la notificación (importante si venía encolada)
        date:      notif.timestamp ? new Date(notif.timestamp).toISOString() : undefined,
      });
    }, [addTransaction])
  );

  const pendingCount = transactions.filter(
    t => t.direction === 'out' && t.category === null
  ).length;

  return (
    <AppContext.Provider value={{
      transactions, merchantMemory, apiKey, pendingCount, isLoading,
      budgets, dismissedMoves,
      setApiKey, addTransaction, categorize, deleteTransaction, moveTransaction,
      updateTransaction, setBudget, dismissMoveSuggestion, clearData,
      requestNotificationPermission: requestPermission,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp debe usarse dentro de AppProvider');
  return ctx;
}

async function showBudgetAlert(title: string, body: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null,
    });
  } catch {
    // No es crítico si falla la notificación local
  }
}

async function showLocalConfirmation(
  merchant: string,
  amount: number,
  category: string | null,
  txId: string
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: category ? '✓ Gasto registrado' : '⚠️ Categorizar gasto',
        body: category
          ? `${merchant} → $${amount.toLocaleString('es-CL')} en ${category}`
          : `$${amount.toLocaleString('es-CL')} en ${merchant} — Toca para categorizar`,
        data: { txId },
      },
      trigger: null,
    });
  } catch {
    // No es crítico si falla la notificación local
  }
}
