import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase';
import { Card } from '../types';

export function useCards(userId?: string, listType?: 'trade' | 'want') {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Memoized fetchCards function for refetch
  const fetchCards = useCallback(async () => {
    let mounted = true;
    try {
      setLoading(true);
      setError(null);
      if (!userId) {
        if (mounted) {
          setCards([]);
          setLoading(false);
        }
        return;
      }

      console.log('Fetching cards for user:', userId, 'listType:', listType);

      let query = supabase
        .from('cards')
        .select('*')
        .eq('user_id', userId);

      if (listType) {
        query = query.eq('list_type', listType);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Cards fetch error:', error);
        throw error;
      }

      if (!mounted) return;

      const formattedCards: Card[] = (data || []).map(card => ({
        id: card.id,
        user_id: card.user_id,
        name: card.name || '',
        image_url: card.image_url || '',
        card_number: card.card_number || '',
        set: card.set || '',
        condition: (card.condition as Card['condition']) || 'Near Mint',
        market_price: card.market_price || 0,
        quantity: Number(card.quantity) || 1,
        list_type: (card.list_type as 'trade' | 'want') || 'trade',
        created_at: card.created_at || new Date().toISOString(),
      }));

      console.log('Cards fetched:', formattedCards.length);
      setCards(formattedCards);
    } catch (err) {
      console.error('Cards error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [userId, listType]);

  useEffect(() => {
    fetchCards();

    return () => {};
  }, [fetchCards]);

  const addCard = async (cardData: Omit<Card, 'id' | 'created_at'>) => {
    try {
      if (!cardData.user_id) {
        throw new Error('User ID is required');
      }

      console.log('Adding card:', cardData.name);
     

      // Generate a unique ID for the new card
      const newCardId = uuidv4();
      
      const { data, error } = await supabase
        .from('cards')
        .insert([{
          id: newCardId,
          user_id: cardData.user_id,
          name: cardData.name,
          image_url: cardData.image_url,
          card_number: cardData.card_number,
          set: cardData.set,
          condition: cardData.condition,
          market_price: cardData.market_price,
          quantity:  Number(cardData.quantity) || 1,
          list_type: cardData.list_type,
          created_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) {
        console.error('Card insert error:', error);
        throw error;
      }

      console.log('Card added successfully:', data.name);

      // Refresh the cards list
      const refreshQuery = supabase
        .from('cards')
        .select('*')
        .eq('user_id', cardData.user_id);

      if (listType) {
        refreshQuery.eq('list_type', listType);
      }

      const { data: refreshedCards, error: refreshError } = await refreshQuery
        .order('created_at', { ascending: false });

      if (refreshError) {
        console.error('Cards refresh error:', refreshError);
        throw refreshError;
      }

      const formattedCards: Card[] = (refreshedCards || []).map(card => ({
        id: card.id,
        user_id: card.user_id,
        name: card.name || '',
        image_url: card.image_url || '',
        card_number: card.card_number || '',
        set: card.set || '',
        condition: (card.condition as Card['condition']) || 'Near Mint',
        market_price: card.market_price || 0,
        quantity: Number(card.quantity) || 1,
        list_type: (card.list_type as 'trade' | 'want') || 'trade',
        created_at: card.created_at || new Date().toISOString(),
      }));

      setCards(formattedCards);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add card');
      throw err;
    }
  };

  const updateCard = async (cardId: string, updates: Partial<Card>) => {
    try {
      const { error } = await supabase
        .from('cards')
        .update({
          name: updates.name,
          image_url: updates.image_url,
          card_number: updates.card_number,
          set: updates.set,
          condition: updates.condition,
          market_price: updates.market_price,
          quantity: updates.quantity,
          list_type: updates.list_type,
        })
        .eq('id', cardId);

      if (error) throw error;

      // Refresh cards
      fetchCards();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update card');
      throw err;
    }
  };

  const deleteCard = async (cardId: string) => {
    try {
      // First, delete any matches that reference this card
      const { error: matchesDeleteError } = await supabase
        .from('matches')
        .delete()
        .or(`user1_card_id.eq.${cardId},user2_card_id.eq.${cardId}`);

      if (matchesDeleteError) {
        console.error('Error deleting matches:', matchesDeleteError);
        throw matchesDeleteError;
      }

      // Now delete the card
      const { error } = await supabase
        .from('cards')
        .delete()
        .eq('id', cardId);

      if (error) throw error;

      // Refresh cards
      fetchCards();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete card');
      throw err;
    }
  };

  return {
    cards,
    loading,
    error,
    addCard,
    updateCard,
    deleteCard,
    refetch: fetchCards,
  };
}