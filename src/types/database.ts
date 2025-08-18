export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          username: string;
          email: string | null;
          profile_image_url: string | null;
          total_trades: number | null;
          match_success_rate: number | null;
          average_value_traded: number | null;
          reputation_score: number | null;
          shipping_preference: string | null;
          trade_percentage_min: number | null;
          subscription_tier: string | null;
          subscription_status: string | null;
        };
        Insert: {
          id?: string;
          username: string;
          email?: string | null;
          profile_image_url?: string | null;
          total_trades?: number | null;
          match_success_rate?: number | null;
          average_value_traded?: number | null;
          reputation_score?: number | null;
          shipping_preference?: string | null;
          trade_percentage_min?: number | null;
          subscription_tier?: string | null;
          subscription_status?: string | null;
        };
        Update: {
          id?: string;
          username?: string;
          email?: string | null;
          profile_image_url?: string | null;
          total_trades?: number | null;
          match_success_rate?: number | null;
          average_value_traded?: number | null;
          reputation_score?: number | null;
          shipping_preference?: string | null;
          trade_percentage_min?: number | null;
          subscription_tier?: string | null;
          subscription_status?: string | null;
        };
      };
      cards: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          image_url: string | null;
          market_price: number | null;
          card_number: string | null;
          set: string | null;
          condition: string | null;
          quantity: number | null;
          list_type: string;
          created_at: string | null;
          justtcg_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          image_url?: string | null;
          market_price?: number | null;
          card_number?: string | null;
          set?: string | null;
          condition?: string | null;
          quantity?: number | null;
          list_type: string;
          created_at?: string | null;
          justtcg_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          image_url?: string | null;
          market_price?: number | null;
          card_number?: string | null;
          set?: string | null;
          condition?: string | null;
          quantity?: number | null;
          list_type?: string;
          created_at?: string | null;
          justtcg_id?: string | null;
        };
      };
      matches: {
        Row: {
          id: string;
          user1_id: string;
          user2_id: string | null;
          user1_card_id: string | null;
          user2_card_id: string | null;
          match_score: number | null;
          value_difference: number | null;
          status: string;
          created_at: string | null;
          is_bundle: boolean | null;
          user1_card_ids: string[] | null;
          user2_card_ids: string[] | null;
        };
        Insert: {
          id?: string;
          user1_id: string;
          user2_id?: string | null;
          user1_card_id?: string | null;
          user2_card_id?: string | null;
          match_score?: number | null;
          value_difference?: number | null;
          status: string;
          created_at?: string | null;
          is_bundle?: boolean | null;
          user1_card_ids?: string[] | null;
          user2_card_ids?: string[] | null;
        };
        Update: {
          id?: string;
          user1_id?: string;
          user2_id?: string | null;
          user1_card_id?: string | null;
          user2_card_id?: string | null;
          match_score?: number | null;
          value_difference?: number | null;
          status?: string;
          created_at?: string | null;
          is_bundle?: boolean | null;
          user1_card_ids?: string[] | null;
          user2_card_ids?: string[] | null;
        };
      };
      messages: {
        Row: {
          id: string;
          match_id: string;
          sender_id: string | null;
          message: string | null;
          timestamp: string | null;
          card_image_url: string | null;
        };
        Insert: {
          id?: string;
          match_id: string;
          sender_id?: string | null;
          message?: string | null;
          timestamp?: string | null;
          card_image_url?: string | null;
        };
        Update: {
          id?: string;
          match_id?: string;
          sender_id?: string | null;
          message?: string | null;
          timestamp?: string | null;
          card_image_url?: string | null;
        };
      };
      transactions: {
        Row: {
          id: string;
          match_id: string;
          user1_sent: boolean | null;
          user2_sent: boolean | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          match_id: string;
          user1_sent?: boolean | null;
          user2_sent?: boolean | null;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          match_id?: string;
          user1_sent?: boolean | null;
          user2_sent?: boolean | null;
          completed_at?: string | null;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          tier: string | null;
          billing_cycle: string | null;
          is_active: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          tier?: string | null;
          billing_cycle?: string | null;
          is_active?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          tier?: string | null;
          billing_cycle?: string | null;
          is_active?: boolean | null;
          created_at?: string | null;
        };
      };
      subscription_events: {
        Row: {
          id: string;
          subscription_id: string | null;
          user_id: string | null;
          event_type: string;
          stripe_event_id: string | null;
          amount: number | null;
          currency: string | null;
          status: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          subscription_id?: string | null;
          user_id?: string | null;
          event_type: string;
          stripe_event_id?: string | null;
          amount?: number | null;
          currency?: string | null;
          status?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          subscription_id?: string | null;
          user_id?: string | null;
          event_type?: string;
          stripe_event_id?: string | null;
          amount?: number | null;
          currency?: string | null;
          status?: string | null;
          created_at?: string | null;
        };
      };
    };
  };
}