// supabase/functions/pokemon-price-tracker-proxy/index.ts
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
  
  const BASE_URL = 'https://www.pokemonpricetracker.com/api';
  
  Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: corsHeaders
      });
    }
  
    try {
      const url = new URL(req.url);
      const path = url.pathname.replace('/pokemon-price-tracker-proxy', '');
      const endpoint = `${BASE_URL}${path}${url.search}`;
  
      console.log(`Proxying request to: ${endpoint}`);
  
      const POKEMON_PRICE_TRACKER_API_KEY = Deno.env.get('POKEMON_PRICE_TRACKER_API_KEY');
      console.log(`POKEMON_PRICE_TRACKER_API_KEY: ${POKEMON_PRICE_TRACKER_API_KEY}`);
      if (!POKEMON_PRICE_TRACKER_API_KEY) {
        throw new Error('POKEMON_PRICE_TRACKER_API_KEY is not set');
      }
  
      const headers = new Headers();
      headers.set('Authorization', `Bearer ${POKEMON_PRICE_TRACKER_API_KEY}`);
      headers.set('Content-Type', 'application/json');
  
      // Forward the request to the Pokemon Price Tracker API
      
      const response = await fetch(endpoint, {
        method: req.method,
        headers,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined
      });
  
      // Get the response data
      const data = await response.text();

      console.log(`Response data: ${data}`)
      
      // Return the response with CORS headers
      return new Response(data, {
        status: response.status,
        headers: {
          ...corsHeaders,
          'Content-Type': response.headers.get('Content-Type') || 'application/json'
        }
      });
  
    } catch (error) {
      console.error("Error in Pokemon Price Tracker proxy:", error);
      return new Response(JSON.stringify({
        error: error.message || 'Internal server error'
      }), {
        status: error.status || 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
  });