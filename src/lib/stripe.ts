import { loadStripe } from '@stripe/stripe-js';
import { supabase } from './supabase';

// Use a placeholder key for deployment
export const stripePromise = loadStripe('pk_test_placeholder');


// Stripe price IDs - replace with your actual Stripe price IDs

export const STRIPE_PRICES = {
  elite_monthly: import.meta.env.VITE_ELITE_MONTHLY_PRICE_ID,
  elite_yearly: import.meta.env.VITE_ELITE_YEARLY_PRICE_ID,
  master_monthly: import.meta.env.VITE_MASTER_MONTHLY_PRICE_ID,
  master_yearly: import.meta.env.VITE_MASTER_YEARLY_PRICE_ID,
};



// Validate that all required price IDs are configured
const validatePriceIds = () => {
  const missingPrices = Object.entries(STRIPE_PRICES)
    .filter(([_, priceId]) => !priceId || priceId.startsWith('price_1RfrlQDhxmuVRegVcTU6cZft'))
    .map(([key]) => key);
  
  if (missingPrices.length > 0) {
    console.warn(`Missing or invalid Stripe price IDs for: ${missingPrices.join(', ')}`);
    console.warn('Please update your .env file with actual Stripe price IDs from your Stripe Dashboard');
  }
};

// Validate price IDs on module load
validatePriceIds();

// Create checkout session via Supabase Edge Function
export const createCheckoutSession = async (priceId: string, userId: string, tier?: 'elite' | 'master', billingCycle?: 'monthly' | 'yearly') => {
  // For development/demo mode, use the create-subscription endpoint instead
  if (priceId.startsWith('price_1RfrlQDhxmuVRegVcTU6cZft')) {
    console.log('Using demo mode for subscription creation');
    return createDemoSubscription(userId, tier || 'elite', billingCycle || 'monthly');
  }
  
  try {
    // Validate price ID before making the request
    if (!priceId || priceId.startsWith('price_1RfrlQDhxmuVRegVcTU6cZft')) {
      throw new Error(`Invalid price ID: ${priceId}. Please configure valid Stripe price IDs in your .env file.`);
    }
    
    console.log('Creating checkout session with:', { priceId, userId, tier, billingCycle });
    
    // Use the create-checkout-session endpoint for proper Stripe session creation
    const endpoint = `${supabase.supabaseUrl}/functions/v1/create-checkout-session`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabase.supabaseKey}`
      },
      body: JSON.stringify({
        priceId,
        userId,
        tier,
        billingCycle,
        successUrl: `${window.location.origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}/dashboard`,
      }),
      timeout: 10000 // 10 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server response:', errorText);
      throw new Error(`Failed to create checkout session: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json();
    console.log('Checkout session response:', responseData);
    
    const { sessionId, url, subscription } = responseData;
    return { sessionId, url };
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};

// Create a demo subscription for testing
export const createDemoSubscription = async (userId: string, tier: 'elite' | 'master', billingCycle: 'monthly' | 'yearly') => {
  try {
    console.log('Creating demo subscription for:', { userId, tier, billingCycle });
    
    const endpoint = `${supabase.supabaseUrl}/functions/v1/create-subscription`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabase.supabaseKey}`
      },
      body: JSON.stringify({
        userId,
        tier,
        billingCycle
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create demo subscription: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error creating demo subscription:', error);
    throw error;
  }
};

// Redirect to Stripe Checkout
export const redirectToCheckout = async (priceId: string, userId: string, tier?: 'elite' | 'master', billingCycle?: 'monthly' | 'yearly') => {
  try {
    console.log('Redirecting to checkout with price ID:', priceId);
    
    try {
      const { sessionId, url } = await createCheckoutSession(priceId, userId, tier, billingCycle);
      
      // Always prioritize direct Stripe checkout when possible
      if (sessionId && !url) {
        // Use client-side redirect with Stripe.js
        const stripe = await stripePromise;
        if (!stripe) {
          throw new Error('Stripe failed to load');
        }
        
        const { error } = await stripe.redirectToCheckout({ sessionId });
        if (error) {
          throw error;
        }
        
        return true;
      } else if (url) {
        // Redirect to Stripe Checkout
        window.location.href = url;
        return true;
      }
      
      // Handle demo subscription success
      if (sessionId === 'demo_session_success') {
        console.log('Demo subscription created successfully');
        return true;
      }
    } catch (checkoutError) {
      console.error('Checkout failed, trying fallback method:', checkoutError);
      
      // Extract tier and billing cycle from priceId
      let extractedTier = tier || 'elite';
      let extractedBillingCycle = billingCycle || 'monthly';
      
      // Only extract from priceId if not explicitly provided
      if (!tier && priceId.includes('master')) {
        extractedTier = 'master';
      }
      
      if (!billingCycle && priceId.includes('yearly')) {
        extractedBillingCycle = 'yearly';
      }
      
      // Fallback to demo subscription if Stripe checkout fails
      // I have to look here, I think this is what is happening that makes it to update despite the payment having an error
      const { SubscriptionService } = await import('../services/subscriptionService');
      const subscription = await SubscriptionService.createSubscription(
        userId, 
        extractedTier, 
        extractedBillingCycle, 
        true // Force demo mode for fallback
      );
      
      if (subscription) {
        console.log(`Created ${extractedTier} ${extractedBillingCycle} subscription via fallback method:`, subscription);
        return true;
      }
      
      throw new Error('All subscription creation methods failed');
    }
    
    throw new Error('Failed to create checkout session');
  } catch (error) {
    console.error('Error redirecting to checkout:', error);
    throw error;
  }
};