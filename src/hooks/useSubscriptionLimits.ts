import { useState, useEffect } from 'react';
import { useUserProfile } from './useUserProfile';

export interface SubscriptionLimits {
  maxTradeCards: number;
  maxWantCards: number;
  canUseAdvancedMatching: boolean;
  canUseBulkUpload: boolean;
  canUseAnalytics: boolean;
  canUseRealTimeSync: boolean;
  canUseAPI: boolean;
  priceUpdateFrequency: string;
  supportLevel: string;
}

const TIER_LIMITS: Record<string, SubscriptionLimits> = {
  trainer: {
    maxTradeCards: 10,
    maxWantCards: 5,
    canUseAdvancedMatching: false,
    canUseBulkUpload: false,
    canUseAnalytics: false,
    canUseRealTimeSync: false,
    canUseAPI: false,
    priceUpdateFrequency: 'Daily',
    supportLevel: 'Standard'
  },
  elite: {
    maxTradeCards: Infinity,
    maxWantCards: Infinity,
    canUseAdvancedMatching: true,
    canUseBulkUpload: false,
    canUseAnalytics: true,
    canUseRealTimeSync: false,
    canUseAPI: false,
    priceUpdateFrequency: '4-6 hours',
    supportLevel: 'Priority'
  },
  master: {
    maxTradeCards: Infinity,
    maxWantCards: Infinity,
    canUseAdvancedMatching: true,
    canUseBulkUpload: true,
    canUseAnalytics: true,
    canUseRealTimeSync: true,
    canUseAPI: true,
    priceUpdateFrequency: 'Hourly',
    supportLevel: 'White-glove'
  }
};

export function useSubscriptionLimits(userId?: string) {
  const { profile } = useUserProfile(userId);
  const [limits, setLimits] = useState<SubscriptionLimits>(TIER_LIMITS.trainer);

  useEffect(() => {
    const tier = profile?.subscription_tier || 'trainer';
    setLimits(TIER_LIMITS[tier]);
  }, [profile?.subscription_tier]);

  const checkLimit = (type: 'trade' | 'want', currentCount: number): { allowed: boolean; message?: string } => {
    const maxAllowed = type === 'trade' ? limits.maxTradeCards : limits.maxWantCards;
    
    // Check if user has an active subscription
    const hasActiveSubscription = profile?.subscription_status === 'active';
    
    // For paid tiers, only enforce limits if subscription is not active
    if (currentCount >= maxAllowed && (profile?.subscription_tier === 'trainer' || !hasActiveSubscription)) {
      const tierName = profile?.subscription_tier === 'trainer' ? 'Free' : 
                      profile?.subscription_tier === 'elite' ? 'Elite Trainer' : 'Master Collector';
      
      return {
        allowed: false,
        message: `You've reached the ${type} card limit (${maxAllowed}) for the ${tierName} tier. Upgrade to add more cards.`
      };
    }

    return { allowed: true };
  };

  const canUseFeature = (feature: keyof SubscriptionLimits): { allowed: boolean; message?: string } => {
    const featureValue = limits[feature];
    
    // Check if user has an active subscription
    const hasActiveSubscription = profile?.subscription_status === 'active';
    
    // For paid tiers, only enforce feature restrictions if subscription is not active
    if (typeof featureValue === 'boolean' && !featureValue && 
        (profile?.subscription_tier === 'trainer' || !hasActiveSubscription)) {
      const tierName = profile?.subscription_tier === 'trainer' ? 'Free' : 
                      profile?.subscription_tier === 'elite' ? 'Elite Trainer' : 'Master Collector';
      
      const featureNames: Record<string, string> = {
        canUseAdvancedMatching: 'Advanced AI Matching',
        canUseBulkUpload: 'Bulk Upload',
        canUseAnalytics: 'Trade Analytics',
        canUseRealTimeSync: 'Real-time Sync',
        canUseAPI: 'API Access'
      };

      return {
        allowed: false,
        message: `${featureNames[feature]} is not available in the ${tierName} tier. Upgrade to unlock this feature.`
      };
    }

    return { allowed: true };
  };

  return {
    limits,
    checkLimit,
    canUseFeature,
    currentTier: profile?.subscription_tier || 'trainer'
  };
}