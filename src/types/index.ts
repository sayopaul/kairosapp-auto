export interface Card {
  id: string;
  user_id: string;
  name: string;
  image_url: string;
  card_number: string;
  set: string;
  condition: 'Mint' | 'Near Mint' | 'Lightly Played' | 'Moderately Played' | 'Heavily Played' | 'Damaged';
  market_price: number;
  quantity: number;
  list_type: 'trade' | 'want';
  created_at: string;
  justtcg_id?: string;
  enhanced_pricing?: {
    price: number;
    condition: string;
    source: 'justtcg' | 'pokemon_tcg' | 'estimated';
    last_updated: string;
  };
}

export interface User {
  id: string;
  username: string;
  email?: string;
  profile_image_url?: string;
  total_trades: number;
  match_success_rate: number;
  average_value_traded: number;
  reputation_score: number;
  shipping_preference: 'local' | 'direct' | 'third-party';
  trade_percentage_min: number;
  subscription_tier: 'trainer' | 'elite' | 'master';
  subscription_status?: 'active' | 'cancelled' | 'expired' | 'past_due';
}

export interface TradeProposal {
  id: string;
  match_id: string;
  proposer_id: string;
  recipient_id: string;
  tracking_number?: string;
  carrier?: string;
  label_url?: string;
  status:
    | "proposed"
    | "accepted_by_recipient"
    | "confirmed"
    | "shipping_confirmed"
    | "shipping_pending"
    | "completed"
    | "declined"
    | "cancelled";
  shipping_method?: "mail" | "local_meetup";
  proposer_confirmed: boolean;
  recipient_confirmed: boolean;
  proposer_shipping_confirmed: boolean;
  recipient_shipping_confirmed: boolean;
  proposer_address_id?: string;
  recipient_address_id?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  match: TradeMatch;
  // Additional fields for shipping
  shipping_address_from?: any;
  shipping_address_to?: any;
  shipping_rate?: any;
  proposer_label_url?: string;
  recipient_label_url?: string;
}

export interface TradeScore {
  valueScore: number;
  conditionScore: number;
  rarityScore: number;
  demandScore: number;
  userReputationScore: number;
  overallScore: number;
}

export interface TradeMatch {
  id: string;
  user1_id: string;
  user2_id: string;
  user1_card_id: string;
  user2_card_id: string;
  user1_card: Card;
  user2_card: Card;
  match_score: number;
  value_difference: number;
  status: 'pending' | 'accepted' | 'declined' | 'completed';
  created_at: string;
  user1?: User;
  user2?: User;
  // Add bundle support
  is_bundle?: boolean;
  user1_card_ids?: string[];
  user2_card_ids?: string[];
  user1_cards?: Card[];
  user2_cards?: Card[];
  pricing_data?: {
    user1_card_price: number;
    user2_card_price: number;
    price_source: 'pokeprice' | 'estimated';
  };
}

export interface PotentialMatch {
  id: string;
  user1_id: string;
  user2_id: string;
  user1_card_ids: string[];
  user2_card_ids: string[];
  user1_cards?: Card[];
  user2_cards?: Card[];
  match_score: number;
  value_difference: number;
  trade_score: TradeScore;
  confidence: 'high' | 'medium' | 'low';
  status: 'pending' | 'accepted' | 'declined' | 'completed';
  created_at: string;
  user1?: User;
  user2?: User;
  is_bundle: boolean;
}

export interface ChatMessage {
  id: string;
  match_id: string;
  sender_id: string;
  message: string;
  timestamp: string;
  card_image_url?: string;
}

export interface Transaction {
  id: string;
  match_id: string;
  trade_proposal_id?: string;
  user1_sent: boolean;
  user2_sent: boolean;
  completed_at?: string;
  tracking_number?: string;
  carrier?: string;
  tracking_status?: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  tier: 'trainer' | 'elite' | 'master'; 
  billing_cycle: 'monthly' | 'yearly';
  is_active: boolean;
  created_at: string;
}

export * from './card';

export type NavigationTab = 'dashboard' | 'trades' | 'want' | 'matches' | 'collection' | 'chat' | 'profile' | 'proposals';

export interface ShippingPreference {
  id: string;
  user_id: string;
  address_name: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
  is_default: boolean;
  created_at: string;
}

export * from './card';