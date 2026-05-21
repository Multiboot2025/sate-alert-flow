import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { admin, processAdmission } from "../_shared/orchestrator.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const t0 = Date.now();
  let body: any = null;
  let hospitalId: string | null = null;
  let caseId: string | null = null;
  let status = 200;
  let response: any = {};

  try {
    body = await req.json();
    const { hospital_api_key, patient_national_id, admitted_at, chief_complaint, triage_level, vital_signs } = body ?? {};

    if (!hospital_api_key || !patient_national_id || !chief_complaint) {
      status = 400;
      response = { error: "Faltan campos obligatorios" };
    } else {
      const sb = admin();
      const { data: hospital } = await sb
        .from("hospitals")
        .select("id, name")
        .eq("api_key", hospital_api_key)
        .maybeSingle();

      if (!hospital) {
        status = 401;
        response = { error: "API key de hospital inválida" };
      } else {
        hospitalId = hospital.id;
        try {
          const result = await processAdmission({
            hospital_id: hospital.id,
            patient_national_id,
            admitted_at,
            chief_complaint,
            triage_level: Number(triage_level ?? 3),
            vital_signs: vital_signs ?? {},
          });
          caseId = result.case_id;
          response = result;
        } catch (e: any) {
          status = e.status ?? 500;
          response = { error: e.message ?? "Error procesando admisión" };
        }
      }
    }
  } catch (e: any) {
    status = 400;
    response = { error: "Payload JSON inválido", detail: e.message };
  }

  // Log webhook
  try {
    const sb = admin();
    await sb.from("webhook_logs").insert({
      hospital_id: hospitalId,
      payload: body,
      response,
      status_code: status,
      processing_time_ms: Date.now() - t0,
      case_id: caseId,
    });
  } catch (_) { /* ignore log failure */ }

  return new Response(JSON.stringify(response), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});