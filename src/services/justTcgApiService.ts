// JustTCG API Service via Supabase proxy for real-time card pricing
import { supabase } from '../lib/supabase';

export interface JustTcgCard {
  id: string;
  name: string;
  set: {
    id: string;
    name: string;
  };
  number: string;
  rarity: string;
  prices: {
    [condition: string]: {
      market?: number;
      low?: number;
      mid?: number;
      high?: number;
      updated_at?: string;
    };
  };
  images: {
    small?: string;
    large?: string;
  };
}

export interface JustTcgPricing {
  cardId: string;
  cardName: string;
  setName: string;
  prices: {
    [condition: string]: number;
  };
  lastUpdated: string;
  source: 'justtcg';
}

export interface TransformedCard {
  id: string;
  name: string;
  set: string;
  card_number: string;
  rarity: string;
  market_price: number;
  image_url: string;
  source?: 'justtcg' | 'pokemontcg';
}

export class JustTcgApiService {
  private static readonly PROXY_URL = `${supabase.supabaseUrl}/functions/v1/justtcg-proxy`;

  /**
   * Search for cards with a query string
   * @param query Search query (card name)
   * @param pageSize Maximum number of results to return
   * @returns Array of transformed cards
   */
  static async searchCards(query: string, pageSize: number = 100): Promise<TransformedCard[]> {
    // temporarily disable JustTCG because of rate limits
    return []
    try {
       //if pageSize is greater than 20, set it to 20 because of the current plan limits on JustTCG
       if (pageSize > 20) {
        pageSize = 20;
      }
      
      console.log(`🔍 JustTCG: Searching for "${query}" with pageSize ${pageSize}`);

      // Split the query into name (first word) and set (remaining words)
      const spaceIndex = query.indexOf(' ');
      const name = spaceIndex === -1 ? query.trim() : query.substring(0, spaceIndex).trim();
      const set = spaceIndex === -1 ? '' : query.substring(spaceIndex + 1).trim();
      
      const params = new URLSearchParams({
        name: name,
        limit: pageSize.toString()
      });
      
      if (set) {
        params.append('set', set);
      }
      
      const response = await fetch(`${this.PROXY_URL}?${params}`, {
        headers: {
          'Content-Type': 'application/json',
           'Authorization': `Bearer ${supabase.supabaseKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`JustTCG API error: ${response.statusText}`);
      }

      const data = await response.json();
      return this.transformCards(data.data || []);


    } catch (error) {
      console.error('❌ JustTCG search error:', error);
      throw error; // Re-throw to be handled by the caller
    }
  }

  private static transformCards(cards: JustTcgCard[]): TransformedCard[] {
    return cards.map(card => ({
      id: card.id,
      name: card.name,
      set: card.set?.name || 'Unknown',
      card_number: card.number,
      rarity: card.rarity || 'Common',
      market_price: this.extractPrice(card),
      image_url: card.images?.small || card.images?.large || '',
      source: 'justtcg'
    }));
  }

  private static extractPrice(card: JustTcgCard): number {
    const prices = card.prices;
    if (!prices) return 0;

    // Try to get market price first, then mid, then low
    for (const condition in prices) {
      const priceObj = prices[condition];
      if (priceObj?.market) return priceObj.market;
      if (priceObj?.mid) return priceObj.mid;
      if (priceObj?.low) return priceObj.low;
    }

    return 0;
  }

  // Keep the existing method for backward compatibility
  static async searchCardPricing(cardName: string, setName?: string): Promise<JustTcgPricing | null> {
    try {
      console.log('🔍 JustTCG Proxy: Searching for pricing:', { cardName, setName });

      if (!cardName.trim()) return null;

      const params = new URLSearchParams({ name: cardName.trim() });
      if (setName && setName.trim()) params.append('set', setName.trim());

      const proxyUrl = `${this.PROXY_URL}?${params.toString()}`;
      console.log('🌐 Requesting from Supabase Proxy:', proxyUrl);

      // const response = await fetch(proxyUrl);

      // await supabase.functions.invoke('justtcg-proxy', {
      //   body: JSON.stringify({ name: cardName.trim(), set: setName?.trim() })
      // });   
      
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabase.supabaseKey}`
        }
      });

      console.log('JustTCG Proxy response:', response);

      if (!response.ok) {
        console.warn(`JustTCG Proxy error: ${response.status} ${response.statusText}`);
        return null;
      }

      const card = await response.json();
      return this.extractPricing(card);

    } catch (error) {
      console.error('❌ JustTCG Proxy fetch error:', error);
      return null;
    }
  }

  private static extractPricing(card: JustTcgCard): JustTcgPricing {
    const prices: { [condition: string]: number } = {};
    const conditions = ['Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played', 'Damaged', 'Mint'];

    conditions.forEach(condition => {
      const conditionKey = condition.toLowerCase().replace(/\s+/g, '_');
      const priceData = card.prices?.[conditionKey] || card.prices?.[condition];

      let price = priceData?.market || priceData?.mid;

      if (!price && priceData?.low && priceData?.high) {
        price = (priceData.low + priceData.high) / 2;
      }
      if (!price) {
        price = priceData?.low || priceData?.high;
      }

      if (price && price > 0) {
        prices[condition] = price;
      }
    });

    return {
      cardId: card.id,
      cardName: card.name,
      setName: card.set.name,
      prices,
      lastUpdated: new Date().toISOString(),
      source: 'justtcg'
    };
  }

  static getPriceForCondition(pricing: JustTcgPricing, condition: string): number | null {
    return pricing.prices[condition] || null;
  }

  static getBestPrice(pricing: JustTcgPricing): number | null {
    const preferredOrder = [
      'Near Mint',
      'Mint',
      'Lightly Played',
      'Moderately Played',
      'Heavily Played',
      'Damaged'
    ];
    for (const condition of preferredOrder) {
      const price = pricing.prices[condition];
      if (price && price > 0) {
        return price;
      }
    }
    return null;
  }

  static async updateCardPricing(card: any): Promise<{ price: number; condition: string; source: string } | null> {
    try {
      console.log('💰 JustTCG: Updating pricing for card:', card.name);

      const pricing = await this.searchCardPricing(card.name, card.set);
      if (!pricing) {
        console.log('❌ No pricing found for card:', card.name);
        return null;
      }

      let price = this.getPriceForCondition(pricing, card.condition || 'Near Mint');
      let usedCondition = card.condition || 'Near Mint';

      if (!price) {
        price = this.getBestPrice(pricing);
        if (price) {
          for (const [condition, conditionPrice] of Object.entries(pricing.prices)) {
            if (conditionPrice === price) {
              usedCondition = condition;
              break;
            }
          }
        }
      }

      return price ? { price, condition: usedCondition, source: 'justtcg' } : null;

    } catch (error) {
      console.error('❌ Error updating card pricing:', error);
      return null;
    }
  }

  static async batchUpdatePricing(cards: any[]): Promise<Map<string, { price: number; condition: string; source: string }>> {
    const results = new Map();
    const batchSize = 5;

    for (let i = 0; i < cards.length; i += batchSize) {
      const batch = cards.slice(i, i + batchSize);
      const promises = batch.map(async card => {
        const pricing = await this.updateCardPricing(card);
        if (pricing) results.set(card.id, pricing);
      });

      await Promise.all(promises);

      if (i + batchSize < cards.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return results;
  }
}
