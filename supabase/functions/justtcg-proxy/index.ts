// supabase/functions/justtcg-proxy/index.ts
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };

const BASE_URL = 'https://api.justtcg.com/v1';
  
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: corsHeaders
      });
    }
  
    try {
      const url = new URL(req.url);
      const name = url.searchParams.get('name');
      const set = url.searchParams.get('set');
      const limit = url.searchParams.get('limit') || '10';
      
      if (!name) {
        return new Response(JSON.stringify({ error: 'Missing required parameter: name' }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
  
      const JUSTTCG_API_KEY = Deno.env.get('JUSTTCG_API_KEY');
      if (!JUSTTCG_API_KEY) {
        throw new Error('JUSTTCG_API_KEY is not set');
      }
  
      // Build query parameters
        const apiUrl = new URL(`${BASE_URL}/cards`);
        apiUrl.searchParams.append('q', name);
        if (set) {
            apiUrl.searchParams.append('set', set);
        }
        apiUrl.searchParams.append('limit', limit);

        console.log("THE JUSTTCG API URL IS: ", apiUrl.toString());

        const response = await fetch(apiUrl, {
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': JUSTTCG_API_KEY
            }
        });

    //   const apiUrl = new URL(`${BASE_URL}/cards`);
    //   if (set) {
    //     apiUrl.searchParams.append('set', set);
    //   }
    //   apiUrl.searchParams.append('name', name);
    //   apiUrl.searchParams.append('limit', limit);
      
    //   console.log("THE JUSTTCG API URL IS: ", apiUrl.toString());
      
    //   const response = await fetch(apiUrl, {
    //     headers: {
    //       'Content-Type': 'application/json',
    //       'X-API-Key': JUSTTCG_API_KEY
    //     }
    //   });
  
      const data = await response.json();
      console.log('JustTCG Proxy response:', data);
      return new Response(JSON.stringify(data), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: response.status
      });
  
    } catch (error) {
      console.error("Error processing TCG:", error);
      return new Response(JSON.stringify({
        error: error.message
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: error.status || 500
      });
    }
  });