import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.50.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId, tier, billingCycle, priceId } = await req.json();
    
    console.log('Creating subscription:', { userId, tier, billingCycle, priceId });
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Missing required parameter: userId" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Determine tier and billing cycle from priceId if not explicitly provided
    let subscriptionTier = tier || 'elite';
    let subscriptionBillingCycle = billingCycle;

    if (!subscriptionTier && priceId) {
      subscriptionTier = priceId.includes('master') ? 'master' : 'elite';
    } else if (!subscriptionTier) {
      subscriptionTier = 'elite'; // Default
    }
    
    if (!subscriptionBillingCycle && priceId) {
      subscriptionBillingCycle = priceId.includes('yearly') ? 'yearly' : 'monthly';
    } else if (!subscriptionBillingCycle) {
      subscriptionBillingCycle = 'monthly'; // Default
    }

    // Initialize Supabase client with service role key for admin access
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    console.log('Creating new subscription record in database:', {
      id: subscriptionId,
      user_id: userId, 
      tier: subscriptionTier,
      billing_cycle: subscriptionBillingCycle
    });
    
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
    console.log('Updating user profile with new subscription tier:', subscriptionTier);
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
        sessionId: 'demo_session_success',
        url: null,
        success: true, 
        subscription 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error) {
    console.error("Error creating subscription:", error);
    
    // Log detailed error information
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});