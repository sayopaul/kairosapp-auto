import { useState, useEffect } from 'react';
import { SubscriptionService, SubscriptionData } from '../services/subscriptionService';
import { useAuth } from './useAuth';

export function useSubscription(userId?: string) {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { refetch: refetchAuth } = useAuth();

  useEffect(() => {
    if (!userId) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    fetchSubscription();
  }, [userId]);

  const fetchSubscription = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);
      
      const data = await SubscriptionService.getUserSubscription(userId);
      setSubscription(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch subscription');
    } finally {
      setLoading(false);
    }
  };

  const cancelSubscription = async () => {
    if (!userId) return false;

    try {
      const success = await SubscriptionService.cancelSubscription(userId);
      if (success) {
        // Refresh subscription data and auth state
        await fetchSubscription();
        if (refetchAuth) await refetchAuth();
      }
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription');
      return false;
    }
  };

  const reactivateSubscription = async () => {
    if (!userId) return false;

    try {
      const success = await SubscriptionService.reactivateSubscription(userId);
      if (success) {
        // Refresh subscription data and auth state
        await fetchSubscription();
        if (refetchAuth) await refetchAuth();
      }
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reactivate subscription');
      return false;
    }
  };

  return {
    subscription,
    loading,
    error,
    cancelSubscription,
    reactivateSubscription,
    refetch: fetchSubscription
  };
}