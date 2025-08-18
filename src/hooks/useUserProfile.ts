import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '../types';

export function useUserProfile(userId?: string) {
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completedTrades, setCompletedTrades] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;

    const fetchProfile = async () => {
      if (!userId) {
        if (mounted) {
          setProfile(null);
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        console.log('Fetching profile for user:', userId);

        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (error) {
          console.error('Profile fetch error:', error);
          throw error;
        }

        if (!mounted) return;

        if (!data) {
          console.log('No profile found, creating default profile');
          // User doesn't exist, create a default profile
          const defaultProfile = {
            id: userId,
            username: `User${userId.slice(-4)}`,
            email: null,
            profile_image_url: null,
            total_trades: 0,
            match_success_rate: 0,
            average_value_traded: 0,
            reputation_score: 5.0,
            shipping_preference: 'direct',
            trade_percentage_min: 80,
          };

          const { data: newProfile, error: insertError } = await supabase
            .from('users')
            .insert([defaultProfile])
            .select()
            .single();

          if (insertError) {
            console.error('Profile creation error:', insertError);
            throw insertError;
          }

          if (!mounted) return;

          const formattedProfile: User = {
            id: newProfile.id,
            username: newProfile.username,
            email: newProfile.email || undefined,
            profile_image_url: newProfile.profile_image_url || undefined,
            total_trades: newProfile.total_trades || 0,
            match_success_rate: newProfile.match_success_rate || 0,
            average_value_traded: newProfile.average_value_traded || 0,
            reputation_score: newProfile.reputation_score || 5.0,
            shipping_preference: (newProfile.shipping_preference as User['shipping_preference']) || 'direct',
            trade_percentage_min: Number(newProfile.trade_percentage_min) || 80,
            subscription_tier: (newProfile.subscription_tier as User['subscription_tier']) || 'trainer',
            subscription_status: (newProfile.subscription_status as User['subscription_status']) || undefined,
          };
          setProfile(formattedProfile);
        } else {
          console.log('Profile found:', data.username);
          const formattedProfile: User = {
            id: data.id,
            username: data.username,
            email: data.email || undefined, 
            profile_image_url: data.profile_image_url || undefined,
            total_trades: data.total_trades || 0,
            match_success_rate: data.match_success_rate || 0,
            average_value_traded: data.average_value_traded || 0,
            reputation_score: data.reputation_score || 5.0,
            shipping_preference: (data.shipping_preference as User['shipping_preference']) || 'direct',
            trade_percentage_min: Number(data.trade_percentage_min) || 80,
            subscription_tier: (data.subscription_tier as User['subscription_tier']) || 'trainer', 
            subscription_status: (data.subscription_status as User['subscription_status']) || undefined,
          };
          setProfile(formattedProfile);
        }

        // Fetch completed trades
        await fetchCompletedTrades(userId);
      } catch (err) {
        console.error('Profile error:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'An error occurred');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    const fetchCompletedTrades = async (userId: string) => {
      try {
        const { data: trades, error: tradesError } = await supabase
          .from('trade_proposals')
          .select(`
            *,
            match:matches(
              *,
              user1:users!matches_user1_id_fkey(username, profile_image_url),
              user2:users!matches_user2_id_fkey(username, profile_image_url),
              user1_card:cards!matches_user1_card_id_fkey(*),
              user2_card:cards!matches_user2_card_id_fkey(*)
            )
          `)
          .eq('status', 'completed')
          .or(`proposer_id.eq.${userId},recipient_id.eq.${userId}`)
          .order('completed_at', { ascending: false });

        if (tradesError) {
          console.error('Error fetching completed trades:', tradesError);
          return;
        }

        if (mounted) {
          setCompletedTrades(trades || []);
        }
      } catch (error) {
        console.error('Error in fetchCompletedTrades:', error);
      }
    };
    fetchProfile();

    return () => {
      mounted = false;
    };
  }, [userId]);

  const updateProfile = async (updates: Partial<User>) => {
    try {
      if (!userId) {
        throw new Error('No user ID provided');
      }

      const { error } = await supabase
        .from('users')
        .update({
          username: updates.username,
          email: updates.email,
          profile_image_url: updates.profile_image_url,
          shipping_preference: updates.shipping_preference,
          trade_percentage_min: updates.trade_percentage_min,
          subscription_tier: updates.subscription_tier,
          subscription_status: updates.subscription_status
        }) 
        .eq('id', userId);

      if (error) throw error;

      // Refresh the profile
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (fetchError) throw fetchError;

      const formattedProfile: User = {
        id: data.id,
        username: data.username,
        email: data.email || undefined,
        profile_image_url: data.profile_image_url || undefined,
        total_trades: data.total_trades || 0,
        match_success_rate: data.match_success_rate || 0,
        average_value_traded: data.average_value_traded || 0,
        reputation_score: data.reputation_score || 5.0,
        shipping_preference: (data.shipping_preference as User['shipping_preference']) || 'direct',
        trade_percentage_min: Number(data.trade_percentage_min) || 80,
        subscription_tier: (data.subscription_tier as User['subscription_tier']) || 'trainer', 
        subscription_status: (data.subscription_status as User['subscription_status']) || undefined,
      };
      setProfile(formattedProfile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
      throw err;
    }
  };

  return {
    profile,
    loading,
    error,
    completedTrades,
    updateProfile,
    refetch: () => {
      if (userId) {
        setLoading(true);
        setError(null);
      }
    },
  };
}