import { supabase } from '../lib/supabase';

// Add UUID generation function at the top
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

interface MatchingCriteria {
  userId: string;
  maxValueDifference?: number;
  minMatchScore?: number;
  preferredConditions?: string[];
  excludeUsers?: string[];
  onProgress?: (progress: number, status: string) => void;
}

interface TradeScore {
  valueScore: number;
  conditionScore: number;
  rarityScore: number;
  demandScore: number;
  userReputationScore: number;
  overallScore: number;
}

interface PotentialMatch {
  id: string;
  user1_id: string;
  user2_id: string;
  user1_card_ids: string[];  // Changed to array
  user2_card_ids: string[];  // Changed to array
  match_score: number;
  value_difference: number;
  trade_score: TradeScore;
  confidence: 'high' | 'medium' | 'low';
  status: 'pending' | 'accepted' | 'declined' | 'completed';
  created_at: string;
  is_bundle: boolean;  // New field to indicate bundle trades
  // Joined data
  user1?: any;
  user2?: any;
  user1_cards?: any[];  // Changed to array
  user2_cards?: any[];  // Changed to array
}

class MatchingService {
  private cardMatchCache: Map<string, Set<string>> = new Map();
  private static readonly BATCH_SIZE = 50;
  private static readonly CHUNK_SIZE = 10;

  // Calculate value compatibility between two cards
  private calculateValueScore(card1Price: number, card2Price: number, userTolerance: number = 80): number {
    if (card1Price === 0 || card2Price === 0) return 50; // Base score for zero prices
    
    const ratio = Math.min(card1Price, card2Price) / Math.max(card1Price, card2Price);
    const percentage = ratio * 100;
    
    // More lenient scoring for better matches
    if (percentage >= userTolerance) {
      return 100;
    } else if (percentage >= userTolerance - 30) {
      return 70 + ((percentage - (userTolerance - 30)) / 30) * 30;
    } else {
      return Math.max(30, percentage / (userTolerance - 30) * 70);
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
  private calculateRarityScore(cardName: string, setName: string): number {
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

  // Helper method to check if cards match (name-based with fuzzy matching)
  private cardsMatch(card1: any, card2: any): boolean {
    if (!card1.name || !card2.name) return false;
    
    const name1 = card1.name.toLowerCase().trim();
    const name2 = card2.name.toLowerCase().trim();
    
    // Exact match
    if (name1 === name2) return true;
    
    // Fuzzy match (more lenient)
    const similarity = this.calculateStringSimilarity(name1, name2);
    return similarity > 0.75; // Lowered threshold for more matches
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

  // Pre-compute card matches for faster lookup
  private buildCardMatchCache(userCards: any[], otherCards: any[]): void {
    this.cardMatchCache.clear();
    for (const userCard of userCards) {
      const matches = new Set<string>();
      for (const otherCard of otherCards) {
        if (this.cardsMatch(userCard, otherCard)) {
          matches.add(otherCard.id);
        }
      }
      this.cardMatchCache.set(userCard.id, matches);
    }
  }

  // Check if cards match using cache
  private isCardMatch(card1Id: string, card2Id: string): boolean {
    return this.cardMatchCache.get(card1Id)?.has(card2Id) || false;
  }

  // Process a chunk of users asynchronously
  private async processUserChunk(
    chunk: any[],
    userProfile: any,
    userTradeCards: any[],
    userWantCards: any[],
    criteria: MatchingCriteria
  ): Promise<PotentialMatch[]> {
    const matches: PotentialMatch[] = [];

    for (const otherUser of chunk) {
      try {
        const otherUserCards = otherUser.cards || [];
        if (!otherUserCards.length) continue;

        const otherUserTradeCards = otherUserCards.filter((c: any) => c.list_type === 'trade');
        const otherUserWantCards = otherUserCards.filter((c: any) => c.list_type === 'want');

        if (!otherUserTradeCards.length || !otherUserWantCards.length) continue;

        // Build card match cache for this user pair
        this.buildCardMatchCache(userWantCards, otherUserTradeCards);
        this.buildCardMatchCache(otherUserWantCards, userTradeCards);

        // Process single card trades
        for (const userTradeCard of userTradeCards) {
          const userCardValue = parseFloat(userTradeCard.market_price) || 0;

          // Check if other user wants this card using cache
          const otherUserWantsThis = otherUserWantCards.some((wantCard: any) => 
            this.isCardMatch(wantCard.id, userTradeCard.id)
          );

          if (!otherUserWantsThis) continue;

          for (const otherTradeCard of otherUserTradeCards) {
            const userWantsThis = userWantCards.some(wantCard => 
              this.isCardMatch(wantCard.id, otherTradeCard.id)
            );

            if (!userWantsThis) continue;

            // Calculate scores and create match
            const valueScore = this.calculateValueScore(
              userCardValue,
              parseFloat(otherTradeCard.market_price) || 0,
              userProfile?.trade_percentage_min || 80
            );

            const conditionScore = this.calculateConditionScore(
              userTradeCard.condition || 'Near Mint',
              otherTradeCard.condition || 'Near Mint'
            );

            const userCardRarityScore = this.calculateRarityScore(
              userTradeCard.name || '',
              userTradeCard.set || ''
            );

            const otherCardRarityScore = this.calculateRarityScore(
              otherTradeCard.name || '',
              otherTradeCard.set || ''
            );

            const rarityScore = (userCardRarityScore + otherCardRarityScore) / 2;
            const userReputationScore = this.calculateUserReputationScore(otherUser);

            // Calculate overall match score with optimized weighting
            const overallScore = Math.round(
              (valueScore * 0.30) +           // 30% weight on value compatibility
              (conditionScore * 0.25) +       // 25% weight on condition compatibility
              (rarityScore * 0.25) +          // 25% weight on card rarity/demand
              (userReputationScore * 0.20)    // 20% weight on user reputation
            );

            // Apply minimum score filter (lowered for production)
            if (overallScore < (criteria.minMatchScore || 50)) {
              continue;
            }

            // FIXED: Calculate the actual value difference correctly
            const userCardPrice = parseFloat(userTradeCard.market_price) || 0;
            const otherCardPrice = parseFloat(otherTradeCard.market_price) || 0;
            const valueDifference = Math.abs(userCardPrice - otherCardPrice);

            // Apply maximum value difference filter
            if (criteria.maxValueDifference && valueDifference > criteria.maxValueDifference) {
              continue;
            }

            const tradeScore: TradeScore = {
              valueScore,
              conditionScore,
              rarityScore,
              demandScore: rarityScore,
              userReputationScore,
              overallScore
            };

            // Determine confidence level (more lenient)
            let confidence: 'high' | 'medium' | 'low' = 'low';
            if (overallScore >= 80) confidence = 'high';
            else if (overallScore >= 65) confidence = 'medium';

            const matchId = `match-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            const match: PotentialMatch = {
              id: matchId,
              user1_id: criteria.userId,
              user2_id: otherUser.id,
              user1_card_ids: [userTradeCard.id],  // Changed to array
              user2_card_ids: [otherTradeCard.id],  // Changed to array
              match_score: overallScore,
              value_difference: valueDifference,
              trade_score: tradeScore,
              confidence,
              status: 'pending',
              created_at: new Date().toISOString(),
              user1: userProfile,
              user2: otherUser,
              user1_cards: [userTradeCard],  // Changed to array
              user2_cards: [otherTradeCard],   // Changed to array
              is_bundle: false
            };

            matches.push(match);
          }
        }

        // Bundle trade logic: your 1 card for their 2-4 cards
        for (const userTradeCard of userTradeCards) {
          const userCardValue = parseFloat(userTradeCard.market_price) || 0;
          // Find bundles of other user's trade cards that match this value
          const bundles = this.findCardCombinations(otherUserTradeCards, userCardValue, 0.2);
          for (const bundle of bundles) {
            if (bundle.length < 2) continue; // Only bundles (2+ cards)
            // All cards in bundle must be wanted by the user
            const allWanted = bundle.every(card => userWantCards.some(wantCard => this.cardsMatch(wantCard, card)));
            if (!allWanted) continue;
            // All cards in bundle must not be the same as the user's card
            if (bundle.some(card => card.id === userTradeCard.id)) continue;
            // Calculate bundle value
            const bundleValue = bundle.reduce((sum, card) => sum + (parseFloat(card.market_price) || 0), 0);
            // Calculate scores
            const valueScore = this.calculateValueScore(userCardValue, bundleValue, userProfile?.trade_percentage_min || 80);
            const bundleConditionScore = bundle.reduce((sum, card) => sum + this.calculateConditionScore(userTradeCard.condition || 'Near Mint', card.condition || 'Near Mint'), 0) / bundle.length;
            const bundleScore = this.calculateBundleScore(bundle);
            const userReputationScore = this.calculateUserReputationScore(otherUser);
            const overallScore = Math.round(
              (valueScore * 0.30) +
              (bundleConditionScore * 0.25) +
              (bundleScore * 0.25) +
              (userReputationScore * 0.20)
            );
            if (overallScore < (criteria.minMatchScore || 50)) continue;
            const valueDifference = Math.abs(userCardValue - bundleValue);
            if (criteria.maxValueDifference && valueDifference > criteria.maxValueDifference) continue;
            let confidence: 'high' | 'medium' | 'low' = 'low';
            if (overallScore >= 80) confidence = 'high';
            else if (overallScore >= 65) confidence = 'medium';
            const matchId = `bundle-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const match: PotentialMatch = {
              id: matchId,
              user1_id: criteria.userId,
              user2_id: otherUser.id,
              user1_card_ids: [userTradeCard.id],
              user2_card_ids: bundle.map(card => card.id),
              match_score: overallScore,
              value_difference: valueDifference,
              trade_score: {
                valueScore,
                conditionScore: bundleConditionScore,
                rarityScore: bundleScore,
                demandScore: bundleScore,
                userReputationScore,
                overallScore
              },
              confidence,
              status: 'pending',
              created_at: new Date().toISOString(),
              user1: userProfile,
              user2: otherUser,
              user1_cards: [userTradeCard],
              user2_cards: bundle,
              is_bundle: true
            };
            matches.push(match);
          }
        }

        // --- NEW: Bundle trade logic: your BUNDLE for their 1 card ---
        for (const otherTradeCard of otherUserTradeCards) {
          const otherCardValue = parseFloat(otherTradeCard.market_price) || 0;
          // Find bundles of your trade cards that match this value
          const myBundles = this.findCardCombinations(userTradeCards, otherCardValue, 0.2);
          for (const myBundle of myBundles) {
            if (myBundle.length < 2) continue; // Only bundles (2+ cards)
            // All cards in bundle must be wanted by the other user
            const allWanted = myBundle.every(card => otherUserWantCards.some((wantCard: any) => this.cardsMatch(wantCard, card)));
            if (!allWanted) continue;
            // All cards in bundle must not be the same as the other user's card
            if (myBundle.some(card => card.id === otherTradeCard.id)) continue;
            // Calculate bundle value
            const myBundleValue = myBundle.reduce((sum, card) => sum + (parseFloat(card.market_price) || 0), 0);
            // Calculate scores
            const valueScore = this.calculateValueScore(myBundleValue, otherCardValue, userProfile?.trade_percentage_min || 80);
            const bundleConditionScore = myBundle.reduce((sum, card) => sum + this.calculateConditionScore(card.condition || 'Near Mint', otherTradeCard.condition || 'Near Mint'), 0) / myBundle.length;
            const bundleScore = this.calculateBundleScore(myBundle);
            const userReputationScore = this.calculateUserReputationScore(otherUser);
            const overallScore = Math.round(
              (valueScore * 0.30) +
              (bundleConditionScore * 0.25) +
              (bundleScore * 0.25) +
              (userReputationScore * 0.20)
            );
            if (overallScore < (criteria.minMatchScore || 50)) continue;
            const valueDifference = Math.abs(myBundleValue - otherCardValue);
            if (criteria.maxValueDifference && valueDifference > criteria.maxValueDifference) continue;
            let confidence: 'high' | 'medium' | 'low' = 'low';
            if (overallScore >= 80) confidence = 'high';
            else if (overallScore >= 65) confidence = 'medium';
            const matchId = `bundle-rev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const match: PotentialMatch = {
              id: matchId,
              user1_id: criteria.userId,
              user2_id: otherUser.id,
              user1_card_ids: myBundle.map(card => card.id),
              user2_card_ids: [otherTradeCard.id],
              match_score: overallScore,
              value_difference: valueDifference,
              trade_score: {
                valueScore,
                conditionScore: bundleConditionScore,
                rarityScore: bundleScore,
                demandScore: bundleScore,
                userReputationScore,
                overallScore
              },
              confidence,
              status: 'pending',
              created_at: new Date().toISOString(),
              user1: userProfile,
              user2: otherUser,
              user1_cards: myBundle,
              user2_cards: [otherTradeCard],
              is_bundle: true
            };
            matches.push(match);
          }
        }
      } catch (userError) {
        console.error(`Error processing user ${otherUser.id}:`, userError);
        continue;
      }
    }

    return matches;
  }

  // Find all possible card combinations within a target value range
  private findCardCombinations(cards: any[], targetValue: number, tolerance: number = 0.2): any[][] {
    const combinations: any[][] = [];
    const maxDiff = targetValue * tolerance;
    
    const findCombos = (start: number, currentCombo: any[], currentValue: number) => {
      // Check if current combination is within range
      if (currentValue > 0 && Math.abs(targetValue - currentValue) <= maxDiff) {
        combinations.push([...currentCombo]);
      }
      
      // Don't go beyond 4 cards in a bundle
      if (currentCombo.length >= 4) return;
      
      // Try adding more cards
      for (let i = start; i < cards.length; i++) {
        const card = cards[i];
        const cardValue = parseFloat(card.market_price) || 0;
        if (currentValue + cardValue <= targetValue + maxDiff) {
          findCombos(i + 1, [...currentCombo, card], currentValue + cardValue);
        }
      }
    };
    
    findCombos(0, [], 0);
    return combinations;
  }

  // Find possible bundles within a value range
  private findCardBundles(cards: any[], targetValue: number, tolerance: number = 0.2): any[] {
    const bundles: any[] = [];
    const maxDiff = targetValue * tolerance;
    
    const findCombos = (start: number, current: any[], currentValue: number) => {
      // Check if current combination is within range
      if (currentValue > 0 && Math.abs(targetValue - currentValue) <= maxDiff) {
        bundles.push({
          cards: [...current],
          totalValue: currentValue
        });
      }
      
      // Limit bundle size to 4 cards
      if (current.length >= 4) return;
      
      // Try adding more cards
      for (let i = start; i < cards.length; i++) {
        const card = cards[i];
        const cardValue = parseFloat(card.market_price) || 0;
        if (currentValue + cardValue <= targetValue + maxDiff) {
          findCombos(i + 1, [...current, card], currentValue + cardValue);
        }
      }
    };
    
    findCombos(0, [], 0);
    return bundles;
  }

  // Calculate bundle synergy score
  private calculateBundleScore(cards: any[]): number {
    if (cards.length <= 1) return 100;
    
    let score = 100;
    
    // Small penalty for larger bundles
    score -= (cards.length - 1) * 5;
    
    // Check for set completion or synergies
    const setGroups = cards.reduce((acc: { [key: string]: number }, card: any) => {
      acc[card.set] = (acc[card.set] || 0) + 1;
      return acc;
    }, {});
    
    // Bonus for cards from the same set
    Object.values(setGroups).forEach((count: number) => {
      if (count > 1) score += 5 * count;
    });
    
    return Math.min(100, Math.max(60, score));
  }

  // Main matching algorithm with optimized async processing
  async findMatches(criteria: MatchingCriteria): Promise<PotentialMatch[]> {
    try {
      const { userId, onProgress } = criteria;
      onProgress?.(0, 'Initializing match finding...');

      // Get user's profile
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching user profile:', profileError);
        return [];
      }

      onProgress?.(5, 'Fetching user cards...');

      // Get user's cards
      const { data: userCards, error: userCardsError } = await supabase
        .from('cards')
        .select('*')
        .eq('user_id', userId);

      if (userCardsError) {
        console.error('Error fetching user cards:', userCardsError);
        return [];
      }

      const userTradeCards = userCards?.filter(c => c.list_type === 'trade') || [];
      const userWantCards = userCards?.filter(c => c.list_type === 'want') || [];

      if (!userTradeCards.length || !userWantCards.length) {
        onProgress?.(100, 'No cards available for matching');
        return [];
      }

      onProgress?.(10, 'Processing other users...');

      // Fetch users in batches
      const allMatches: PotentialMatch[] = [];
      let lastUserId = null;
      let processedUsers = 0;
      let totalUsers = 0;

      // First, get total count
      const { count } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .neq('id', userId);

      totalUsers = count || 0;

      while (true) {
        // Fetch next batch of users
        let query = supabase
          .from('users')
          .select(`
            *,
            cards!cards_user_id_fkey(*)
          `)
          .neq('id', userId)
          .limit(this.BATCH_SIZE)
          .order('id');

        // Only apply gt filter if lastUserId is not null
        if (lastUserId) {
          query = query.gt('id', lastUserId);
        }

        const { data: batch, error: batchError } = await query;

        if (batchError || !batch?.length) break;

        // Process users in chunks
        const chunks = [];
        for (let i = 0; i < batch.length; i += this.CHUNK_SIZE) {
          chunks.push(batch.slice(i, i + this.CHUNK_SIZE));
        }

        // Process chunks in parallel
        const chunkResults = await Promise.all(
          chunks.map(chunk => this.processUserChunk(
            chunk,
            userProfile,
            userTradeCards,
            userWantCards,
            criteria
          ))
        );

        allMatches.push(...chunkResults.flat());

        processedUsers += batch.length;
        lastUserId = batch[batch.length - 1].id;

        // Update progress
        const progress = Math.min(10 + (processedUsers / totalUsers * 80), 90);
        onProgress?.(progress, `Processed ${processedUsers} of ${totalUsers} users...`);
      }

      onProgress?.(95, 'Finalizing matches...');

      // Sort and limit results
      const sortedMatches = allMatches
        .sort((a, b) => b.match_score - a.match_score)
        .slice(0, 50);

      onProgress?.(100, 'Match finding complete');

      return sortedMatches;

    } catch (error) {
      console.error('❌ Error finding matches:', error);
      onProgress?.(100, 'Error finding matches');
      return [];
    }
  }

  // Save matches to database with error handling
  async saveMatches(matches: PotentialMatch[]): Promise<void> {
    try {
      if (!matches.length) {
        console.log('No matches to save');
        return;
      }

      // Get all existing matches for this user from the DB
      const userId = matches[0]?.user1_id;
      let existingMatches: any[] = [];
      if (userId) {
        const { data: dbMatches, error: fetchError } = await supabase
          .from('matches')
          .select('user1_id, user2_id, user1_card_id, user2_card_id, user1_card_ids, user2_card_ids, is_bundle')
          .eq('user1_id', userId);
        if (fetchError) {
          console.error('Error fetching existing matches:', fetchError);
        } else {
          existingMatches = dbMatches || [];
        }
      }

      // Helper to check if a match is a duplicate (supports bundles)
      const isDuplicate = (match: PotentialMatch) => {
        return existingMatches.some(existing => {
          if (match.is_bundle || existing.is_bundle) {
            // Compare sorted arrays as strings
            const m1 = Array.isArray(match.user1_card_ids) ? match.user1_card_ids.slice().sort().join(',') : String(match.user1_card_ids);
            const m2 = Array.isArray(match.user2_card_ids) ? match.user2_card_ids.slice().sort().join(',') : String(match.user2_card_ids);
            const e1 = Array.isArray(existing.user1_card_ids) ? existing.user1_card_ids.slice().sort().join(',') : String(existing.user1_card_ids);
            const e2 = Array.isArray(existing.user2_card_ids) ? existing.user2_card_ids.slice().sort().join(',') : String(existing.user2_card_ids);
            return (
              existing.user1_id === match.user1_id &&
              existing.user2_id === match.user2_id &&
              ((m1 === e1 && m2 === e2) || (m1 === e2 && m2 === e1))
            );
          } else {
            // Single trades
            return (
              existing.user1_id === match.user1_id &&
              existing.user2_id === match.user2_id &&
              existing.user1_card_id === match.user1_card_ids[0] &&
              existing.user2_card_id === match.user2_card_ids[0]
            );
          }
        });
      };

      // Filter out duplicates
      const uniqueMatches = matches.filter(match => !isDuplicate(match));

      if (!uniqueMatches.length) {
        console.log('No new unique matches to save');
        return;
      }

      // Process matches in batches to avoid overwhelming the database
      const batchSize = 50;
      for (let i = 0; i < uniqueMatches.length; i += batchSize) {
        const batch = uniqueMatches.slice(i, i + batchSize).map(match => {
          // Generate UUID for both regular and bundle matches
          const matchId = generateUUID();
          
          return {
            id: matchId,
            user1_id: match.user1_id,
            user2_id: match.user2_id,
            user1_card_ids: match.user1_card_ids,
            user2_card_ids: match.user2_card_ids,
            match_score: match.match_score,
            value_difference: match.value_difference,
            trade_score: match.trade_score,
            status: match.status,
            created_at: new Date().toISOString(),
            is_bundle: match.is_bundle
          };
        });

        const { error } = await supabase
          .from('matches')
          .insert(batch);

        if (error) throw error;
      }
      console.log(`✅ Successfully saved ${uniqueMatches.length} new matches`);
    } catch (error) {
      console.error('❌ Error saving matches:', error);
    }
  }

  // Generate matches for a user and save them
  async generateAndSaveMatches(userId: string, options?: {
    maxValueDifference?: number;
    minMatchScore?: number;
    preferredConditions?: string[];
  }): Promise<PotentialMatch[]> {
    console.log('🚀 Generating production matches for user:', userId);

    const criteria: MatchingCriteria = {
      userId,
      maxValueDifference: options?.maxValueDifference || 500,  // More flexible
      minMatchScore: options?.minMatchScore || 50,             // Lower threshold
      preferredConditions: options?.preferredConditions
    };

    const matches = await this.findMatches(criteria);
    
    if (matches.length > 0) {
      await this.saveMatches(matches);
    } else {
      console.log('❌ No matches found to save');
    }

    return matches;
  }

  // Advanced matching with machine learning-like scoring
  async findAdvancedMatches(userId: string): Promise<PotentialMatch[]> {
    console.log('🧠 Finding advanced matches for user:', userId);
    
    const matches = await this.generateAndSaveMatches(userId, {
      maxValueDifference: 200, // Stricter value matching
      minMatchScore: 65,       // Higher quality matches only
    });

    // Apply additional filtering for advanced users
    return matches.filter(match => {
      // Prioritize high-confidence matches
      if (match.confidence === 'high') return true;
      
      // Include medium confidence if other factors are strong
      if (match.confidence === 'medium' && 
          match.trade_score.userReputationScore > 75) return true;
      
      return false;
    });
  }
}

export const matchingService = new MatchingService();
export type { MatchingCriteria, TradeScore, PotentialMatch };