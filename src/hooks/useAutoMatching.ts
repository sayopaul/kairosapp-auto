import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// Helper to fetch card details by array of IDs
async function fetchCardsByIds(cardIds: string[] | null | undefined) {
  if (!cardIds || cardIds.length === 0) return [];
  const { data, error } = await supabase
    .from('cards')
    .select('id, name, market_price, image_url')
    .in('id', cardIds);
  if (error) {
    console.error('Error fetching cards for bundle:', error);
    return [];
  }
  // Ensure order matches cardIds
  return cardIds.map(id => data.find((c: any) => c.id === id)).filter(Boolean);
}

export function useAutoMatching(userId?: string) {
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch recent matches, including bundle card details
  const fetchRecentMatches = async () => {
    if (!userId) return;

    try {
      setLoading(true);

      // Get recent matches (last 24 hours)
      const { data: matches, error } = await supabase
        .from('matches')
        .select(`
          *,
          user1:users!matches_user1_id_fkey(username),
          user2:users!matches_user2_id_fkey(username),
          user1_card:cards!matches_user1_card_id_fkey(name, market_price, image_url),
          user2_card:cards!matches_user2_card_id_fkey(name, market_price, image_url)
        `)
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      // For bundle trades, fetch all cards for user1_card_ids and user2_card_ids
      const matchesWithBundles = await Promise.all(
        (matches || []).map(async (match) => {
          if (match.is_bundle) {
            // user1_card_ids and user2_card_ids should be arrays of card IDs
            const user1Ids = Array.isArray(match.user1_card_ids) ? match.user1_card_ids : [];
            const user2Ids = Array.isArray(match.user2_card_ids) ? match.user2_card_ids : [];
            const [user1_cards, user2_cards] = await Promise.all([
              fetchCardsByIds(user1Ids),
              fetchCardsByIds(user2Ids)
            ]);
            return { ...match, user1_cards, user2_cards };
          } else {
            return match;
          }
        })
      );

      setRecentMatches(matchesWithBundles);
    } catch (error) {
      console.error('Error fetching recent matches:', error);
    } finally {
      setLoading(false);
    }
  };

  // Listen for new matches in real-time
  useEffect(() => {
    if (!userId) return;

    console.log('Setting up real-time match listener for user:', userId);

    // Subscribe to new matches for this user
    const matchSubscription = supabase
      .channel('matches')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'matches',
          filter: `user1_id=eq.${userId}`,
        },
        (payload) => {
          console.log('New match detected:', payload.new);
          fetchRecentMatches();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'matches',
          filter: `user2_id=eq.${userId}`,
        },
        (payload) => {
          console.log('New match detected (as user2):', payload.new);
          fetchRecentMatches();
        }
      )
      .subscribe();

    // Initial fetch
    fetchRecentMatches();

    return () => {
      supabase.removeChannel(matchSubscription);
    };
  }, [userId]);

  const triggerManualMatching = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      console.log('Triggering manual matching for user:', userId);

      // Call the regenerate function for this user
      const { data, error } = await supabase.rpc('regenerate_all_matches', {
        target_user_id: userId
      });

      if (error) throw error;

      console.log('Manual matching completed. Generated matches:', data);
      
      // Refresh recent matches
      await fetchRecentMatches();
      
      return data;
    } catch (error) {
      console.error('Error triggering manual matching:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    recentMatches,
    loading,
    triggerManualMatching,
    refreshMatches: fetchRecentMatches,
  };
}