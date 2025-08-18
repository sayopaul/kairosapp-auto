import { supabase } from '../lib/supabase';

export interface SubscriptionData {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  tier: 'trainer' | 'elite' | 'master';
  billing_cycle: 'monthly' | 'yearly';
  is_active: boolean;
  created_at: string;
}

export class SubscriptionService {
  // Get user's current subscription
  static async getUserSubscription(userId: string): Promise<SubscriptionData | null> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Error fetching subscription:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getUserSubscription:', error);
      return null;
    }
  }

  // Create or update subscription (for demo purposes)
  static async createSubscription(
    userId: string, 
    tier: 'elite' | 'master', 
    billingCycle: 'monthly' | 'yearly', 
    demoMode: boolean = false
  ): Promise<SubscriptionData | null> {
    try {
      console.log('Creating subscription via edge function:', { userId, tier, billingCycle });
      
      if (demoMode) {
        console.log('DEMO MODE: Creating subscription directly in database');
        const demoSubscription = await this.createDemoSubscription(userId, tier, billingCycle);
        if (demoSubscription) {
          // Update user profile with subscription status
          await supabase
            .from('users')
            .update({
              subscription_tier: tier,
              subscription_status: 'active'
            })
            .eq('id', userId);
        }
        return demoSubscription;
      }
      
      // Call the Supabase Edge Function to create the subscription
      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/create-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabase.supabaseKey}`
        },
        body: JSON.stringify({
          userId,
          tier,
          billingCycle,
        }) 
      });
      
      if (!response.ok) {
        console.error('Edge function response not OK:', response.status, response.statusText);
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create subscription');
      }
      
      const { subscription, success } = await response.json();
      console.log('Subscription created successfully:', subscription);
      return subscription;
    } catch (error) {
      console.error('Error in createSubscription:', error);
      return null;
    }
  };
  
  // Create a demo subscription directly in the database (for testing only)
  private static async createDemoSubscription(
    userId: string, 
    tier: 'elite' | 'master', 
    billingCycle: 'monthly' | 'yearly'
  ): Promise<SubscriptionData | null> {
    try {
      console.log('Creating demo subscription directly in database');
      
      // First, deactivate any existing subscriptions 
      const { error: deactivateError } = await supabase
        .from('subscriptions')
        .update({ is_active: false })
        .eq('user_id', userId);

      if (deactivateError) {
        console.error('Error deactivating existing subscriptions:', deactivateError);
      }

      // Generate a unique ID for the subscription
      const subscriptionId = crypto.randomUUID();

      const { data, error: insertError } = await supabase
        .from('subscriptions')
        .insert([{
          id: subscriptionId,
          user_id: userId,
          tier: tier,
          billing_cycle: billingCycle,
          is_active: true, 
          created_at: new Date().toISOString()
        }])
        .select()
        .single();
        
      if (insertError) {
        console.error('Demo subscription creation failed:', insertError);
        throw new Error(`Demo subscription creation failed: ${insertError.message}`);
      }
      
      // Update user profile
      await supabase
        .from('users')
        .update({
          subscription_tier: tier,
          subscription_status: 'active' 
        })
        .eq('id', userId);
        
      console.log('Demo subscription created successfully:', data);
      
      return data;
    } catch (error) {
      console.error('Error in createDemoSubscription:', error);
      return null;
    }
  }

  // Cancel subscription
  static async cancelSubscription(userId: string): Promise<boolean> {
    try {
      // Call the Supabase Edge Function to cancel the subscription
      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/cancel-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabase.supabaseKey}`
        },
        body: JSON.stringify({
          userId
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel subscription');
      }
      
      const { success } = await response.json();
      if (!success) {
        throw new Error('Failed to cancel subscription');
      }
      
      return true;
    } catch (error) {
      console.error('Error in cancelSubscription:', error);
      return false;
    }
  }

  // Reactivate subscription
  static async reactivateSubscription(userId: string): Promise<boolean> {
    try {
      // This would call a reactivate-subscription edge function in production
      // For now, we'll just create a new subscription with the same tier
      const { data: existingSubscription } = await supabase
        .from('subscriptions')
        .select('tier, billing_cycle')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (!existingSubscription) {
        throw new Error('No subscription found to reactivate');
      }
      
      const result = await this.createSubscription(
        userId, 
        existingSubscription.tier as 'elite' | 'master',
        existingSubscription.billing_cycle as 'monthly' | 'yearly'
      );
      
      return !!result;
    } catch (error) {
      console.error('Error in reactivateSubscription:', error);
      return false;
    }
  }
}