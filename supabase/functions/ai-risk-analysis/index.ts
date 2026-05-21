import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { admin } from "../_shared/orchestrator.ts";
import { analyzeRisk } from "../_shared/risk.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { policyholder_id, vital_signs, chief_complaint, triage_level } = await req.json();
    const sb = admin();
    const { data: patient } = await sb
      .from("policyholders")
      .select("date_of_birth")
      .eq("id", policyholder_id)
      .maybeSingle();
    const { data: history } = await sb
      .from("medical_history")
      .select("condition, severity, is_preexisting")
      .eq("policyholder_id", policyholder_id);
    const age = patient
      ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000))
      : 40;
    const result = await analyzeRisk({
      age,
      preexisting: (history ?? []).filter((h) => h.is_preexisting),
      vital_signs: vital_signs ?? {},
      chief_complaint: chief_complaint ?? "",
      triage_level: triage_level ?? null,
    });
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});