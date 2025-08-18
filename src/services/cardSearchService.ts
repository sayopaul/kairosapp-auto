import { PokemonTcgApiService } from './pokemonTcgApi';
import { JustTcgApiService } from './justTcgApiService';
import { PokemonPriceTrackerApiService } from './pokemonPriceTrackerApi';
import { TransformedCard } from '../types/card';

export class CardSearchService {
  /**
   * Search for cards across all available card services
   * @param query Search query (card name)
   * @param pageSize Maximum number of results to return
   * @returns Combined and deduplicated list of cards
   */
  static async searchCards(query: string, pageSize: number = 100): Promise<TransformedCard[]> {
    console.log(`🔍 Unified Search: Starting search for "${query}"`);

    try {
      // Run all searches in parallel
      const [pokemonResults, justTcgResults, priceTrackerResults] = await Promise.allSettled([
        PokemonTcgApiService.searchCards(query, pageSize),
        JustTcgApiService.searchCards(query, pageSize),
        PokemonPriceTrackerApiService.searchCards(query, pageSize)
      ]);

      // Process results
      const allCards: TransformedCard[] = [];

      // Add Pokemon TCG results
      if (pokemonResults.status === 'fulfilled') {
        allCards.push(...pokemonResults.value);
        console.log(`✅ Got ${pokemonResults.value.length} results from Pokemon TCG`);
      } else {
        console.warn('❌ Pokemon TCG search failed:', pokemonResults.reason);
      }


      console.log("The pokemon results are: ", pokemonResults)
      console.log("The justtcg results are: ", justTcgResults)
      // Add JustTCG results
      if (justTcgResults.status === 'fulfilled') {
        allCards.push(...justTcgResults.value);
        console.log(`✅ Got ${justTcgResults.value.length} results from JustTCG`);
      } else {
        console.warn('❌ JustTCG search failed:', justTcgResults.reason);
      }

      // Add Pokemon Price Tracker results
      if (priceTrackerResults.status === 'fulfilled') {
        allCards.push(...priceTrackerResults.value);
        console.log(`✅ Got ${priceTrackerResults.value.length} results from Pokemon Price Tracker`);
      } else {
        console.warn('❌ Pokemon Price Tracker search failed:', priceTrackerResults.reason);
      }

      // Remove duplicates (same name and set) and sort
      const uniqueCards = this.removeDuplicates(allCards);
      console.log(`✨ Found ${uniqueCards.length} unique cards total`);

      console.log("The unique cards are: ", uniqueCards);
      return uniqueCards;
    } catch (error) {
      console.error('❌ Unified search error:', error);
      throw error;
    }
  }

  /**
   * Remove duplicate cards based on name and set
   * @param cards Array of cards to deduplicate
   * @returns Deduplicated array of cards
   */
  private static removeDuplicates(cards: TransformedCard[]): TransformedCard[] {
    const seen = new Set<string>();
    return cards.filter(card => {
      // Safely handle cases where set might not be a string
      const setName = typeof card.set === 'string' ? card.set : '';
      const key = `${card.name.toLowerCase()}|${setName.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => {
      // Sort by name for consistent ordering
      return a.name.localeCompare(b.name);
    });
  }
}

// Re-export the TransformedCard type for consistency
export type { TransformedCard } from '../types/card';
