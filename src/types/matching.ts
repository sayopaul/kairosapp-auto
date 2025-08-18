export interface MatchingCriteria {
  userId: string;
  maxValueDifference?: number;
  minMatchScore?: number;
  preferredConditions?: string[];
  excludeUsers?: string[];
  enableBundles?: boolean;
}

export interface TradeScore {
  valueScore: number;
  conditionScore: number;
  rarityScore: number;
  demandScore: number;
  userReputationScore: number;
  overallScore: number;
}

export interface CardBundle {
  cards: any[];
  totalValue: number;
}

export interface TradeMatch {
  id: string;
  user1_id: string;
  user2_id: string;
  user1_card_id?: string;
  user2_card_id?: string;
  user1_card_ids: string[];
  user2_card_ids: string[];
  match_score: number;
  value_difference: number;
  status: 'pending' | 'accepted' | 'declined' | 'completed';
  created_at: string;
  is_bundle: boolean;
  user1?: any;
  user2?: any;
  user1_card?: any;
  user2_card?: any;
  user1_cards?: any[];
  user2_cards?: any[];
  trade_score?: {
    valueScore: number;
    conditionScore: number;
    rarityScore: number;
    demandScore: number;
    userReputationScore: number;
    overallScore: number;
  };
}
