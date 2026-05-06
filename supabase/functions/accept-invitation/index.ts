import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const { token } = await req.json();
    if (!token) return new Response(JSON.stringify({ error: 'token required' }), { status: 400, headers: corsHeaders });

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const auth = req.headers.get('Authorization');
    let user = null;
    if (auth) {
      const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: auth } } });
      const { data } = await userClient.auth.getUser();
      user = data.user;
    }

    const { data: invite } = await admin.from('assessment_invitations').select('*').eq('token', token).maybeSingle();
    if (!invite) return new Response(JSON.stringify({ error: 'Invalid invitation' }), { status: 404, headers: corsHeaders });
    if (new Date(invite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Invitation expired' }), { status: 410, headers: corsHeaders });
    }

    if (!user) {
      // Just validate; client will handle auth, then call again
      return new Response(JSON.stringify({
        valid: true, requires_auth: true, vendor_id: invite.vendor_id, email: invite.email,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Bind user to vendor
    await admin.from('vendors').update({ owner_user_id: user.id }).eq('id', invite.vendor_id);
    await admin.from('assessment_invitations').update({
      status: 'accepted', accepted_at: new Date().toISOString(),
    }).eq('id', invite.id);

    return new Response(JSON.stringify({
      valid: true, requires_auth: false, vendor_id: invite.vendor_id, assessment_id: invite.assessment_id,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
