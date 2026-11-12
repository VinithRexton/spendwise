import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    const senderEmail = Deno.env.get("BREVO_SENDER_EMAIL");
    const senderName = Deno.env.get("BREVO_SENDER_NAME") || "SpendWise";
    const appUrl = Deno.env.get("APP_URL") || "https://vinithrexton.github.io/spendwise/login";

    if (!supabaseUrl || !anonKey || !serviceRoleKey || !brevoApiKey || !senderEmail) {
      return json({ error: "Email service is not fully configured. Check Edge Function secrets." }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Authentication required." }, 401);
    const token = authHeader.slice("Bearer ".length);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Your session is invalid. Please sign in again." }, 401);
    const caller = userData.user;

    const payload = await req.json().catch(() => ({}));
    const inviteId = payload?.inviteId;
    if (typeof inviteId !== "string" || !inviteId) return json({ error: "Invitation ID is required." }, 400);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: invite, error: inviteError } = await admin
      .from("workspace_invites")
      .select("id,workspace_id,invited_email,invited_by,status,expires_at")
      .eq("id", inviteId)
      .maybeSingle();

    if (inviteError || !invite) return json({ error: "Invitation not found." }, 404);
    if (invite.invited_by !== caller.id) return json({ error: "Only the invitation creator can send this email." }, 403);
    if (invite.status !== "pending") return json({ error: "This invitation is no longer pending." }, 409);
    if (new Date(invite.expires_at).getTime() <= Date.now()) return json({ error: "This invitation has expired. Create a new invitation." }, 410);

    const { data: workspace, error: workspaceError } = await admin
      .from("workspaces")
      .select("id,name,owner_id")
      .eq("id", invite.workspace_id)
      .maybeSingle();

    if (workspaceError || !workspace || workspace.owner_id !== caller.id) {
      return json({ error: "You are not authorized to send invitations for this workspace." }, 403);
    }

    const safeWorkspaceName = String(workspace.name || "Shared Workspace")
      .replace(/[<>&"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[char]));
    const safeEmail = String(invite.invited_email).replace(/[<>&"]/g, "");
    const loginUrl = appUrl;

    const htmlContent = `
      <!doctype html>
      <html>
        <body style="margin:0;padding:32px 16px;background:#f5f6fb;font-family:Arial,sans-serif;color:#172033">
          <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e8e9f2;border-radius:18px;padding:32px">
            <div style="font-size:22px;font-weight:700;color:#6257f5">SpendWise</div>
            <h1 style="font-size:24px;margin:24px 0 12px">You’re invited to a Shared Workspace</h1>
            <p style="font-size:15px;line-height:1.7;color:#596174">You have been invited to join <strong>${safeWorkspaceName}</strong> on SpendWise.</p>
            <p style="font-size:15px;line-height:1.7;color:#596174">Sign in or create a SpendWise account using <strong>${safeEmail}</strong>. After signing in, open Shared Mode and select <strong>Accept invitation</strong>.</p>
            <p style="margin:28px 0"><a href="${loginUrl}" style="display:inline-block;padding:14px 22px;border-radius:10px;background:#6257f5;color:#ffffff;text-decoration:none;font-weight:700">Open SpendWise</a></p>
            <p style="font-size:13px;line-height:1.6;color:#7b8497">This invitation expires ${new Date(invite.expires_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}. If you were not expecting this email, you can ignore it.</p>
          </div>
        </body>
      </html>`;

    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": brevoApiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: invite.invited_email }],
        subject: `You're invited to ${workspace.name || "SpendWise Shared Workspace"}`,
        htmlContent,
        textContent: `You have been invited to ${workspace.name || "Shared Workspace"} on SpendWise. Sign in or create an account using ${invite.invited_email}, then open Shared Mode and accept the invitation: ${loginUrl}`,
      }),
    });

    if (!brevoResponse.ok) {
      const details = await brevoResponse.text();
      console.error("Brevo send failed:", brevoResponse.status, details);
      return json({ error: "Brevo could not send the email. Check the sender, API key permissions, and Brevo account status." }, 502);
    }

    const brevoResult = await brevoResponse.json();
    return json({ success: true, messageId: brevoResult.messageId || null });
  } catch (error) {
    console.error("send-workspace-invite failed:", error);
    return json({ error: "Unexpected error while sending the invitation email." }, 500);
  }
});
