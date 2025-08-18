// Debug service to help identify Supabase table update issues
import { supabase } from '../lib/supabase';

export class DebugService {
  // Test database connection and permissions
  static async testDatabaseConnection() {
    console.log('🔍 Testing database connection...');
    
    try {
      // Test basic connection
      const { data: session } = await supabase.auth.getSession();
      console.log('Auth session:', session.session?.user?.id || 'No user');

      // Test users table access
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, username')
        .limit(5);
      
      if (usersError) {
        console.error('❌ Users table error:', usersError);
      } else {
        console.log('✅ Users table accessible:', users?.length || 0, 'users found');
      }

      // Test cards table access
      const { data: cards, error: cardsError } = await supabase
        .from('cards')
        .select('id, name, user_id, list_type')
        .limit(5);
      
      if (cardsError) {
        console.error('❌ Cards table error:', cardsError);
      } else {
        console.log('✅ Cards table accessible:', cards?.length || 0, 'cards found');
      }

      // Test matches table access
      const { data: matches, error: matchesError } = await supabase
        .from('matches')
        .select('id, user1_id, user2_id, status')
        .limit(5);
      
      if (matchesError) {
        console.error('❌ Matches table error:', matchesError);
      } else {
        console.log('✅ Matches table accessible:', matches?.length || 0, 'matches found');
      }

      // Test transactions table access
      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select('id, match_id')
        .limit(5);
      
      if (transactionsError) {
        console.error('❌ Transactions table error:', transactionsError);
      } else {
        console.log('✅ Transactions table accessible:', transactions?.length || 0, 'transactions found');
      }

      return {
        connection: true,
        users: !usersError,
        cards: !cardsError,
        matches: !matchesError,
        transactions: !transactionsError
      };

    } catch (error) {
      console.error('❌ Database connection failed:', error);
      return {
        connection: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Test inserting a match record
  static async testMatchInsert(userId: string) {
    console.log('🧪 Testing match insert for user:', userId);
    
    try {
      // First, get user's cards to create a valid match
      const { data: userCards, error: cardsError } = await supabase
        .from('cards')
        .select('*')
        .eq('user_id', userId)
        .limit(2);

      if (cardsError) {
        console.error('❌ Error fetching user cards:', cardsError);
        return false;
      }

      if (!userCards || userCards.length < 2) {
        console.log('❌ User needs at least 2 cards to test match creation');
        return false;
      }

      // Create a test match
      const testMatch = {
        user1_id: userId,
        user2_id: userId, // Self-match for testing
        user1_card_id: userCards[0].id,
        user2_card_id: userCards[1].id,
        match_score: 85,
        value_difference: 10.0,
        status: 'pending'
      };

      console.log('Attempting to insert test match:', testMatch);

      const { data, error } = await supabase
        .from('matches')
        .insert([testMatch])
        .select()
        .single();

      if (error) {
        console.error('❌ Match insert failed:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        return false;
      }

      console.log('✅ Test match created successfully:', data);

      // Clean up test match
      await supabase
        .from('matches')
        .delete()
        .eq('id', data.id);

      console.log('✅ Test match cleaned up');
      return true;

    } catch (error) {
      console.error('❌ Test match insert failed:', error);
      return false;
    }
  }

  // Test inserting a transaction record
  static async testTransactionInsert(userId: string) {
    console.log('🧪 Testing transaction insert for user:', userId);
    
    try {
      // First, get or create a match to associate with
      const { data: matches, error: matchError } = await supabase
        .from('matches')
        .select('id')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .limit(1);

      if (matchError) {
        console.error('❌ Error fetching matches:', matchError);
        return false;
      }

      let matchId;
      if (!matches || matches.length === 0) {
        // Create a temporary match for testing
        const { data: userCards } = await supabase
          .from('cards')
          .select('id')
          .eq('user_id', userId)
          .limit(2);

        if (!userCards || userCards.length < 2) {
          console.log('❌ Need at least 2 cards to create test match');
          return false;
        }

        const { data: tempMatch, error: tempMatchError } = await supabase
          .from('matches')
          .insert([{
            user1_id: userId,
            user2_id: userId,
            user1_card_id: userCards[0].id,
            user2_card_id: userCards[1].id,
            match_score: 85,
            value_difference: 10.0,
            status: 'pending'
          }])
          .select('id')
          .single();

        if (tempMatchError) {
          console.error('❌ Failed to create temp match:', tempMatchError);
          return false;
        }

        matchId = tempMatch.id;
      } else {
        matchId = matches[0].id;
      }

      // Create a test transaction
      const testTransaction = {
        match_id: matchId,
        user1_sent: false,
        user2_sent: false
      };

      console.log('Attempting to insert test transaction:', testTransaction);

      const { data, error } = await supabase
        .from('transactions')
        .insert([testTransaction])
        .select()
        .single();

      if (error) {
        console.error('❌ Transaction insert failed:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        return false;
      }

      console.log('✅ Test transaction created successfully:', data);

      // Clean up test transaction
      await supabase
        .from('transactions')
        .delete()
        .eq('id', data.id);

      console.log('✅ Test transaction cleaned up');
      return true;

    } catch (error) {
      console.error('❌ Test transaction insert failed:', error);
      return false;
    }
  }

  // Check RLS policies
  static async checkRLSPolicies() {
    console.log('🔍 Checking RLS policies...');
    
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;

      if (!userId) {
        console.log('❌ No authenticated user - RLS will block operations');
        return false;
      }

      console.log('✅ Authenticated user:', userId);

      // Test if user can read their own data
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError) {
        console.error('❌ Cannot read user data (RLS issue?):', userError);
      } else {
        console.log('✅ Can read user data:', userData?.username);
      }

      // Test if user can read cards
      const { data: cardsData, error: cardsError } = await supabase
        .from('cards')
        .select('*')
        .eq('user_id', userId)
        .limit(1);

      if (cardsError) {
        console.error('❌ Cannot read cards (RLS issue?):', cardsError);
      } else {
        console.log('✅ Can read cards:', cardsData?.length || 0);
      }

      return true;

    } catch (error) {
      console.error('❌ RLS check failed:', error);
      return false;
    }
  }

  // Comprehensive debug report
  static async generateDebugReport(userId?: string) {
    console.log('📊 Generating comprehensive debug report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      connection: await this.testDatabaseConnection(),
      rls: await this.checkRLSPolicies(),
      matchInsert: userId ? await this.testMatchInsert(userId) : null,
      transactionInsert: userId ? await this.testTransactionInsert(userId) : null
    };

    console.log('📋 Debug Report:', report);
    return report;
  }
}