import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

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

export function useShippingPreferences(userId?: string) {
  const [shippingPreferences, setShippingPreferences] = useState<ShippingPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchShippingPreferences = useCallback(async (targetUserId?: string) => {
    console.log("=== The target User ID: ", targetUserId);
    const idToFetch = targetUserId || userId;
    if (!idToFetch) return [];
    console.log("=== The idToFetch: ", idToFetch);

    

    try {
      setLoading(true);
      setError(null);

      console.log("=== fetching shipping preferences for user: ", idToFetch);
      const { data, error: fetchError } = await supabase
        .from('shipping_preferences')
        .select('*')
        .eq('user_id', idToFetch)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Only update state if we're fetching for the current user
      if (!targetUserId) {
        setShippingPreferences(data || []);
      }

      console.log("The data from the fetchShippingPreferences is: ",data)
      
      return data || [];
    } catch (err) {
      console.error('Error fetching shipping preferences:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch shipping preferences';
      setError(errorMessage);
      throw err; // Re-throw to allow handling in the calling component
    } finally {
      if (!targetUserId) {
        setLoading(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchShippingPreferences();
    } else {
      setLoading(false);
    }
  }, [fetchShippingPreferences, userId]);

  const getDefaultShippingPreference = useCallback(() => {
    return shippingPreferences.find(p => p.is_default) || shippingPreferences[0] || null;
  }, [shippingPreferences]);

  const addShippingPreference = async (preferenceData: Omit<ShippingPreference, 'id' | 'user_id' | 'created_at'>) => {
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      setLoading(true);
      setError(null);

      // If this is the first address or is_default is true, set all other addresses to not default
      if (preferenceData.is_default || shippingPreferences.length === 0) {
        await supabase
          .from('shipping_preferences')
          .update({ is_default: false })
          .eq('user_id', userId);
      }

      const { data, error: insertError } = await supabase
        .from('shipping_preferences')
        .insert([{
          user_id: userId,
          ...preferenceData,
          is_default: preferenceData.is_default || shippingPreferences.length === 0
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      // Refetch to get the updated list
      await fetchShippingPreferences();

      return data;
    } catch (err) {
      console.error('Error adding shipping preference:', err);
      setError(err instanceof Error ? err.message : 'Failed to add shipping preference');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateShippingPreference = async (preferenceId: string, updates: Partial<ShippingPreference>) => {
    try {
      setLoading(true);
      setError(null);

      // If setting as default, update all other addresses
      if (updates.is_default) {
        await supabase
          .from('shipping_preferences')
          .update({ is_default: false })
          .eq('user_id', userId);
      }

      const { data, error: updateError } = await supabase
        .from('shipping_preferences')
        .update(updates)
        .eq('id', preferenceId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Refetch to get the updated list
      await fetchShippingPreferences();

      return data;
    } catch (err) {
      console.error('Error updating shipping preference:', err);
      setError(err instanceof Error ? err.message : 'Failed to update shipping preference');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteShippingPreference = async (preferenceId: string) => {
    try {
      setLoading(true);
      setError(null);

      // Check if this is the default address
      const preferenceToDelete = shippingPreferences.find(p => p.id === preferenceId);
      
      const { error: deleteError } = await supabase
        .from('shipping_preferences')
        .delete()
        .eq('id', preferenceId);

      if (deleteError) throw deleteError;

      // If we deleted the default address and there are other addresses, make another one default
      if (preferenceToDelete?.is_default && shippingPreferences.length > 1) {
        const nextDefault = shippingPreferences.find(p => p.id !== preferenceId);
        if (nextDefault) {
          await supabase
            .from('shipping_preferences')
            .update({ is_default: true })
            .eq('id', nextDefault.id);
        }
      }

      // Refetch to get the updated list
      await fetchShippingPreferences();

      return true;
    } catch (err) {
      console.error('Error deleting shipping preference:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete shipping preference');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    shippingPreferences,
    loading,
    error,
    fetchShippingPreferences,
    refresh: () => userId ? fetchShippingPreferences() : Promise.resolve([]),
    getDefaultShippingPreference,
    addShippingPreference,
    updateShippingPreference,
    deleteShippingPreference,
    refetchShippingPreferences: fetchShippingPreferences
  };
}