import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const GEOGRID_API_KEY = Deno.env.get('GEOGRID_API_KEY');
  const GEOGRID_BASE_URL = Deno.env.get('GEOGRID_BASE_URL');

  if (!GEOGRID_API_KEY || !GEOGRID_BASE_URL) {
    return new Response(JSON.stringify({ error: 'GeoGrid credentials not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const startTime = Date.now();

  try {
    const { endpoint, method = 'GET', params } = await req.json();

    if (!endpoint) {
      return new Response(JSON.stringify({ error: 'Missing endpoint parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const baseUrl = GEOGRID_BASE_URL.startsWith('http') ? GEOGRID_BASE_URL : `https://${GEOGRID_BASE_URL}`;
    const url = new URL(`${baseUrl}/${endpoint}`);
    if (params && typeof params === 'object') {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      });
    }

    console.log(`GeoGrid request: ${method} ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method,
      headers: {
        'api-key': GEOGRID_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    const durationMs = Date.now() - startTime;
    const contentType = response.headers.get('content-type') || '';
    let data: any;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Log the request (fire-and-forget)
    supabaseAdmin.from('api_request_logs').insert({
      integration_name: 'GeoGrid',
      endpoint,
      method,
      request_params: params || null,
      response_status: response.status,
      response_ok: response.ok,
      response_body: typeof data === 'object' ? { count: Array.isArray(data) ? data.length : 1, preview: Array.isArray(data) ? data.slice(0, 2) : null } : { raw: String(data).slice(0, 500) },
      duration_ms: durationMs,
    }).then(() => {});

    return new Response(JSON.stringify({
      status: response.status,
      ok: response.ok,
      data,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    const durationMs = Date.now() - startTime;

    // Log the error
    supabaseAdmin.from('api_request_logs').insert({
      integration_name: 'GeoGrid',
      endpoint: 'unknown',
      method: 'unknown',
      error_message: error?.message ?? String(error),
      response_ok: false,
      duration_ms: durationMs,
    }).then(() => {});

    console.error('GeoGrid proxy error:', error);
    return new Response(JSON.stringify({ error: error?.message ?? String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
