import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TradeMatch, User, Card } from '../types';

export function useMatches(userId?: string) {
  const [matches, setMatches] = useState<TradeMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    fetchMatches();
  }, [userId]);

  const fetchMatches = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all matches including bundle trades
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select(`
          *,
          user1:users!matches_user1_id_fkey(*),
          user2:users!matches_user2_id_fkey(*),
          user1_card:cards!matches_user1_card_id_fkey(*),
          user2_card:cards!matches_user2_card_id_fkey(*)
        `)
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (matchesError) throw matchesError;

      // Gather all card IDs from both single and bundle trades
      const allCardIds = new Set<string>();
      (matchesData || []).forEach(match => {
        // Add single trade card IDs
        if (match.user1_card_id) allCardIds.add(match.user1_card_id);
        if (match.user2_card_id) allCardIds.add(match.user2_card_id);
        
        // Add bundle trade card IDs
        if (match.is_bundle) {
          if (Array.isArray(match.user1_card_ids)) {
            match.user1_card_ids.forEach((id: string) => allCardIds.add(id));
          }
          if (Array.isArray(match.user2_card_ids)) {
            match.user2_card_ids.forEach((id: string) => allCardIds.add(id));
          }
        }
      });

      // Fetch all needed cards in one query
      const { data: cardsData, error: cardsError } = await supabase
        .from('cards')
        .select('*')
        .in('id', Array.from(allCardIds));

      if (cardsError) throw cardsError;

      // Create a map of card data
      const cardsMap = (cardsData || []).reduce((acc, card) => {
        acc[card.id] = card;
        return acc;
      }, {} as Record<string, Card>);

      // Format matches with complete card data
      const formattedMatches: TradeMatch[] = (matchesData || []).map(match => {
        const user1_card_ids = match.is_bundle 
          ? (Array.isArray(match.user1_card_ids) ? match.user1_card_ids : [])
          : (match.user1_card_id ? [match.user1_card_id] : []);
        
        const user2_card_ids = match.is_bundle
          ? (Array.isArray(match.user2_card_ids) ? match.user2_card_ids : [])
          : (match.user2_card_id ? [match.user2_card_id] : []);

        // Get card objects for both sides
        const user1_cards = user1_card_ids.map((id: string) => cardsMap[id]).filter(Boolean);
        const user2_cards = user2_card_ids.map((id: string) => cardsMap[id]).filter(Boolean);

        return {
          ...match,
          user1_card_ids,
          user2_card_ids,
          user1_cards,
          user2_cards,
          is_bundle: Boolean(match.is_bundle)
        };
      });

      setMatches(formattedMatches);
    } catch (error) {
      console.error('Error fetching matches:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch matches');
    } finally {
      setLoading(false);
    }
  };

  return { matches, loading, error, refetchMatches: fetchMatches };
}