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
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
    const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "whsec_test";
    
    if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
      throw new Error("Missing Stripe environment variables");
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
    });

    // Initialize Supabase client with service role key for admin access
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the signature from the headers
    const signature = req.headers.get("stripe-signature") || "";
    if (!signature) {
      throw new Error("No signature provided");
    }

    // Get the raw body
    const body = await req.text();
    
    // Use async signature verification for Deno
    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        STRIPE_WEBHOOK_SECRET
      );
    } catch (verifyError) {
      console.error("Webhook signature verification failed:", verifyError.message);
      // In development, parse the body directly
      try {
        event = JSON.parse(body);
      } catch (parseError) {
        throw new Error(`Failed to parse webhook body: ${parseError.message}`);
      }
    }
    // Handle different event types
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const tier = session.metadata?.tier;
        const billingCycle = session.metadata?.billingCycle;

        if (!userId || !tier) {
          throw new Error("Missing user ID or tier in session metadata");
        }

        // First, deactivate any existing subscriptions
        const { error: deactivateError } = await supabase
          .from("subscriptions")
          .update({ is_active: false }) 
          .eq("user_id", userId);

        if (deactivateError) {
          console.error("Error deactivating existing subscriptions:", deactivateError);
        }

        // Generate a UUID for the new subscription
        let uuid;
        if (typeof crypto !== "undefined" && crypto.randomUUID) {
          uuid = crypto.randomUUID();
        } else {
          // Fallback for environments without crypto.randomUUID
          uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        }

        // Create new subscription
        const { data: subscription, error: subscriptionError } = await supabase
          .from("subscriptions") 
          .insert([{
            id: uuid,
            user_id: userId,
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            tier: tier,
            billing_cycle: billingCycle || "monthly",
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
            subscription_tier: tier,
            subscription_status: "active"
          })
          .eq("id", userId);

        if (updateError) {
          throw new Error(`Error updating user profile: ${updateError.message}`);
        }

        break;
      }
      
      case "customer.subscription.updated": { 
        const subscription = event.data.object;
        const stripeSubscriptionId = subscription.id;
        
        // Get the user from our database
        const { data: subData, error: subError } = await supabase
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", stripeSubscriptionId) 
          .single();
        
        if (subError) {
          throw new Error(`Error finding subscription: ${subError.message}`);
        }
        
        const userId = subData.user_id;
        
        // Update subscription status based on Stripe status
        let status;
        if (subscription.status === "active") {
          status = "active";
        } else if (subscription.status === "past_due") {
          status = "past_due";
        } else if (subscription.status === "canceled") {
          status = "cancelled";
        } else if (subscription.status === "unpaid") {
          status = "past_due";
        } else {
          status = "cancelled";
        }
        
        // Update user's subscription status
        const { error: updateError } = await supabase 
          .from("users")
          .update({ subscription_status: status })
          .eq("id", userId);
          
        if (updateError) {
          throw new Error(`Error updating user subscription status: ${updateError.message}`);
        }
        
        break;
      }
      
      case "customer.subscription.deleted": { 
        const subscription = event.data.object;
        const stripeSubscriptionId = subscription.id;
        
        // Get the user from our database
        const { data: subData, error: subError } = await supabase
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", stripeSubscriptionId) 
          .single();
        
        if (subError) {
          throw new Error(`Error finding subscription: ${subError.message}`);
        }
        
        const userId = subData.user_id;
        
        // Deactivate the subscription
        const { error: deactivateError } = await supabase
          .from("subscriptions") 
          .update({ is_active: false })
          .eq("stripe_subscription_id", stripeSubscriptionId);
          
        if (deactivateError) {
          throw new Error(`Error deactivating subscription: ${deactivateError.message}`);
        }
        
        // Update user's subscription status
        const { error: updateError } = await supabase 
          .from("users")
          .update({ 
            subscription_status: "cancelled",
            subscription_tier: "trainer" // Downgrade to free tier
          })
          .eq("id", userId);
          
        if (updateError) {
          throw new Error(`Error updating user subscription status: ${updateError.message}`);
        }
        
        break;
      }
    }

    return new Response( 
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400 
      }
    );
  }
});