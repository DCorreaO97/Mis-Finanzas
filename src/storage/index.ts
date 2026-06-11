import AsyncStorage from '@react-native-async-storage/async-storage';
import { Transaction, MerchantMemory } from '../types';

const KEYS = {
  TRANSACTIONS:    'fb_transactions_v3',
  MERCHANT_MEMORY: 'fb_merchant_memory_v3',
  API_KEY:         'fb_anthropic_api_key',
} as const;

export const Storage = {
  async getTransactions(): Promise<Transaction[]> {
    const raw = await AsyncStorage.getItem(KEYS.TRANSACTIONS);
    if (!raw) return [];
    return JSON.parse(raw) as Transaction[];
  },

  async saveTransactions(txs: Transaction[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(txs));
  },

  async getMerchantMemory(): Promise<MerchantMemory> {
    const raw = await AsyncStorage.getItem(KEYS.MERCHANT_MEMORY);
    if (!raw) return {};
    return JSON.parse(raw) as MerchantMemory;
  },

  async saveMerchantMemory(memory: MerchantMemory): Promise<void> {
    await AsyncStorage.setItem(KEYS.MERCHANT_MEMORY, JSON.stringify(memory));
  },

  async getApiKey(): Promise<string> {
    return (await AsyncStorage.getItem(KEYS.API_KEY)) ?? '';
  },

  async saveApiKey(key: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.API_KEY, key.trim());
  },

  async clearAll(): Promise<void> {
    await AsyncStorage.multiRemove([
      KEYS.TRANSACTIONS,
      KEYS.MERCHANT_MEMORY,
    ]);
  },
};
