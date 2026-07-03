import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Transaction, MerchantMemory } from '../types';

const KEYS = {
  TRANSACTIONS:    'fb_transactions_v3',
  MERCHANT_MEMORY: 'fb_merchant_memory_v3',
  API_KEY:         'fb_anthropic_api_key',
} as const;

// SecureStore no acepta algunos caracteres en las keys; usar solo [A-Za-z0-9._-]
const SECURE_API_KEY = 'fb_anthropic_api_key';

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
    try {
      const secure = await SecureStore.getItemAsync(SECURE_API_KEY);
      if (secure) return secure;
      // Migración: si existe en AsyncStorage (versión anterior), moverla a SecureStore
      const legacy = await AsyncStorage.getItem(KEYS.API_KEY);
      if (legacy) {
        await SecureStore.setItemAsync(SECURE_API_KEY, legacy);
        await AsyncStorage.removeItem(KEYS.API_KEY);
        return legacy;
      }
      return '';
    } catch {
      // Fallback si SecureStore no está disponible en este dispositivo
      return (await AsyncStorage.getItem(KEYS.API_KEY)) ?? '';
    }
  },

  async saveApiKey(key: string): Promise<void> {
    const trimmed = key.trim();
    try {
      if (trimmed) {
        await SecureStore.setItemAsync(SECURE_API_KEY, trimmed);
      } else {
        await SecureStore.deleteItemAsync(SECURE_API_KEY);
      }
    } catch {
      await AsyncStorage.setItem(KEYS.API_KEY, trimmed);
    }
  },

  async clearAll(): Promise<void> {
    await AsyncStorage.multiRemove([
      KEYS.TRANSACTIONS,
      KEYS.MERCHANT_MEMORY,
    ]);
  },
};
