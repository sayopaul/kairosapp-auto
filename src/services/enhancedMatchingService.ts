import { supabase } from '../lib/supabase';
import { PokemonTcgApiService } from './pokemonTcgApi';

interface MatchingCriteria {
  userId: string;
  maxValueDifference?: number;
  minMatchScore?: number;
  valueTolerance?: number;
}

interface TradeScore {
  valueScore: number;
  conditionScore: number;
  rarityScore: number;
  demandScore: number;
  userReputationScore: number;
  mutualBenefitScore?: number;
  overallScore: number;
}

interface EnhancedMatch {
  id: string;
  user1_id: string;
  user2_id: string;
  user1_card_id: string;
  user2_card_id: string;
  match_score: number;
  value_difference: number;
  mutual_benefit_score?: number;
  trade_score: TradeScore;
  confidence: 'high' | 'medium' | 'low';
  status: 'pending' | 'accepted' | 'declined' | 'completed';
  created_at: string;
  // Joined data
  user1?: any;
  user2?: any;
  user1_card?: any;
  user2_card?: any;
  pricing_data?: {
    user1_card_price: number;
    user2_card_price: number;
    price_source: 'pokemon_tcg' | 'estimated';
  };
}

class EnhancedMatchingService {
  // Calculate value score with pricing data
  private async calculateValueScore(
    card1: any, 
    card2: any, 
    valueTolerance: number = 80
  ): Promise<{ score: number; pricing: { card1Price: number; card2Price: number; source: 'justtcg' | 'estimated' } }> {
    try {
      // Try to get updated pricing from PokePrice API
      let card1Price = parseFloat(card1.market_price) || 0;
      let card2Price = parseFloat(card2.market_price) || 0;
      let priceSource: 'pokeprice' | 'estimated' = 'estimated';
      
      try {
        // Try to get updated pricing from Pokemon TCG API
        const updatedCard1Price = await PokemonTcgApiService.updateCardPricing(card1);
        const updatedCard2Price = await PokemonTcgApiService.updateCardPricing(card2);
        
        if (updatedCard1Price > 0 && updatedCard2Price > 0) {
          card1Price = updatedCard1Price;
          card2Price = updatedCard2Price;
          priceSource = 'pokemon_tcg';
          console.log(`Using Pokemon TCG pricing: ${card1.name}=$${card1Price}, ${card2.name}=$${card2Price}`);
        }
      } catch (error) {
        console.log('Using estimated pricing due to API error:', error);
      }
      
      // Handle zero prices
      if (card1Price === 0 || card2Price === 0) {
        return { 
          score: 50, 
          pricing: { 
            card1Price, 
            card2Price, 
            source: priceSource === 'pokeprice' ? 'pokeprice' : 'estimated'
          }
        };
      }
      
      // Calculate value ratio
      const ratio = Math.min(card1Price, card2Price) / Math.max(card1Price, card2Price);
      const percentage = ratio * 100;
      
      // Calculate score based on tolerance
      let score: number;
      if (percentage >= valueTolerance) {
        score = 100;
      } else if (percentage >= valueTolerance - 30) {
        score = 70 + ((percentage - (valueTolerance - 30)) / 30) * 30;
      } else {
        score = Math.max(30, percentage / (valueTolerance - 30) * 70);
      }
      
      return { 
        score, 
        pricing: { 
          card1Price, 
          card2Price, 
          source: priceSource === 'pokemon_tcg' ? 'pokemon_tcg' : 'estimated'
        } 
      };
    } catch (error) {
      console.error('Error calculating value score:', error);
      return { 
        score: 50, 
        pricing: { 
          card1Price: parseFloat(card1.market_price) || 0, 
          card2Price: parseFloat(card2.market_price) || 0, 
          source: 'estimated' 
        } 
      };
    }
  }

  // Calculate condition compatibility
  private calculateConditionScore(condition1: string, condition2: string): number {
    const conditionRanks = {
      'Mint': 6,
      'Near Mint': 5,
      'Lightly Played': 4,
      'Moderately Played': 3,
      'Heavily Played': 2,
      'Damaged': 1
    };

    const rank1 = conditionRanks[condition1 as keyof typeof conditionRanks] || 3;
    const rank2 = conditionRanks[condition2 as keyof typeof conditionRanks] || 3;
    
    const difference = Math.abs(rank1 - rank2);
    
    // More lenient condition scoring
    if (difference === 0) return 100;
    if (difference === 1) return 85;
    if (difference === 2) return 70;
    return Math.max(50, 70 - (difference - 2) * 15);
  }

  // Calculate rarity/demand score based on card name and set
  private calculateRarityScore(cardName: string, setName: string, cardPrice: number = 0): number {
    const highValueKeywords = [
      'charizard', 'pikachu', 'mewtwo', 'mew', 'lugia', 'ho-oh',
      'rayquaza', 'dialga', 'palkia', 'arceus', 'reshiram', 'zekrom',
      'blastoise', 'venusaur', 'alakazam', 'machamp', 'gyarados'
    ];

    const valuableSets = [
      'base set', 'jungle', 'fossil', 'team rocket', 'gym heroes',
      'neo genesis', 'neo discovery', 'expedition', 'aquapolis',
      'skyridge', 'ex ruby', 'ex sapphire'
    ];

    const cardNameLower = cardName.toLowerCase();
    const setNameLower = setName.toLowerCase();

    let score = 60; // Higher base score

    // Check for high-value Pokemon
    for (const keyword of highValueKeywords) {
      if (cardNameLower.includes(keyword)) {
        score += 25;
        break;
      }
    }

    // Check for valuable sets
    for (const set of valuableSets) {
      if (setNameLower.includes(set)) {
        score += 15;
        break;
      }
    }

    // Check for special card types
    if (cardNameLower.includes('ex') || cardNameLower.includes('gx') || 
        cardNameLower.includes('v') || cardNameLower.includes('vmax')) {
      score += 20;
    }

    // Check for holographic indicators
    if (cardNameLower.includes('holo') || cardNameLower.includes('shiny') || 
        cardNameLower.includes('secret') || cardNameLower.includes('rainbow')) {
      score += 10;
    }

    // Factor in price as an indicator of rarity/demand
    if (cardPrice > 200) score += 15;
    else if (cardPrice > 100) score += 10;
    else if (cardPrice > 50) score += 5;

    return Math.min(100, score);
  }

  // Calculate user reputation score
  private calculateUserReputationScore(user: any): number {
    if (!user) return 70; // Higher default

    let score = 70; // Higher base score

    // Factor in total trades
    if (user.total_trades > 50) score += 20;
    else if (user.total_trades > 20) score += 15;
    else if (user.total_trades > 10) score += 10;
    else if (user.total_trades > 5) score += 5;

    // Factor in success rate
    if (user.match_success_rate > 95) score += 15;
    else if (user.match_success_rate > 90) score += 12;
    else if (user.match_success_rate > 80) score += 8;
    else if (user.match_success_rate > 70) score += 5;

    // Factor in reputation score
    if (user.reputation_score > 4.8) score += 10;
    else if (user.reputation_score > 4.5) score += 8;
    else if (user.reputation_score > 4.0) score += 5;

    return Math.min(100, score);
  }

  // Calculate mutual benefit score (how well the trade satisfies both users' wants)
  private calculateMutualBenefitScore(
    user1WantsUser2Card: boolean,
    user2WantsUser1Card: boolean,
    user1CardPrice: number,
    user2CardPrice: number,
    user1Tolerance: number,
    user2Tolerance: number
  ): number {
    // Base score for mutual interest
    let score = 0;
    
    if (user1WantsUser2Card && user2WantsUser1Card) {
      // Perfect mutual match
      score = 80;
      
      // Calculate value compatibility for both users
      const user1ValueRatio = user2CardPrice / user1CardPrice * 100;
      const user2ValueRatio = user1CardPrice / user2CardPrice * 100;
      
      // Check if both users' value tolerances are satisfied
      const user1Satisfied = user1ValueRatio >= user1Tolerance;
      const user2Satisfied = user2ValueRatio >= user2Tolerance;
      
      if (user1Satisfied && user2Satisfied) {
        // Both users get full value satisfaction
        score += 20;
      } else if (user1Satisfied || user2Satisfied) {
        // One user gets full value satisfaction
        score += 10;
      }
    } else if (user1WantsUser2Card || user2WantsUser1Card) {
      // One-sided interest
      score = 40;
    }
    
    return score;
  }

  // Find enhanced matches with more sophisticated criteria
  async findEnhancedMatches(criteria: MatchingCriteria): Promise<EnhancedMatch[]> {
    try {
      console.log('🔍 Finding enhanced matches for user:', criteria.userId);

      // Get user's profile for tolerance settings
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', criteria.userId)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching user profile:', profileError);
      }

      console.log('👤 User profile:', userProfile?.username || 'Unknown');

      // Get user's cards
      const { data: userCards, error: userCardsError } = await supabase
        .from('cards')
        .select('*')
        .eq('user_id', criteria.userId);

      if (userCardsError) {
        console.error('Error fetching user cards:', userCardsError);
        return [];
      }

      // Separate trade and want cards
      const userTradeCards = userCards?.filter(c => c.list_type === 'trade') || [];
      const userWantCards = userCards?.filter(c => c.list_type === 'want') || [];

      console.log('📦 User trade cards:', userTradeCards.length);
      console.log('🎯 User want cards:', userWantCards.length);

      // Check prerequisites
      if (!userTradeCards.length || !userWantCards.length) {
        console.log('Missing required cards for enhanced matching');
        return [];
      }

      // Get all other users and their cards
      const { data: otherUsersData, error: usersError } = await supabase
        .from('users')
        .select(`
          *,
          cards!cards_user_id_fkey(*)
        `)
        .neq('id', criteria.userId);

      if (usersError) {
        console.error('Error fetching other users:', usersError);
        return [];
      }

      console.log('👥 Other users found:', otherUsersData?.length || 0);

      if (!otherUsersData?.length) {
        console.log('No other users found in the system.');
        return [];
      }

      const potentialMatches: EnhancedMatch[] = [];

      // Process each other user with their cards
      for (const otherUser of otherUsersData) {
        try {
          console.log(`\n🔍 Checking user: ${otherUser.username} (${otherUser.id})`);

          const otherUserCards = otherUser.cards || [];
          
          if (!otherUserCards.length) {
            console.log(`  ❌ ${otherUser.username} has no cards`);
            continue;
          }

          // Separate their trade and want cards
          const otherUserTradeCards = otherUserCards.filter((c: any) => c.list_type === 'trade');
          const otherUserWantCards = otherUserCards.filter((c: any) => c.list_type === 'want');

          console.log(`  📦 ${otherUser.username} has ${otherUserTradeCards.length} trade cards, ${otherUserWantCards.length} want cards`);

          if (!otherUserTradeCards.length || !otherUserWantCards.length) {
            console.log(`  ❌ ${otherUser.username} missing trade or want cards`);
            continue;
          }

          // Find mutual matches with enhanced criteria
          for (const userTradeCard of userTradeCards) {
            // Check if other user wants this card
            const otherUserWantsThis = otherUserWantCards.some((wantCard: any) => 
              this.cardsMatchLoose(wantCard, userTradeCard)
            );

            if (!otherUserWantsThis) continue;

            // Check what the other user has that we want
            for (const otherTradeCard of otherUserTradeCards) {
              const userWantsThis = userWantCards.some(wantCard => 
                this.cardsMatchLoose(wantCard, otherTradeCard)
              );

              if (!userWantsThis) continue;

              // Calculate enhanced scores with loosened criteria
              const valueResult = await this.calculateValueScore(
                userTradeCard,
                otherTradeCard,
                criteria.valueTolerance || 100  // Default to 100% tolerance
              );

              const conditionScore = this.calculateConditionScore(
                userTradeCard.condition || 'Near Mint',
                otherTradeCard.condition || 'Near Mint'
              );

              const userCardRarityScore = this.calculateRarityScore(
                userTradeCard.name || '',
                userTradeCard.set || '',
                valueResult.pricing.card1Price
              );

              const otherCardRarityScore = this.calculateRarityScore(
                otherTradeCard.name || '',
                otherTradeCard.set || '',
                valueResult.pricing.card2Price
              );

              const rarityScore = (userCardRarityScore + otherCardRarityScore) / 2;
              const userReputationScore = this.calculateUserReputationScore(otherUser);

              // Calculate mutual benefit score
              const mutualBenefitScore = this.calculateMutualBenefitScore(
                userWantsThis,
                otherUserWantsThis,
                valueResult.pricing.card1Price,
                valueResult.pricing.card2Price,
                userProfile?.trade_percentage_min || 100,
                otherUser?.trade_percentage_min || 100
              );

              // Calculate overall match score with adjusted weighting for testing
              const overallScore = Math.round(
                (valueResult.score * 0.25) +        // Reduced weight on value
                (mutualBenefitScore * 0.30) +       // Increased weight on mutual benefit
                (conditionScore * 0.15) +           // Reduced weight on condition
                (rarityScore * 0.15) +              // Reduced weight on rarity
                (userReputationScore * 0.15)        // Reduced weight on reputation
              );

              // Apply very loose minimum score filter for testing
              if (overallScore < (criteria.minMatchScore || 10)) continue;

              // FIXED: Calculate the actual value difference correctly
              const valueDifference = Math.abs(
                valueResult.pricing.card1Price - valueResult.pricing.card2Price
              );

              console.log(`   💰 Value difference calculation: |${valueResult.pricing.card1Price} - ${valueResult.pricing.card2Price}| = ${valueDifference.toFixed(2)}`);

              // Apply very loose maximum value difference filter
              if (criteria.maxValueDifference && valueDifference > criteria.maxValueDifference) {
                continue;
              }

              const tradeScore: TradeScore = {
                valueScore: valueResult.score,
                conditionScore,
                rarityScore,
                demandScore: rarityScore,
                userReputationScore,
                mutualBenefitScore,
                overallScore
              };

              // More lenient confidence levels for testing
              let confidence: 'high' | 'medium' | 'low' = 'low';
              if (overallScore >= 70 && mutualBenefitScore >= 60) confidence = 'high';
              else if (overallScore >= 50 && mutualBenefitScore >= 40) confidence = 'medium';

              const match: EnhancedMatch = {
                id: `match-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                user1_id: criteria.userId,
                user2_id: otherUser.id,
                user1_card_id: userTradeCard.id,
                user2_card_id: otherTradeCard.id,
                match_score: overallScore,
                value_difference: valueDifference,
                mutual_benefit_score: mutualBenefitScore,
                trade_score: tradeScore,
                confidence,
                status: 'pending',
                created_at: new Date().toISOString(),
                user1: userProfile,
                user2: otherUser,
                user1_card: userTradeCard,
                user2_card: otherTradeCard,
                pricing_data: {
                  user1_card_price: valueResult.pricing.card1Price,
                  user2_card_price: valueResult.pricing.card2Price,
                  price_source: valueResult.pricing.source
                }
              };

              potentialMatches.push(match);

              console.log(`Enhanced match found: ${userTradeCard.name} <-> ${otherTradeCard.name} (Score: ${overallScore}, Mutual: ${mutualBenefitScore})`);
            }
          }
        } catch (userError) {
          console.error(`Error processing user ${otherUser.id}:`, userError);
          continue;
        }
      }

      console.log('Total enhanced matches found:', potentialMatches.length);

      // Sort by overall score and mutual benefit
      const sortedMatches = potentialMatches
        .sort((a, b) => {
          // Primary sort by overall score
          if (b.match_score !== a.match_score) {
            return b.match_score - a.match_score;
          }
          // Secondary sort by mutual benefit
          return b.mutual_benefit_score! - a.mutual_benefit_score!;
        })
        .slice(0, 50); // Limit to top 50 matches

      console.log('Returning top enhanced matches:', sortedMatches.length);
      return sortedMatches;

    } catch (error) {
      console.error('Error finding enhanced matches:', error);
      throw error;
    }
  }

  // Very loose card matching for testing
  private cardsMatchLoose(card1: any, card2: any): boolean {
    if (!card1.name || !card2.name) return false;
    
    const name1 = card1.name.toLowerCase().trim();
    const name2 = card2.name.toLowerCase().trim();
    
    // Exact match
    if (name1 === name2) return true;
    
    // Very loose fuzzy match for testing
    const similarity = this.calculateStringSimilarity(name1, name2);
    return similarity > 0.7; // Lowered from 0.85 to 0.7 for more matches
  }

  // Calculate string similarity using Levenshtein distance
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  // Levenshtein distance calculation
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  // Save enhanced matches to database
  async saveEnhancedMatches(matches: EnhancedMatch[]): Promise<void> {
    try {
      const { supabase } = await import('../lib/supabase');

      if (!matches.length) {
        console.log('No enhanced matches to save');
        return;
      }

      // Clear existing matches for the user
      const userId = matches[0]?.user1_id;
      if (userId) {
        const { error: deleteError } = await supabase
          .from('matches')
          .delete()
          .eq('user1_id', userId);

        if (deleteError) {
          console.error('Error clearing existing matches:', deleteError);
        }
      }

      // Insert new enhanced matches
      const matchesToInsert = matches.map(match => ({
        user1_id: match.user1_id,
        user2_id: match.user2_id,
        user1_card_id: match.user1_card_id,
        user2_card_id: match.user2_card_id,
        match_score: match.match_score,
        value_difference: match.value_difference,
        status: 'pending',
        created_at: new Date().toISOString()
      }));

      console.log('Saving enhanced matches to database:', matchesToInsert.length);

      const { error } = await supabase
        .from('matches')
        .insert(matchesToInsert);

      if (error) {
        console.error('Error saving enhanced matches:', error);
        throw error;
      }

      console.log('Enhanced matches saved successfully');

    } catch (error) {
      console.error('Error saving enhanced matches:', error);
      throw error;
    }
  }

  // Generate and save enhanced matches with loosened criteria
  async generateEnhancedMatches(userId: string, options?: {
    maxValueDifference?: number;
    minMatchScore?: number;
    valueTolerance?: number;
  }): Promise<EnhancedMatch[]> {
    console.log('Generating enhanced matches with loosened criteria for user:', userId);

    const criteria: MatchingCriteria = {
      userId,
      maxValueDifference: options?.maxValueDifference || 1000,  // Very high for testing
      minMatchScore: options?.minMatchScore || 10,              // Very low for testing
      valueTolerance: options?.valueTolerance || 100            // 100% tolerance for testing
    };

    console.log('Using loosened criteria:', criteria);

    const matches = await this.findEnhancedMatches(criteria);
    
    if (matches.length > 0) {
      await this.saveEnhancedMatches(matches);
    } else {
      console.log('No enhanced matches found to save');
    }

    return matches;
  }
}

export const enhancedMatchingService = new EnhancedMatchingService();
export type { MatchingCriteria, TradeScore, EnhancedMatch };