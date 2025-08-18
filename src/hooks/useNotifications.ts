import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useRef } from 'react';

export interface Notification {
  id: string;
  type: 'trade_proposal' | 'trade_accepted' | 'trade_confirmed' | 'shipping_update' | 'message';
  title: string;
  message: string;
  relatedId?: string;
  isRead: boolean;
  createdAt: string;
  myCards?: Card[];
  theirCards?: Card[];
}

interface Card {
  id: string;
  name: string;
  market_price: string;
  image_url?: string;
  card_number?: string;
  set?: string;
  condition?: string;
}

export type { Card };

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [popupNotifications, setPopupNotifications] = useState<Notification[]>([]);
  const channelRef = useRef<any>(null);

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // First fetch proposals with match data
      const { data: proposals, error: proposalsError } = await supabase
        .from('trade_proposals')
        .select(`
          *,
          proposer:users!trade_proposals_proposer_id_fkey(username),
          recipient:users!trade_proposals_recipient_id_fkey(username),
          match:matches(
            id,
            is_bundle,
            user1_card_ids,
            user2_card_ids,
            user1_id,
            user2_id
          )
        `)
        .or(`proposer_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (proposalsError) throw proposalsError;

      // Then fetch all card details in a single query
      const allCardIds = proposals?.reduce((ids: string[], proposal) => {
        const user1CardIds = proposal.match?.user1_card_ids || [];
        const user2CardIds = proposal.match?.user2_card_ids || [];
        return [...ids, ...user1CardIds, ...user2CardIds];
      }, []) || [];

      const { data: cards, error: cardsError } = await supabase
        .from('cards')
        .select('*')
        .in('id', allCardIds);

      if (cardsError) throw cardsError;

      // Create a map for quick card lookups
      const cardMap = (cards || []).reduce((map: Record<string, Card>, card: Card) => {
        map[card.id] = card;
        return map;
      }, {});

      // Convert proposals to notifications
      const notificationList: Notification[] = [];

      for (const proposal of proposals || []) {
        const isProposer = proposal.proposer_id === user.id;
        const otherUsername = isProposer ? proposal.recipient.username : proposal.proposer.username;

        // Get the appropriate card arrays based on who is viewing
        const myCardIds = isProposer ? proposal.match.user1_card_ids : proposal.match.user2_card_ids;
        const theirCardIds = isProposer ? proposal.match.user2_card_ids : proposal.match.user1_card_ids;

        const myCards = (myCardIds || []).map((id: string) => cardMap[id]).filter(Boolean);
        const theirCards = (theirCardIds || []).map((id: string) => cardMap[id]).filter(Boolean);

        const isBundle = proposal.match.is_bundle || myCardIds?.length > 1 || theirCardIds?.length > 1;

        if (proposal.status === 'proposed' && !isProposer) {
          // Create notification message based on trade type
          let title = 'New Trade Proposal';
          let message = '';

          if (isBundle) {
            // Show first card name + N more for each side
            const myCardLabel = myCards.length > 0 ? `${myCards[0].name}${myCards.length > 1 ? ` + ${myCards.length - 1} more` : ''}` : 'your cards';
            const theirCardLabel = theirCards.length > 0 ? `${theirCards[0].name}${theirCards.length > 1 ? ` + ${theirCards.length - 1} more` : ''}` : 'their cards';
            title = '🎁 New Bundle Trade Proposal';
            message = `${otherUsername} wants to trade ${theirCardLabel} for your ${myCardLabel}`;
          } else {
            message = `${otherUsername} wants to trade their ${theirCards[0]?.name || 'card'} for your ${myCards[0]?.name || 'card'}`;
          }

          notificationList.push({
            id: `proposal_${proposal.id}`,
            type: 'trade_proposal',
            title,
            message,
            relatedId: proposal.id,
            isRead: false,
            createdAt: proposal.created_at,
            myCards,
            theirCards,
          });
        }

        if (proposal.status === 'accepted_by_recipient' && isProposer) {
          let title = 'Trade Proposal Accepted';
          let message = '';

          if (isBundle) {
            const theirTotal = theirCards.reduce((sum: number, card: Card) => sum + (parseFloat(card.market_price) || 0), 0);
            message = `${otherUsername} accepted your bundle trade proposal worth $${theirTotal.toFixed(2)}`;
          } else {
            message = `${otherUsername} accepted your trade proposal for ${theirCards[0]?.name || 'card'}`;
          }

          notificationList.push({
            id: `accepted_${proposal.id}`,
            type: 'trade_accepted',
            title,
            message,
            relatedId: proposal.id,
            isRead: false,
            createdAt: proposal.updated_at,
            myCards,
            theirCards,
          });
        }
      }

      setNotifications(notificationList);
      setUnreadCount(notificationList.filter(n => !n.isRead).length);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  };

  // --- Real-time listeners for popups ---
  useEffect(() => {
    if (!user) return;

    // Set up real-time listeners for trade proposals
    const channel = supabase
      .channel('trade_proposals_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trade_proposals',
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          handleNewTradeProposal(payload.new, true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'trade_proposals',
          filter: `proposer_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new.status === 'accepted_by_recipient') {
            handleTradeAccepted(payload.new, true);
          }
        }
      )
      .subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id]);

  // --- Add toasts for real-time events ---
  const dismissPopupNotification = (notificationId: string) => {
    setPopupNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const handleNewTradeProposal = async (proposal: any, isPopup = false) => {
    try {
      // Fetch proposal with match data
      const { data, error } = await supabase
        .from('trade_proposals')
        .select(`
          *,
          proposer:users!trade_proposals_proposer_id_fkey(username),
          match:matches(
            id,
            is_bundle,
            user1_card_ids,
            user2_card_ids
          )
        `)
        .eq('id', proposal.id)
        .single();

      if (error) throw error;

      // Fetch card details
      const cardIds = [...(data.match.user1_card_ids || []), ...(data.match.user2_card_ids || [])];
      const { data: cards, error: cardsError } = await supabase
        .from('cards')
        .select('*')
        .in('id', cardIds);

      if (cardsError) throw cardsError;

      // Create card map
      const cardMap = (cards || []).reduce((map: Record<string, Card>, card: Card) => {
        map[card.id] = card;
        return map;
      }, {});

      const user1Cards = (data.match.user1_card_ids || []).map((id: string) => cardMap[id]).filter(Boolean);
      const user2Cards = (data.match.user2_card_ids || []).map((id: string) => cardMap[id]).filter(Boolean);

      const isBundle = data.match.is_bundle || user1Cards.length > 1 || user2Cards.length > 1;

      // Create notification with bundle support
      let title = 'New Trade Proposal';
      let message = '';

      if (isBundle) {
        const myCardLabel = user2Cards.length > 0 ? `${user2Cards[0].name}${user2Cards.length > 1 ? ` + ${user2Cards.length - 1} more` : ''}` : 'your cards';
        const theirCardLabel = user1Cards.length > 0 ? `${user1Cards[0].name}${user1Cards.length > 1 ? ` + ${user1Cards.length - 1} more` : ''}` : 'their cards';
        title = '🎁 New Bundle Trade Proposal';
        message = `${data.proposer.username} wants to trade ${theirCardLabel} for your ${myCardLabel}`;
      } else {
        message = `${data.proposer.username} wants to trade their ${user1Cards[0]?.name || 'card'} for your ${user2Cards[0]?.name || 'card'}`;
      }

      const newNotification: Notification = {
        id: `proposal_${proposal.id}_${Date.now()}`,
        type: 'trade_proposal',
        title,
        message,
        relatedId: proposal.id,
        isRead: false,
        createdAt: proposal.created_at,
        myCards: user2Cards,
        theirCards: user1Cards,
      };

      if (isPopup) {
        setPopupNotifications(prev => [newNotification, ...prev]);
      }
    } catch (error) {
      console.error('Error handling new trade proposal:', error);
    }
  };

  const handleTradeAccepted = async (proposal: any, isPopup = false) => {
    try {
      // Fetch proposal with match data
      const { data, error } = await supabase
        .from('trade_proposals')
        .select(`
          *,
          recipient:users!trade_proposals_recipient_id_fkey(username),
          match:matches(
            id,
            is_bundle,
            user1_card_ids,
            user2_card_ids
          )
        `)
        .eq('id', proposal.id)
        .single();

      if (error) throw error;

      // Fetch card details
      const cardIds = [...(data.match.user1_card_ids || []), ...(data.match.user2_card_ids || [])];
      const { data: cards, error: cardsError } = await supabase
        .from('cards')
        .select('*')
        .in('id', cardIds);

      if (cardsError) throw cardsError;

      // Create card map
      const cardMap = (cards || []).reduce((map: Record<string, Card>, card: Card) => {
        map[card.id] = card;
        return map;
      }, {});

      const user1Cards = (data.match.user1_card_ids || []).map((id: string) => cardMap[id]).filter(Boolean);
      const user2Cards = (data.match.user2_card_ids || []).map((id: string) => cardMap[id]).filter(Boolean);

      const isBundle = data.match.is_bundle || user1Cards.length > 1 || user2Cards.length > 1;

      // Create notification with bundle support
      let title = 'Trade Proposal Accepted';
      let message = '';

      if (isBundle) {
        const myCardLabel = user2Cards.length > 0 ? `${user2Cards[0].name}${user2Cards.length > 1 ? ` + ${user2Cards.length - 1} more` : ''}` : 'your cards';
        const theirCardLabel = user1Cards.length > 0 ? `${user1Cards[0].name}${user1Cards.length > 1 ? ` + ${user1Cards.length - 1} more` : ''}` : 'their cards';
        title = '🎁 New Bundle Trade Proposal';
        message = `${data.recipient.username} accepted your trade proposal for ${myCardLabel}`;
      } else {
        message = `${data.recipient.username} accepted your trade proposal for ${user2Cards[0]?.name || 'card'}`;
      }

      const newNotification: Notification = {
        id: `accepted_${proposal.id}_${Date.now()}`,
        type: 'trade_accepted',
        title,
        message,
        relatedId: proposal.id,
        isRead: false,
        createdAt: proposal.updated_at,
        myCards: user2Cards,
        theirCards: user1Cards,
      };

      if (isPopup) {
        setPopupNotifications(prev => [newNotification, ...prev]);
      }
    } catch (error) {
      console.error('Error handling trade accepted:', error);
    }
  };

  const markAsRead = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  useEffect(() => {
    fetchNotifications();
  }, [user?.id]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    popupNotifications,
    dismissPopupNotification,
  };
}