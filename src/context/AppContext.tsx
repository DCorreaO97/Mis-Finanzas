import React, {
  createContext, useContext, useState, useEffect, useCallback, useRef
} from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Transaction, MerchantMemory } from '../types';
import { Storage } from '../storage';
import { parseNotification } from '../utils/parseNotification';
import { categorizeTransaction } from '../utils/categorizeWithAI';
import { useNotificationListener, FalabellaNotification } from '../hooks/useNotificationListener';

interface AppContextValue {
  transactions:    Transaction[];
  merchantMemory:  MerchantMemory;
  apiKey:          string;
  pendingCount:    number;
  isLoading:       boolean;
  setApiKey:       (key: string) => Promise<void>;
  addTransaction:  (params: AddTransactionParams) => Promise<void>;
  categorize:      (txId: string, categoryId: string) => Promise<void>;
  deleteTransaction: (txId: string) => Promise<void>;
  moveTransaction: (txId: string, newYear: number, newMonth: number) => Promise<void>;
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
}

const AppContext = createContext<AppContextValue | null>(null);

function buildSampleData(): Transaction[] {
  function d(year: number, month: number, day: number): string {
    return new Date(year, month - 1, day, 12, 0, 0).toISOString();
  }

  const txs: Transaction[] = [
    { id: 'import-1',  merchant: 'LIDER.CL',                 amount: 73820,    type: 'compra',       direction: 'out', date: d(2026,6,6),  category: 'supermercado', aiConfident: true,  aiSource: 'local',  split: null },
    { id: 'import-2',  merchant: 'MERCADOPAGO',              amount: 12000,    type: 'compra',       direction: 'out', date: d(2026,6,5),  category: null,           aiConfident: false, aiSource: null,     split: null },
    { id: 'import-3',  merchant: 'EVENTOS KROSS',            amount: 5000,     type: 'compra',       direction: 'out', date: d(2026,6,5),  category: 'carrete',      aiConfident: true,  aiSource: 'local',  split: null },
    { id: 'import-4',  merchant: 'MERCADOPAGO',              amount: 7000,     type: 'compra',       direction: 'out', date: d(2026,6,5),  category: null,           aiConfident: false, aiSource: null,     split: null },
    { id: 'import-5',  merchant: 'CANDELARIA',               amount: 25000,    type: 'compra',       direction: 'out', date: d(2026,6,5),  category: 'restaurantes', aiConfident: true,  aiSource: 'local',  split: null },
    { id: 'import-6',  merchant: 'ANTHROPIC CLAUDE',         amount: 22054,    type: 'compra',       direction: 'out', date: d(2026,6,4),  category: null,           aiConfident: false, aiSource: null,     split: null },
    { id: 'import-7',  merchant: 'FABRICS',                  amount: 48085,    type: 'compra',       direction: 'out', date: d(2026,6,2),  category: 'ropa',         aiConfident: true,  aiSource: 'local',  split: null },
    { id: 'import-8',  merchant: 'MERCADOPAGO',              amount: 6555,     type: 'compra',       direction: 'out', date: d(2026,6,2),  category: null,           aiConfident: false, aiSource: null,     split: null },
    { id: 'import-9',  merchant: 'FALABELLA.COM',            amount: 44990,    type: 'compra',       direction: 'out', date: d(2026,6,2),  category: 'ropa',         aiConfident: true,  aiSource: 'local',  split: null },
    { id: 'import-10', merchant: 'FALABELLA.COM',            amount: 479981,   type: 'compra',       direction: 'out', date: d(2026,6,2),  category: 'ropa',         aiConfident: true,  aiSource: 'local',  split: null },
    { id: 'import-11', merchant: 'MP COMERCIALFHC',          amount: 27133,    type: 'compra',       direction: 'out', date: d(2026,5,31), category: null,           aiConfident: false, aiSource: null,     split: null },
    { id: 'import-12', merchant: 'NEAT PAYER',               amount: 1470155,  type: 'compra',       direction: 'out', date: d(2026,5,31), category: 'departamento', aiConfident: true,  aiSource: 'local',  split: null },
    { id: 'import-13', merchant: 'FALABELLA.COM',            amount: 584991,   type: 'compra',       direction: 'out', date: d(2026,5,31), category: 'ropa',         aiConfident: true,  aiSource: 'local',  split: null },
    { id: 'import-14', merchant: 'IMPUESTO FALABELLA',       amount: 2317,     type: 'compra',       direction: 'out', date: d(2026,5,31), category: null,           aiConfident: false, aiSource: null,     split: null },
    { id: 'import-15', merchant: 'MERCADOPAGO',              amount: 15378,    type: 'compra',       direction: 'out', date: d(2026,5,28), category: null,           aiConfident: false, aiSource: null,     split: null },
    { id: 'import-16', merchant: 'OKM NUEVA LAS CONDES',     amount: 1290,     type: 'compra',       direction: 'out', date: d(2026,5,28), category: 'deporte',      aiConfident: true,  aiSource: 'local',  split: null },
    { id: 'import-17', merchant: 'PAGO CMR',                 amount: 1172802,  type: 'pago_tarjeta', direction: 'in',  date: d(2026,5,28), category: null,           aiConfident: false, aiSource: 'income', split: null },
    { id: 'import-18', merchant: 'CASILLA DEPORTES',         amount: 13000,    type: 'devolucion',   direction: 'in',  date: d(2026,5,26), category: 'devolucion',   aiConfident: true,  aiSource: 'income', split: null },
    { id: 'import-19', merchant: 'CASILLA DEPORTES',         amount: 13000,    type: 'compra',       direction: 'out', date: d(2026,5,26), category: 'deporte',      aiConfident: true,  aiSource: 'local',  split: null },
    { id: 'import-20', merchant: 'CLUB DE GOLF SPORT',       amount: 17875,    type: 'compra',       direction: 'out', date: d(2026,5,26), category: 'deporte',      aiConfident: true,  aiSource: 'local',  split: null },
    { id: 'import-21', merchant: 'CASILLA DEPORTES',         amount: 7000,     type: 'compra',       direction: 'out', date: d(2026,5,26), category: 'deporte',      aiConfident: true,  aiSource: 'local',  split: null },
    { id: 'import-22', merchant: 'FORK NUEVA LAS CONDES',    amount: 4613,     type: 'compra',       direction: 'out', date: d(2026,5,24), category: 'restaurantes', aiConfident: true,  aiSource: 'local',  split: null },
    { id: 'import-23', merchant: 'ALIEXPRESS',               amount: 38918,    type: 'devolucion',   direction: 'in',  date: d(2026,5,23), category: 'devolucion',   aiConfident: true,  aiSource: 'income', split: null },
    { id: 'import-24', merchant: 'MAX',                      amount: 14990,    type: 'compra',       direction: 'out', date: d(2026,5,23), category: null,           aiConfident: false, aiSource: null,     split: null },
    { id: 'import-25', merchant: 'UBER',                     amount: 12701,    type: 'compra',       direction: 'out', date: d(2026,5,23), category: 'transporte',   aiConfident: true,  aiSource: 'local',  split: null },
    { id: 'import-26', merchant: 'IL MAESTRALE',             amount: 7400,     type: 'compra',       direction: 'out', date: d(2026,5,23), category: 'restaurantes', aiConfident: true,  aiSource: 'local',  split: null },
    { id: 'import-27', merchant: 'COPEC ZERVO',              amount: 40000,    type: 'compra',       direction: 'out', date: d(2026,5,23), category: 'transporte',   aiConfident: true,  aiSource: 'local',  split: null },
    { id: 'import-28', merchant: 'LIDER.CL',                 amount: 80972,    type: 'compra',       direction: 'out', date: d(2026,5,23), category: 'supermercado', aiConfident: true,  aiSource: 'local',  split: null },
    { id: 'import-29', merchant: 'ALIEXPRESS',               amount: 38918,    type: 'compra',       direction: 'out', date: d(2026,5,23), category: 'ropa',         aiConfident: true,  aiSource: 'local',  split: null },
    { id: 'import-30', merchant: 'UBER',                     amount: 957,      type: 'compra',       direction: 'out', date: d(2026,5,23), category: 'transporte',   aiConfident: true,  aiSource: 'local',  split: null },
    { id: 'import-31', merchant: 'LOS COLIGUES',             amount: 6870,     type: 'compra',       direction: 'out', date: d(2026,5,22), category: 'restaurantes', aiConfident: true,  aiSource: 'local',  split: null },
    { id: 'import-32', merchant: 'FALABELLA.COM',            amount: 36292,    type: 'compra',       direction: 'out', date: d(2026,5,20), category: 'ropa',         aiConfident: true,  aiSource: 'local',  split: null },
    { id: 'import-33', merchant: 'LIDER.CL',                 amount: 47070,    type: 'compra',       direction: 'out', date: d(2026,5,18), category: 'supermercado', aiConfident: true,  aiSource: 'local',  split: null },
    { id: 'import-34', merchant: 'WELLHUB CL',               amount: 49990,    type: 'compra',       direction: 'out', date: d(2026,5,17), category: 'deporte',      aiConfident: true,  aiSource: 'local',  split: null },
    { id: 'import-35', merchant: 'FORK NUEVA LAS CONDES',    amount: 5593,     type: 'compra',       direction: 'out', date: d(2026,5,17), category: 'restaurantes', aiConfident: true,  aiSource: 'local',  split: null },
    { id: 'import-36', merchant: 'SABA ARAUCO KENNEDY',      amount: 800,      type: 'compra',       direction: 'out', date: d(2026,5,16), category: 'transporte',   aiConfident: true,  aiSource: 'local',  split: null },
    { id: 'import-37', merchant: 'FALABELLA',                amount: 35992,    type: 'compra',       direction: 'out', date: d(2026,5,16), category: 'ropa',         aiConfident: true,  aiSource: 'local',  split: null },
    { id: 'import-38', merchant: 'MERCADOPAGO',              amount: 11700,    type: 'compra',       direction: 'out', date: d(2026,5,15), category: null,           aiConfident: false, aiSource: null,     split: null },
    { id: 'import-39', merchant: 'UNIMARC LOS TRAPENSES',    amount: 53110,    type: 'compra',       direction: 'out', date: d(2026,5,15), category: 'supermercado', aiConfident: true,  aiSource: 'local',  split: null },
    { id: 'import-40', merchant: 'JUMBO MARKET LO CASTILLO', amount: 43670,    type: 'compra',       direction: 'out', date: d(2026,5,14), category: 'supermercado', aiConfident: true,  aiSource: 'local',  split: null },
    { id: 'import-41', merchant: 'MERCADOPAGO *SUSHIBLU',    amount: 7590,     type: 'compra',       direction: 'out', date: d(2026,5,13), category: 'restaurantes', aiConfident: true,  aiSource: 'local',  split: null },
    { id: 'import-42', merchant: 'AVANCE REDBANC ATM',       amount: 30000,    type: 'avance',       direction: 'out', date: d(2026,3,7),  category: null,           aiConfident: false, aiSource: null,     split: null },
  ];

  return txs;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [transactions,   setTransactions]   = useState<Transaction[]>([]);
  const [merchantMemory, setMerchantMemory] = useState<MerchantMemory>({});
  const [apiKey,         setApiKeyState]    = useState('');
  const [isLoading,      setIsLoading]      = useState(true);

  const apiKeyRef = useRef(apiKey);
  useEffect(() => { apiKeyRef.current = apiKey; }, [apiKey]);

  // Cargar datos persistidos al inicio; cargar muestra si está vacío
  useEffect(() => {
    Promise.all([
      Storage.getTransactions(),
      Storage.getMerchantMemory(),
      Storage.getApiKey(),
    ]).then(([txs, mem, key]) => {
      const initial = txs.length === 0 ? buildSampleData() : txs;
      if (txs.length === 0) Storage.saveTransactions(initial);
      setTransactions(initial);
      setMerchantMemory(mem);
      setApiKeyState(key);
      setIsLoading(false);
    });
  }, []);

  const setApiKey = useCallback(async (key: string) => {
    setApiKeyState(key);
    await Storage.saveApiKey(key);
  }, []);

  const addTransaction = useCallback(async (params: AddTransactionParams) => {
    const { merchant, amount, type, direction, split, rawText } = params;

    const splitInfo = (split && direction === 'out')
      ? {
          totalPeople: split.totalPeople,
          myShare:     Math.round(amount / split.totalPeople),
          recovered:   split.recovered,
          description: split.description,
        }
      : null;

    const { category, confident, source } = await categorizeTransaction(
      merchant, amount, type, direction, merchantMemory, apiKeyRef.current
    );

    const newTx: Transaction = {
      id:          `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      merchant,
      amount,
      type,
      direction,
      date:        new Date().toISOString(),
      category:    category as any ?? null,
      aiConfident: confident,
      aiSource:    source as any,
      split:       splitInfo,
      rawNotificationText: rawText,
    };

    if (category && direction === 'out' && source !== 'fallback') {
      const updatedMemory = { ...merchantMemory, [merchant.toLowerCase()]: category };
      setMerchantMemory(updatedMemory);
      await Storage.saveMerchantMemory(updatedMemory);
    }

    setTransactions(prev => {
      const updated = [newTx, ...prev];
      Storage.saveTransactions(updated);
      return updated;
    });

    await showLocalConfirmation(merchant, amount, category, newTx.id);
  }, [merchantMemory]);

  const categorize = useCallback(async (txId: string, categoryId: string) => {
    const tx = transactions.find(t => t.id === txId);
    if (!tx) return;

    const updatedMemory = { ...merchantMemory, [tx.merchant.toLowerCase()]: categoryId };
    setMerchantMemory(updatedMemory);
    await Storage.saveMerchantMemory(updatedMemory);

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

  const clearData = useCallback(async () => {
    setTransactions([]);
    setMerchantMemory({});
    await Storage.clearAll();
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
      });
    }, [addTransaction])
  );

  const pendingCount = transactions.filter(
    t => t.direction === 'out' && t.category === null
  ).length;

  return (
    <AppContext.Provider value={{
      transactions, merchantMemory, apiKey, pendingCount, isLoading,
      setApiKey, addTransaction, categorize, deleteTransaction, moveTransaction, clearData,
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
