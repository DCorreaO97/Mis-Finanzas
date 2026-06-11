import { CategoryId, MerchantMemory } from '../types';
import { CATEGORY_IDS, LOCAL_MERCHANT_MAP } from '../constants/categories';

export type AiSource = 'memory' | 'local' | 'ai' | 'income' | 'fallback';

export interface CategorizationResult {
  category: CategoryId | string | null;
  confident: boolean;
  source: AiSource;
}

export async function categorizeTransaction(
  merchant: string,
  amount: number,
  type: string,
  direction: 'in' | 'out',
  merchantMemory: MerchantMemory,
  apiKey: string
): Promise<CategorizationResult> {
  if (direction === 'in') {
    return { category: type, confident: true, source: 'income' };
  }

  const merchantLower = merchant.toLowerCase();

  if (merchantMemory[merchantLower]) {
    return { category: merchantMemory[merchantLower], confident: true, source: 'memory' };
  }

  for (const [key, categoryId] of Object.entries(LOCAL_MERCHANT_MAP)) {
    if (merchantLower.includes(key)) {
      return { category: categoryId, confident: true, source: 'local' };
    }
  }

  if (!apiKey) {
    return { category: null, confident: false, source: 'fallback' };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 20,
        system:
          'Eres un categorizador de gastos bancarios chilenos. Responde ÚNICAMENTE con el nombre exacto de una categoría de la lista, o la palabra "pendiente". No incluyas puntuación, explicaciones ni texto adicional.',
        messages: [{
          role: 'user',
          content: [
            'Categorías válidas: inversiones, departamento, ropa, restaurantes, supermercado, deporte, transporte, carrete, salud',
            `Comercio: "${merchant}"`,
            `Monto: $${amount.toLocaleString('es-CL')}`,
            `Tipo de movimiento: ${type}`,
            '¿A qué categoría pertenece?',
          ].join('\n'),
        }],
      }),
    });

    if (!response.ok) {
      console.warn('Anthropic API error:', response.status);
      return { category: null, confident: false, source: 'fallback' };
    }

    const data = await response.json();
    const raw  = (data.content?.[0]?.text ?? '').trim().toLowerCase();

    if (CATEGORY_IDS.has(raw as CategoryId)) {
      return { category: raw as CategoryId, confident: true, source: 'ai' };
    }

    return { category: null, confident: false, source: 'ai' };
  } catch (error) {
    console.warn('categorizeWithAI error:', error);
    return { category: null, confident: false, source: 'fallback' };
  }
}
