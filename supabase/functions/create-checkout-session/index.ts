import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.50.2";
import Stripe from "npm:stripe@14.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { priceId, userId, tier, billingCycle, successUrl, cancelUrl } = await req.json();

    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
    
    if (!STRIPE_SECRET_KEY) {
      throw new Error("Missing Stripe secret key");
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    } 
    
    // Determine tier and billing cycle from priceId if not explicitly provided
    const subscriptionTier = tier || (priceId?.includes('master') ? 'master' : 'elite');
    const subscriptionBillingCycle = billingCycle || (priceId?.includes('yearly') ? 'yearly' : 'monthly');
    
    console.log('Creating checkout session with:', { 
      priceId, userId, tier: subscriptionTier, billingCycle: subscriptionBillingCycle 
    }); 

    // Initialize Supabase client with service role key for admin access
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Initialize Stripe
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

    // Get user's email for the checkout session
    const { data: userData, error: userError } = await supabase
      .auth.admin.getUserById(userId);
      
    if (userError || !userData?.user) {
      throw new Error(`Error fetching user: ${userError?.message || "User not found"}`);
    }
    
    const userEmail = userData.user.email;

    // If no priceId is provided, create a demo subscription directly
    if (!priceId) {
      console.log('No priceId provided, creating demo subscription');
      
      // First, deactivate any existing subscriptions
      const { error: deactivateError } = await supabase
        .from("subscriptions")
        .update({ is_active: false }) 
        .eq("user_id", userId);

      if (deactivateError) {
        console.error("Error deactivating existing subscriptions:", deactivateError);
      }

      // Generate a unique ID for the subscription
      const subscriptionId = crypto.randomUUID();

      // Create new subscription
      const { data: subscription, error: subscriptionError } = await supabase
        .from("subscriptions") 
        .insert([{
          id: subscriptionId,
          user_id: userId,
          tier: subscriptionTier,
          billing_cycle: subscriptionBillingCycle,
          is_active: true,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (subscriptionError) {
        throw new Error(`Error creating subscription: ${subscriptionError.message}`);
      }

      // Update user's profile with new tier
      const { error: updateError } = await supabase 
        .from("users")
        .update({ 
          subscription_tier: subscriptionTier,
          subscription_status: "active"
        })
        .eq("id", userId);

      if (updateError) {
        throw new Error(`Error updating user profile: ${updateError.message}`);
      }
      
      return new Response( 
        JSON.stringify({ 
          success: true,
          subscription,
          demo: true
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200 
        }
      );
    }

    // Create a Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription', 
      success_url: successUrl || `${Deno.env.get("SITE_URL") || "http://localhost:3000"}/dashboard?success=true`,
      cancel_url: cancelUrl || `${Deno.env.get("SITE_URL") || "http://localhost:3000"}/dashboard?canceled=true`,
      customer_email: userEmail,
      metadata: {
        userId,
        tier: subscriptionTier,
        billingCycle: subscriptionBillingCycle
      }
    });
    
    return new Response(
      JSON.stringify({ 
        sessionId: session.id,
        url: session.url
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});