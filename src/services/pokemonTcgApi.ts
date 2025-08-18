// Pokemon TCG API Service for real-time card data and pricing
export interface PokemonCard {
  id: string;
  name: string;
  set: {
    id: string;
    name: string;
    series: string;
    printedTotal: number;
    total: number;
    legalities: {
      unlimited?: string;
      standard?: string;
      expanded?: string;
    };
    ptcgoCode?: string;
    releaseDate: string;
    updatedAt: string;
    images: {
      symbol: string;
      logo: string;
    };
  };
  number: string;
  artist?: string;
  rarity: string;
  flavorText?: string;
  nationalPokedexNumbers?: number[];
  legalities: {
    unlimited?: string;
    standard?: string;
    expanded?: string;
  };
  images: {
    small: string;
    large: string;
  };
  tcgplayer?: {
    url: string;
    updatedAt: string;
    prices?: {
      holofoil?: {
        low?: number;
        mid?: number;
        high?: number;
        market?: number;
        directLow?: number;
      };
      reverseHolofoil?: {
        low?: number;
        mid?: number;
        high?: number;
        market?: number;
        directLow?: number;
      };
      normal?: {
        low?: number;
        mid?: number;
        high?: number;
        market?: number;
        directLow?: number;
      };
    };
  };
  cardmarket?: {
    url: string;
    updatedAt: string;
    prices: {
      averageSellPrice?: number;
      lowPrice?: number;
      trendPrice?: number;
      germanProLow?: number;
      suggestedPrice?: number;
      reverseHoloSell?: number;
      reverseHoloLow?: number;
      reverseHoloTrend?: number;
      lowPriceExPlus?: number;
      avg1?: number;
      avg7?: number;
      avg30?: number;
      reverseHoloAvg1?: number;
      reverseHoloAvg7?: number;
      reverseHoloAvg30?: number;
    };
  };
}

export interface TransformedCard {
  id: string;
  name: string;
  set: string;
  card_number: string;
  rarity: string;
  market_price: number;
  image_url: string;
}

export class PokemonTcgApiService {
  private static readonly API_KEY = import.meta.env.VITE_POKEMON_TCG_API_KEY || '';
  // private static readonly BASE_URL = '/api/pokemontcg/v2';
  private static readonly BASE_URL = 'https://api.pokemontcg.io/v2';
  private static readonly MAX_RETRIES = 3;
  private static readonly INITIAL_RETRY_DELAY = 1000; // 1 second
  
  // https://api.pokemontcg.io
  // https://api.pokemontcg.io/v2/cards/

  // Search for cards with real API data
  static async searchCards(query: string, pageSize: number = 100): Promise<TransformedCard[]> {
     // temporarily disable PokemonTCG as we are using only PokemonPriceTracker
     return []
    try {
      console.log('🔍 Pokemon TCG API: Searching for cards with query:', query);
      
      if (!query.trim()) return [];

      // when passing the query to this function, I will add the actual items in to make it easy to parse here, name: set: condition: etc

      // const spaceIndex = query.indexOf(' ');
      // const name = spaceIndex === -1 ? query.trim() : query.substring(0, spaceIndex).trim();
      // const set = spaceIndex === -1 ? '' : query.substring(spaceIndex + 1).trim();
      
      // let searchQuery = `name:${name}`;
      // if (set) {
      //   searchQuery += ` set.name:${set}`;
      // }

      // Extract each parameter using regex
      const extractParam = (query: string, paramName: string): string => {
        const regex = new RegExp(`${paramName}:"([^"]+)"|${paramName}:([^\\s]+)`);
        const match = query.match(regex);
        return match ? (match[1] || match[2]) : '';
      };

      const name = extractParam(query, 'name');
      const set = extractParam(query, 'set');
      const condition = extractParam(query, 'condition');
      const rarity = extractParam(query, 'rarity');

      // Build the search query
      let searchQuery = '';
      if (name) searchQuery += `name:"${name}" `;
      if (set) searchQuery += `set.name:"${set}" `;

      //TODO I need to confirm the below in Postman
      // if (condition) searchQuery += `condition:${condition} `;
      // if (rarity) searchQuery += `rarity:${rarity} `;

      searchQuery = searchQuery.trim();

      const params = new URLSearchParams({
        q: searchQuery,
        pageSize: Math.min(pageSize, 250).toString()
      });

      const searchUrl = `${this.BASE_URL}/cards?${params.toString()}`;
      console.log('🌐 Making API request to:', searchUrl);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      console.log("PokemonTCG API KEY: ",this.API_KEY)
      
      if (this.API_KEY) {
        headers['X-Api-Key'] = this.API_KEY;
      }

      const response = await this.fetchWithRetry(searchUrl, {
        method: 'GET',
        headers
      });
      
      console.log('📡 PokemonTCG API Response status:', response.status, response.statusText);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid Pokemon TCG API key. Please check your VITE_POKEMON_TCG_API_KEY.');
        } else if (response.status === 429) {
          throw new Error('Pokemon TCG API rate limit exceeded. Please try again later.');
        } else if (response.status === 404) {
          throw new Error('Pokemon TCG API endpoint not found. Please check the API documentation.');
        } else {
          throw new Error(`Pokemon TCG API error: ${response.status} ${response.statusText}`);
        }
      }
      
      const data = await response.json();
      console.log('📦 Raw API response:', data);
      
      const cards = data.data || [];
      console.log('🃏 Found', cards.length, 'cards in API response');
      
      // Transform API response to our format
      const transformedCards: TransformedCard[] = cards.map((card: PokemonCard) => {
        const transformedCard = {
          id: card.id,
          name: card.name,
          set: card.set.name,
          card_number: card.number,
          rarity: card.rarity,
          market_price: this.extractPrice(card),
          image_url: card.images.large || card.images.small
        };
        
        console.log('🔄 Transformed card:', transformedCard.name, '$' + transformedCard.market_price);
        return transformedCard;
      });
      
      console.log('✅ Returning', transformedCards.length, 'transformed cards');
      return transformedCards;
      
    } catch (error) {
      console.error('❌ Pokemon TCG API error:', error);
      throw error;
    }
  }
  
  // Extract price from various possible API response formats
  private static extractPrice(card: PokemonCard): number {
    // Try TCGPlayer prices first
    if (card.tcgplayer?.prices) {
      const prices = card.tcgplayer.prices;
      
      // Try different price types in order of preference
      if (prices.holofoil?.market) return prices.holofoil.market;
      if (prices.normal?.market) return prices.normal.market;
      if (prices.reverseHolofoil?.market) return prices.reverseHolofoil.market;
      
      if (prices.holofoil?.mid) return prices.holofoil.mid;
      if (prices.normal?.mid) return prices.normal.mid;
      if (prices.reverseHolofoil?.mid) return prices.reverseHolofoil.mid;
    }
    
    // Try CardMarket prices
    if (card.cardmarket?.prices) {
      const prices = card.cardmarket.prices;
      
      if (prices.averageSellPrice) return prices.averageSellPrice;
      if (prices.trendPrice) return prices.trendPrice;
      if (prices.suggestedPrice) return prices.suggestedPrice;
    }
    
    // If no price found, estimate based on card name and rarity
    return this.estimateBasePrice(card.name, card.set.name, card.rarity);
  }
  
  // Update card pricing from real API
  static async updateCardPricing(card: any): Promise<number> {
    try {
      console.log('💰 Pokémon TCG API: Updating pricing for card:', card.name);
      
      // Search for the specific card to get updated pricing
      const searchResults = await this.searchCards(card.name, 10);
      
      // Find the best match  
      const exactMatch = searchResults.find(result => 
        result.name.toLowerCase() === card.name.toLowerCase() &&
        (result.set.toLowerCase() === card.set.toLowerCase() || !card.set)
      );
      
      if (exactMatch && exactMatch.market_price > 0) {
        console.log('✅ Pokémon TCG API: Found updated price:', exactMatch.market_price);
        return exactMatch.market_price;
      }
      
      // If no exact match, use the first result with a price
      const firstWithPrice = searchResults.find(result => result.market_price > 0);
      if (firstWithPrice) {
        console.log('✅ Pokémon TCG API: Using similar card price:', firstWithPrice.market_price);
        return firstWithPrice.market_price;
      }
      
      // Fall back to estimation
      return this.estimateBasePrice(card.name, card.set, card.rarity);
      
    } catch (error) {
      console.error('❌ Pokémon TCG API: Error updating card pricing:', error);
      return this.estimateBasePrice(card.name, card.set, card.rarity);
    }
  }
  
  private static async fetchWithRetry(
    url: string,
    options: RequestInit,
    attempt = 1
  ): Promise<Response> {
    try {
      const response = await fetch(url, options);
      
      // If it's a server error (5xx) and not the last attempt, retry
      if (response.status >= 500 && response.status < 600 && attempt < this.MAX_RETRIES) {
        const delay = this.INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
        console.log(`⚠️ Attempt ${attempt} failed with status ${response.status}. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, options, attempt + 1);
      }
      
      return response;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      if (attempt < this.MAX_RETRIES) {
        const delay = this.INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
        console.log(`⚠️ Attempt ${attempt} failed with error: ${errorMessage}. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, options, attempt + 1);
      }
      // If we've exhausted all retries, create a new error with the message
      throw new Error(errorMessage);
    }
  }

  // Get card details by ID (for specific card lookups)
  static async getCardById(cardId: string): Promise<TransformedCard | null> { 
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (this.API_KEY) {
        headers['X-Api-Key'] = this.API_KEY;
      }
      
      const response = await fetch(`${this.BASE_URL}/cards/${cardId}`, {
        method: 'GET', 
        headers
      });
      
      if (!response.ok) {
        console.error('❌ Pokemon TCG API error for card ID:', cardId, response.status);
        return null;
      }
      
      const data = await response.json();
      const card = data.data;
      
      if (!card) return null;
      
      return {
        id: card.id,
        name: card.name,
        set: card.set.name,
        card_number: card.number,
        rarity: card.rarity,
        market_price: this.extractPrice(card),
        image_url: card.images.large || card.images.small
      };
      
    } catch (error) {
      console.error('❌ Error fetching card by ID:', error);
      return null;
    }
  }

  // Estimate base price for cards when API data is unavailable
  static estimateBasePrice(cardName: string, setName: string, rarity: string = ''): number {
    const name = cardName.toLowerCase();
    const set = setName.toLowerCase();
    const rarityLower = rarity.toLowerCase();

    // High-value legendary/popular cards
    if (name.includes('charizard')) return 300;
    if (name.includes('pikachu') && set.includes('base')) return 25;
    if (name.includes('mewtwo')) return 150;
    if (name.includes('mew')) return 100;
    if (name.includes('blastoise')) return 280;
    if (name.includes('venusaur')) return 320;
    if (name.includes('alakazam')) return 120;
    if (name.includes('machamp')) return 90;
    if (name.includes('gyarados')) return 110;
    if (name.includes('raichu')) return 85;
    if (name.includes('nidoking')) return 75;
    if (name.includes('clefairy')) return 65;
    if (name.includes('ninetales')) return 70;
    if (name.includes('poliwrath')) return 60;
    
    // Special card types
    if (name.includes('ex') || name.includes('gx')) return 50;
    if (name.includes('v') || name.includes('vmax')) return 30;
    
    // Rarity-based pricing
    if (rarityLower.includes('secret') || rarityLower.includes('rainbow')) return 100;
    if (rarityLower.includes('ultra') || rarityLower.includes('full art')) return 40;
    if (rarityLower.includes('holo') || rarityLower.includes('rare')) return 25;
    if (rarityLower.includes('uncommon')) return 5;
    
    // Starter Pokemon
    if (name.includes('charmander') || name.includes('squirtle') || name.includes('bulbasaur')) return 15;
    if (name.includes('charmeleon') || name.includes('wartortle') || name.includes('ivysaur')) return 25;
    
    // Default pricing based on set
    if (set.includes('base') || set.includes('jungle') || set.includes('fossil')) return 15;
    
    return 5; // Default low value
  }
}