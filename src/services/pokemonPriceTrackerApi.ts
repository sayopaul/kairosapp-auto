import { TransformedCard } from '../types/card';
import { supabase } from '../lib/supabase';

interface PokemonSet {
  id: string;
  name: string;
  series: string;
  printedTotal: number;
  total: number;
  legalities: {
    unlimited: string;
    expanded: string;
  };
  ptcgoCode: string;
  releaseDate: string;
  updatedAt: string;
}

interface CardPrice {
  id: string;
  name: string;
  set: string;
  number: string;
  rarity: string;
  prices: {
    normal?: {
      market: number;
    };
    holofoil?: {
      market: number;
    };
    reverseHolofoil?: {
      market: number;
    };
  };
  imageUrl: string;
  updatedAt: string;
}

/**
 * Service for interacting with the Pokemon Price Tracker API
 */
export class PokemonPriceTrackerApiService {
  private static readonly PROXY_URL = `${supabase.supabaseUrl}/functions/v1/pokemon-price-tracker-proxy`;
  private static readonly API_KEY = supabase.supabaseKey;
  private static readonly MAX_RETRIES = 3;
  private static readonly INITIAL_RETRY_DELAY = 1000;
  private static cachedSets: PokemonSet[] = [];

  /**
   * Search for cards in the Pokemon Price Tracker API
   * @param query Search query string in format "name:cardName set:setName"
   * @returns Array of transformed cards
   */
  static async searchCards(query: string, pageSize: number = 10): Promise<TransformedCard[]> {
    console.log('🔍 Pokemon Price Tracker API: Searching for cards with query:', query);
    
    if (!query.trim()) return [];
  
    try {
      // Extract card name and set from query
      const nameMatch = query.match(/name:"([^"]+)"|name:(\S+)/);
      const cardName = nameMatch ? (nameMatch[1] || nameMatch[2]) : '';
      
      const setMatch = query.match(/set:"([^"]+)"|set:(\S+)/);
      const setName = setMatch ? (setMatch[1] || setMatch[2]) : '';
      
      const cardNumberMatch = query.match(/card_number:"([^"]+)"|card_number:(\S+)/);
      const cardNumber = cardNumberMatch ? (cardNumberMatch[1] || cardNumberMatch[2]) : '';

      console.log("Card number: ", cardNumber)
  
      if (!cardName) {
        console.warn('No card name provided in query');
        return [];
      }
  
      let setNameForTransform = setName;
      let setId = '';
      
      if (setName) {
        // Get all sets if not already cached
        if (!this.cachedSets || this.cachedSets.length === 0) {
          this.cachedSets = await this.fetchSets();
          if (this.cachedSets.length === 0) {
            console.error('Failed to fetch sets from Pokemon Price Tracker API');
            return [];
          }
        }
  
        // Find the set by name (case insensitive)
        const set = this.cachedSets.find(s => 
          s.name.toLowerCase() === setName.toLowerCase() ||
          s.ptcgoCode?.toLowerCase() === setName.toLowerCase()
        );
  
        if (set) {
          setId = set.id;
        } else {
          console.warn(`Could not find set with name: ${setName}`);
          // Continue with the search even if set is not found
        }
      }
  
      // Fetch card prices with or without set ID
      const cards = await this.fetchCardPrices(setId, cardName, cardNumber);
      return cards.map(card => this.transformCard(card, setNameForTransform || card.set || 'Unknown Set'));
  
    } catch (error) {
      console.error('Error in Pokemon Price Tracker API search:', error);
      return [];
    }
  }

  /**
   * Fetch all available sets from the API
   * @returns Array of Pokemon sets or null if the request fails
   */
  private static async fetchSets(): Promise<PokemonSet[]> {
    try {
      const response = await this.fetchWithRetry(
        `${this.PROXY_URL}/sets`,
        { method: 'GET' }
      );
      const responseData = await response.json();
      // Extract the 'data' array from the response
      const data = responseData?.data || [];
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Failed to fetch sets:', error);
      return [];
    }
  }

  /**
   * Fetch card prices for a specific set and card name
   * @param setId The ID of the set to search in
   * @param cardName The name of the card to search for
   * @returns Array of card prices
   */
  private static async fetchCardPrices(setId: string, cardName: string, cardNumber:string): Promise<CardPrice[]> {
    try {
      let url = `${this.PROXY_URL}/prices?name=${encodeURIComponent(cardName)}`;
      if (setId) {
        url += `&setId=${encodeURIComponent(setId)}`;
      }
      if (cardNumber) {
        url += `&number=${encodeURIComponent(cardNumber)}`;
      }
  
      console.log("The URL for the fetchCardPrices is: ", url)
      const response = await this.fetchWithRetry(
        url,
        { method: 'GET' }
      );
      const responseData = await response.json();
      // Extract the 'data' array from the response
      const data = responseData?.data || [];
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Failed to fetch card prices:', error);
      return [];
    }
  }

  /**
   * Transform a CardPrice object to the internal TransformedCard format
   * @param card The card price data from the API
   * @param setName The name of the set this card belongs to
   * @returns Transformed card data
   */
  /**
   * Extract price from the card data with fallback logic
   * @param card The card data from the API
   * @returns The extracted price or 0 if no price found
   */
  private static extractPrice(card: any): number {
    // Try TCGPlayer prices first (from the sample response)
    if (card.tcgplayer?.prices) {
      const prices = card.tcgplayer.prices;
      
      // Try different price types in order of preference
      if (prices.holofoil?.market) return prices.holofoil.market;
      if (prices.holofoil?.mid) return prices.holofoil.mid;
      if (prices.holofoil?.low) return prices.holofoil.low;
      
      if (prices.normal?.market) return prices.normal.market;
      if (prices.normal?.mid) return prices.normal.mid;
      if (prices.normal?.low) return prices.normal.low;
      
      if (prices.reverseHolofoil?.market) return prices.reverseHolofoil.market;
      if (prices.reverseHolofoil?.mid) return prices.reverseHolofoil.mid;
      if (prices.reverseHolofoil?.low) return prices.reverseHolofoil.low;
    }
    
    // Try CardMarket prices if available
    if (card.cardmarket?.prices) {
      const prices = card.cardmarket.prices;
      
      if (prices.averageSellPrice) return prices.averageSellPrice;
      if (prices.trendPrice) return prices.trendPrice;
      if (prices.lowPrice) return prices.lowPrice;
      if (prices.suggestedPrice) return prices.suggestedPrice;
    }
    
    // Check for eBay prices if available (from the sample response)
    if (card.ebay?.salesByGrade) {
      const sales = card.ebay.salesByGrade;
      
      // Try to get a recent average price from graded sales
      if (sales.psa10?.last30Days?.average) return sales.psa10.last30Days.average * 0.5; // Adjust for grading premium
      if (sales.psa9?.last30Days?.average) return sales.psa9.last30Days.average * 0.4;   // Adjust for grading premium
    }
    
    // Fallback to 0 if no price can be determined
    return 0;
  }

  /**
   * Transform API card data to our internal format
   * @param card The card data from the API
   * @param setName The name of the set this card belongs to
   * @returns Transformed card in our standard format
   */
  private static transformCard(card: any, setName: any): TransformedCard {
    const price = this.extractPrice(card);
    const imageUrl = card.images?.small || card.images?.large || '';
    
    // Handle both string and object types for setName
    const resolvedSetName = typeof setName === 'object' 
      ? (setName.name || 'Unknown Set')
      : (setName || card.set?.name || 'Unknown Set');
    
    return {
      id: card.id || card._id || '',
      name: card.name || 'Unknown Card',
      set: resolvedSetName,
      card_number: card.number || '',
      rarity: card.rarity || 'Common',
      market_price: price,
      image_url: imageUrl,
      source: 'pokemonpricetracker'
    };
  }

  /**
   * Get card by ID
   * @param cardId The ID of the card to retrieve
   * @returns The transformed card or null if not found
   */
  static async getCardById(cardId: string): Promise<TransformedCard | null> {
    console.log('🔍 Pokemon Price Tracker API: Getting card by ID:', cardId);
    
    if (!cardId) return null;

    try {
      const response = await this.fetchWithRetry(
        `${this.PROXY_URL}/cards/${cardId}`,
        { method: 'GET' }
      );
      
      const card: CardPrice = await response.json();
      
      // Get the set name from the cached sets if available
      let setName = 'Unknown Set';
      if (this.cachedSets) {
        const set = this.cachedSets.find(s => s.id === card.set);
        if (set) {
          setName = set.name;
        }
      }
      
      return this.transformCard(card, setName);
    } catch (error) {
      console.error('Error in Pokemon Price Tracker API getCardById:', error);
      return null;
    }
  }

  /**
   * Helper method to handle retries with exponential backoff
   * @param url The URL to fetch
   * @param options Fetch options
   * @param attempt Current attempt number
   * @returns Promise with the response
   */
  private static async fetchWithRetry(
    url: string,
    options: RequestInit,
    attempt: number = 1
  ): Promise<Response> {
    const headers = new Headers(options.headers);

    if (this.API_KEY) {
      headers.set('Authorization', `Bearer ${this.API_KEY}`);
    }


    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response;
    } catch (error) {
      if (attempt >= this.MAX_RETRIES) {
        console.error(`❌ Max retries (${this.MAX_RETRIES}) reached for ${url}`);
        throw error;
      }
      
      const delay = this.INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
      console.log(`⏳ Retry ${attempt}/${this.MAX_RETRIES} in ${delay}ms`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.fetchWithRetry(url, options, attempt + 1);
    }
  }


  /**
 * Get the best available price from the card data
 * @param card The card data from the API
 * @returns The best available price or null if no valid price is found
 */
static getBestPrice(card: any): number | null {
  if (!card) return null;
  
  // Check for direct price first
  if (typeof card.market_price === 'number' && card.market_price > 0) {
    return card.market_price;
  }
  
  // Check for tcgplayer prices
  if (card.tcgplayer?.prices) {
    const prices = card.tcgplayer.prices;
    const priceSources = [
      prices.normal?.market,
      prices.holofoil?.market,
      prices.reverseHolofoil?.market,
      prices['1stEditionHolofoil']?.market,
      prices['1stEditionNormal']?.market
    ];
    
    // Find the first valid price
    for (const price of priceSources) {
      if (price && price > 0) {
        return price;
      }
    }
  }
  
  // Check for cardmarket prices
  if (card.cardmarket?.prices) {
    const prices = card.cardmarket.prices;
    const priceSources = [
      prices.averageSellPrice,
      prices.lowPrice,
      prices.trendPrice
    ];
    
    // Find the first valid price
    for (const price of priceSources) {
      if (price && price > 0) {
        return price;
      }
    }
  }
  
  return null;
}
}
