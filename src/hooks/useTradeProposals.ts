import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { TradeProposal, TradeMatch } from '../types';

export function useTradeProposals(userId?: string) {
  const [proposals, setProposals] = useState<TradeProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProposals = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Fetching trade proposals for user:', userId);
      const { data, error: fetchError } = await supabase
        .from('trade_proposals')
        .select(`
          *,
          match:matches(
            *,
            user1:users!matches_user1_id_fkey(*),
            user2:users!matches_user2_id_fkey(*)
          )
        `)
        .or(`proposer_id.eq.${userId},recipient_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      console.log('📋 Raw proposals data:', data);
      console.log('📊 Proposals count:', data?.length || 0);
      
      // Collect all card IDs and validate proposals
      const allCardIds: string[] = [];
      const validProposals: any[] = [];
      const invalidProposalIds: string[] = [];
      
      (data || []).forEach(item => {
        const match = item.match;
        // console.log('🔗 Processing match for proposal:', item.id, 'match:', match);
        
        // Check if match exists and has required data
        if (match && match.user1_id && match.user2_id) {
          const isBundle = match.is_bundle || 
            (Array.isArray(match.user1_card_ids) && match.user1_card_ids.length > 1) ||
            (Array.isArray(match.user2_card_ids) && match.user2_card_ids.length > 1);
          
          let hasValidCardData = false;
          
          if (isBundle) {
            // For bundle trades, check if card arrays exist and have data
            if (Array.isArray(match.user1_card_ids) && match.user1_card_ids.length > 0 &&
                Array.isArray(match.user2_card_ids) && match.user2_card_ids.length > 0) {
              hasValidCardData = true;
              allCardIds.push(...match.user1_card_ids, ...match.user2_card_ids);
            }
          } else {
            // For single trades, check if card IDs exist
            if (match.user1_card_id && match.user2_card_id) {
              hasValidCardData = true;
              allCardIds.push(match.user1_card_id, match.user2_card_id);
            }
          }
          
          if (hasValidCardData) {
            validProposals.push(item);
          } else {
            console.warn('🗑️ Marking proposal for deletion - missing card data:', item.id);
            invalidProposalIds.push(item.id);
          }
        } else {
          console.warn('🗑️ Marking proposal for deletion - invalid match:', item.id);
          invalidProposalIds.push(item.id);
        }
      });
      
      // Delete invalid proposals from database
      if (invalidProposalIds.length > 0) {
        console.log('🗑️ Deleting invalid proposals:', invalidProposalIds);
        const { error: deleteError } = await supabase
          .from('trade_proposals')
          .delete()
          .in('id', invalidProposalIds);
        
        if (deleteError) {
          console.error('Error deleting invalid proposals:', deleteError);
        } else {
          console.log('✅ Successfully deleted', invalidProposalIds.length, 'invalid proposals');
        }
      }
      
      // Continue with only valid proposals
      const proposalsToProcess = validProposals;
      
      // Collect card IDs from valid proposals only
      const validCardIds: string[] = [];
      proposalsToProcess.forEach(item => {
        const match = item.match;
        if (match) {
          if (Array.isArray(match.user1_card_ids)) allCardIds.push(...match.user1_card_ids);
          if (Array.isArray(match.user2_card_ids)) allCardIds.push(...match.user2_card_ids);
          if (match.user1_card_id) validCardIds.push(match.user1_card_id);
          if (match.user2_card_id) validCardIds.push(match.user2_card_id);
        }
      });
      
      const uniqueCardIds = Array.from(new Set([...allCardIds, ...validCardIds]));

      console.log('🃏 Card IDs to fetch:', uniqueCardIds);
      let cardMap: Record<string, any> = {};
      if (uniqueCardIds.length > 0) {
        const { data: cards, error: cardsError } = await supabase
          .from('cards')
          .select('*')
          .in('id', uniqueCardIds);
        if (cardsError) throw cardsError;
        console.log('🃏 Fetched cards:', cards?.length || 0);
        cardMap = (cards || []).reduce((map, card) => {
          map[card.id] = card;
          return map;
        }, {} as Record<string, any>);
      }

      // Check for missing cards and mark additional proposals for deletion
      const finalValidProposals: any[] = [];
      const additionalInvalidIds: string[] = [];
      
      proposalsToProcess.forEach(item => {
        const match = item.match;
        if (!match) return;
        
        const isBundle = match.is_bundle || 
          (Array.isArray(match.user1_card_ids) && match.user1_card_ids.length > 1) ||
          (Array.isArray(match.user2_card_ids) && match.user2_card_ids.length > 1);
        
        let hasAllCards = true;
        
        if (isBundle) {
          // Check if all bundle cards exist
          const user1CardIds = Array.isArray(match.user1_card_ids) ? match.user1_card_ids : [];
          const user2CardIds = Array.isArray(match.user2_card_ids) ? match.user2_card_ids : [];
          
          for (const cardId of [...user1CardIds, ...user2CardIds]) {
            if (!cardMap[cardId]) {
              hasAllCards = false;
              break;
            }
          }
        } else {
          // Check if single trade cards exist
          if (!cardMap[match.user1_card_id] || !cardMap[match.user2_card_id]) {
            hasAllCards = false;
          }
        }
        
        if (hasAllCards) {
          finalValidProposals.push(item);
        } else {
          console.warn('🗑️ Marking proposal for deletion - missing card data in database:', item.id);
          additionalInvalidIds.push(item.id);
        }
      });
      
      // Delete proposals with missing cards
      if (additionalInvalidIds.length > 0) {
        console.log('🗑️ Deleting proposals with missing cards:', additionalInvalidIds);
        const { error: deleteError } = await supabase
          .from('trade_proposals')
          .delete()
          .in('id', additionalInvalidIds);
        
        if (deleteError) {
          console.error('Error deleting proposals with missing cards:', deleteError);
        } else {
          console.log('✅ Successfully deleted', additionalInvalidIds.length, 'proposals with missing cards');
        }
      }

      const formattedProposals: TradeProposal[] = finalValidProposals.map(item => {
        const match = item.match;
        let user1_cards: any[] = [];
        let user2_cards: any[] = [];
        if (match) {
          if (Array.isArray(match.user1_card_ids)) {
            user1_cards = match.user1_card_ids.map((id: string) => cardMap[id]).filter(Boolean);
          }
          if (Array.isArray(match.user2_card_ids)) {
            user2_cards = match.user2_card_ids.map((id: string) => cardMap[id]).filter(Boolean);
          }
          match.user1_cards = user1_cards;
          match.user2_cards = user2_cards;
        }
        
        console.log('✅ Formatted proposal:', {
          id: item.id,
          status: item.status,
          hasMatch: !!match,
          user1CardsCount: user1_cards.length,
          user2CardsCount: user2_cards.length
        });
        
        console.log("THe match ID is: ",item.match_id)
        console.log("THE match is: ",match)
        return {
          id: item.id,
          match_id: item.match_id,
          proposer_id: item.proposer_id,
          recipient_id: item.recipient_id,
          status: item.status,
          shipping_method: item.shipping_method,
          proposer_confirmed: item.proposer_confirmed,
          recipient_confirmed: item.recipient_confirmed,
          proposer_shipping_confirmed: item.proposer_shipping_confirmed,
          recipient_shipping_confirmed: item.recipient_shipping_confirmed,
          created_at: item.created_at,
          updated_at: item.updated_at,
          match: match as unknown as TradeMatch
        };
      });

      console.log('📦 Final formatted proposals:', formattedProposals.length);
      setProposals(formattedProposals);
    } catch (err) {
      console.error('Error fetching trade proposals:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch trade proposals');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  const getProposalForMatch = useCallback((matchId: string): TradeProposal | null => {
    return proposals.find(p => p.match_id === matchId) || null;
  }, [proposals]);

  const getProposalById = useCallback(
    (proposalId: string): TradeProposal | null => {
      return proposals.find((p) => p.id === proposalId) || null;
    },
    [proposals]
  );

  const createProposal = async (
    proposalData: Omit<
      TradeProposal,
      | "id"
      | "created_at"
      | "updated_at"
      | "match"
      | "proposer_confirmed"
      | "recipient_confirmed"
      | "proposer_shipping_confirmed"
      | "recipient_shipping_confirmed"
    >
  ) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: insertError } = await supabase
        .from("trade_proposals")
        .insert([proposalData])
        .select()
        .single();

      if (insertError) throw insertError;

      await fetchProposals();
      return data;
    } catch (err) {
      console.error("Error creating trade proposal:", err);
      setError(
        err instanceof Error ? err.message : "Failed to create trade proposal"
      );
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateProposal = async (
    proposalId: string,
    updates: Partial<TradeProposal>
  ) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: updateError } = await supabase
        .from("trade_proposals")
        .update(updates)
        .eq("id", proposalId)
        .select()
        .single();

      if (updateError) throw updateError;

      await fetchProposals();
      return data;
    } catch (err) {
      console.error("Error updating trade proposal:", err);
      setError(
        err instanceof Error ? err.message : "Failed to update trade proposal"
      );
      throw err;
    }
  };

  const declineProposal = async (proposalId: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: updateError } = await supabase
        .from("trade_proposals")
        .update({
          status: "declined",
          updated_at: new Date().toISOString(),
        })
        .eq("id", proposalId)
        .select()
        .single();

      if (updateError) throw updateError;

      await fetchProposals();
      return data;
    } catch (err) {
      console.error("Error declining trade proposal:", err);
      setError(
        err instanceof Error ? err.message : "Failed to decline trade proposal"
      );
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteProposal = async (proposalId: string) => {
    try {
      setLoading(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from("trade_proposals")
        .delete()
        .eq("id", proposalId);

      if (deleteError) throw deleteError;

      setProposals((prev) => prev.filter((p) => p.id !== proposalId));
      return true;
    } catch (err) {
      console.error("Error deleting trade proposal:", err);
      setError(
        err instanceof Error ? err.message : "Failed to delete trade proposal"
      );
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateTradeStatus = async (proposalId: string, newStatus: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: updateError } = await supabase
        .from("trade_proposals")
        .update({ status: newStatus })
        .eq("id", proposalId)
        .select()
        .single();

      if (updateError) throw updateError;

      await fetchProposals();
      return data;
    } catch (err) {
      console.error("Error updating trade status:", err);
      setError(
        err instanceof Error ? err.message : "Failed to update trade status"
      );
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const completeTradeProposal = async (proposalId: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: updateError } = await supabase
        .from("trade_proposals")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", proposalId)
        .select()
        .single();

      if (updateError) throw updateError;

      await fetchProposals();
      return data;
    } catch (err) {
      console.error("Error completing trade proposal:", err);
      setError(
        err instanceof Error ? err.message : "Failed to complete trade proposal"
      );
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateProposalAddresses = async (
    proposalId: string,
    {
      proposerAddressId,
      recipientAddressId,
    }: { proposerAddressId?: string; recipientAddressId?: string }
  ) => {
    if (!userId) return null;

    try {
      const updates: Partial<TradeProposal> = {
        updated_at: new Date().toISOString(),
      };

      if (proposerAddressId) updates.proposer_address_id = proposerAddressId;
      if (recipientAddressId) updates.recipient_address_id = recipientAddressId;

      const { data, error } = await supabase
        .from("trade_proposals")
        .update(updates)
        .eq("id", proposalId)
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setProposals((prev) =>
        prev.map((p) => (p.id === proposalId ? { ...p, ...updates } : p))
      );

      return data;
    } catch (error) {
      console.error("Error updating proposal addresses:", error);
      throw error;
    }
  };

  const confirmShipping = async (proposalId: string, isProposer: boolean) => {
    try {
      setLoading(true);
      setError(null);

      const updateField = isProposer
        ? "proposer_shipping_confirmed"
        : "recipient_shipping_confirmed";

      const { data, error: updateError } = await supabase
        .from("trade_proposals")
        .update({
          [updateField]: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", proposalId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Update local state
      setProposals((prev) =>
        prev.map((p) =>
          p.id === proposalId
            ? {
                ...p,
                [updateField]: true,
                updated_at: new Date().toISOString(),
              }
            : p
        )
      );

      return data;
    } catch (err) {
      console.error("Error confirming shipping:", err);
      setError(
        err instanceof Error ? err.message : "Failed to confirm shipping"
      );
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateShippingMethod = async (
    proposalId: string,
    shippingMethod: string
  ) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: updateError } = await supabase
        .from("trade_proposals")
        .update({
          shipping_method: shippingMethod,
          updated_at: new Date().toISOString(),
        })
        .eq("id", proposalId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Update local state
      setProposals((prev) =>
        prev.map((p) =>
          p.id === proposalId
            ? {
                ...p,
                shipping_method: shippingMethod,
                updated_at: new Date().toISOString(),
              }
            : p
        )
      );

      return data;
    } catch (err) {
      console.error("Error updating shipping method:", err);
      setError(
        err instanceof Error ? err.message : "Failed to update shipping method"
      );
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateShippingStatus = async (
    proposalId: string,
    updates: {
      trackingNumber?: string;
      carrier?: string;
      // labelUrl?: string;
      proposer_label_url?: string;
      recipient_label_url?: string;
      isProposer: boolean;
      status?: string;
    }
  ) => {
    try {
      setLoading(true);
      setError(null);

      const {
        trackingNumber,
        carrier,
        isProposer,
        status,
        proposer_label_url,
        recipient_label_url,
      } = updates;

      // Prepare the update data
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      // Set status if provided
      if (status) {
        updateData.status = status;
      }

      // Update tracking info (keep for backward compatibility)
      if (trackingNumber) updateData.tracking_number = trackingNumber;
      if (carrier) updateData.carrier = carrier;
      // if (labelUrl) updateData.label_url = labelUrl;
      if (proposer_label_url)
        updateData.proposer_label_url = proposer_label_url;
      if (recipient_label_url)
        updateData.recipient_label_url = recipient_label_url;

      // Update the appropriate user's specific fields
      if (isProposer) {
        if (trackingNumber)
          updateData.proposer_tracking_number = trackingNumber;
        if (carrier) updateData.proposer_carrier = carrier;
        if (proposer_label_url)
          updateData.proposer_label_url = proposer_label_url;
        updateData.proposer_shipping_confirmed = true;
      } else {
        if (trackingNumber)
          updateData.recipient_tracking_number = trackingNumber;
        if (carrier) updateData.recipient_carrier = carrier;
        if (recipient_label_url)
          updateData.recipient_label_url = recipient_label_url;
        updateData.recipient_shipping_confirmed = true;
      }

      const { data, error: updateError } = await supabase
        .from("trade_proposals")
        .update(updateData)
        .eq("id", proposalId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Update local state
      setProposals((prev) =>
        prev.map((p) => (p.id === proposalId ? { ...p, ...updateData } : p))
      );

      return data;
    } catch (err) {
      console.error("Error updating shipping status:", err);
      setError(
        err instanceof Error ? err.message : "Failed to update shipping status"
      );
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const acceptProposal = async (proposalId: string) => {
    try {
      setLoading(true);
      setError(null);

      // First, get the current proposal to check user roles
      const { data: proposal, error: fetchError } = await supabase
        .from("trade_proposals")
        .select("*")
        .eq("id", proposalId)
        .single();

      if (fetchError) throw fetchError;
      if (!proposal) throw new Error("Proposal not found");

      // Get current user ID
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Determine if current user is the proposer or recipient
      const isProposer = user.id === proposal.proposer_id;
      const isRecipient = user.id === proposal.recipient_id;

      if (!isProposer && !isRecipient) {
        throw new Error("You are not authorized to update this proposal");
      }

      // Prepare the update object
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      // Update the appropriate confirmation flag based on user role
      if (isProposer) {
        updateData.proposer_confirmed = true;
      } else if (isRecipient) {
        updateData.recipient_confirmed = true;
      }

      // If both parties have confirmed, we'll let the trigger handle the status update
      const { data, error: updateError } = await supabase
        .from("trade_proposals")
        .update(updateData)
        .eq("id", proposalId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Refresh the proposals list
      await fetchProposals();
      return data;
    } catch (err) {
      console.error("Error accepting trade proposal:", err);
      setError(
        err instanceof Error ? err.message : "Failed to accept trade proposal"
      );
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    proposals,
    loading,
    error,
    getProposalForMatch,
    getProposalById,
    createProposal,
    acceptProposal,
    confirmShipping,
    declineProposal,
    updateProposal,
    updateShippingStatus,
    deleteProposal,
    updateTradeStatus,
    completeTradeProposal,
    updateProposalAddresses,
    updateShippingMethod,
    refetchProposals: fetchProposals,
  };
};

export function useTradeProposalsForUser(userId?: string) {
  return useTradeProposals(userId);
}

export function useTradeProposalForMatch(matchId: string, userId?: string) {
  const {
    proposals,
    loading,
    error,
    getProposalForMatch,
    createProposal,
    updateProposal,
    updateTradeStatus,
    refetchProposals: fetchProposals
  } = useTradeProposals(userId);

  const proposal = getProposalForMatch(matchId);

  const refetch = useCallback(async () => {
    await fetchProposals();
    return getProposalForMatch(matchId);
  }, [fetchProposals, getProposalForMatch, matchId]);

  return {
    proposal,
    loading,
    error,
    createProposal,
    updateProposal,
    updateTradeStatus,
    refetch,
    fetchProposals
  };
}
