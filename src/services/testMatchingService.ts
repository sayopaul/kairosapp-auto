import { PotentialMatch } from './matchingService';

interface MockUser {
  id: string;
  username: string;
  email: string;
  total_trades: number;
  match_success_rate: number;
  average_value_traded: number;
  reputation_score: number;
  shipping_preference: 'direct' | 'local' | 'third-party';
  trade_percentage_min: number;
}

interface MockCard {
  id: string;
  user_id: string;
  name: string;
  image_url: string;
  card_number: string;
  set: string;
  condition: string;
  market_price: number;
  quantity: number;
  list_type: 'trade' | 'want';
  created_at: string;
}

interface MockData {
  users: MockUser[];
  userCards: Record<string, { trade: MockCard[]; want: MockCard[] }>;
}

export class TestMatchingService {
  private static mockData: MockData = {
    users: [],
    userCards: {}
  };

  static getMockData(): MockData {
    return this.mockData;
  }

  static resetMockData(): void {
    // Reset to empty state
    this.mockData = {
      users: [],
      userCards: {}
    };
  }

  static async testMatching(userId: string): Promise<PotentialMatch[]> {
    console.log('🧪 Starting test matching for user:', userId);
    
    try {
      // Use real data from database instead of mock data
      const { supabase } = await import('../lib/supabase');
      
      // Get user's cards
      const { data: userCards, error: userCardsError } = await supabase
        .from('cards')
        .select('*')
        .eq('user_id', userId);

      if (userCardsError) {
        console.error('Error fetching user cards:', userCardsError);
        return [];
      }

      // Get other users' cards
      const { data: otherUsersCards, error: otherCardsError } = await supabase
        .from('cards')
        .select('*')
        .neq('user_id', userId);

      if (otherCardsError) {
        console.error('Error fetching other users cards:', otherCardsError);
        return [];
      }

      // Get user profiles
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*');

      if (usersError) {
        console.error('Error fetching users:', usersError);
        return [];
      }

      console.log(`Found ${userCards?.length || 0} user cards and ${otherUsersCards?.length || 0} other users' cards`);
      
      // Use real matching logic
      const { matchingService } = await import('./matchingService');
      const matches = await matchingService.generateAndSaveMatches(userId);
      
      console.log(`🎯 Test matching completed. Found ${matches.length} matches`);
      return matches;

    } catch (error) {
      console.error('❌ Test matching failed:', error);
      return [];
    }
  }
}