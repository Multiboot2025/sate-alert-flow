// Shared types + helpers for SATE.
import { supabase } from "@/integrations/supabase/client";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export const riskColor: Record<RiskLevel, string> = {
  low: "bg-[color:var(--risk-low)]/15 text-[color:var(--risk-low)] border-[color:var(--risk-low)]/30",
  medium: "bg-[color:var(--risk-medium)]/15 text-[color:var(--risk-medium)] border-[color:var(--risk-medium)]/30",
  high: "bg-[color:var(--risk-high)]/15 text-[color:var(--risk-high)] border-[color:var(--risk-high)]/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
};

export const riskLabel: Record<RiskLevel, string> = {
  low: "BAJO",
  medium: "MEDIO",
  high: "ALTO",
  critical: "CRITICO",
};

export const statusLabel: Record<string, string> = {
  open: "Abierto",
  in_review: "En revision",
  authorized: "Autorizado",
  denied: "Denegado",
  closed: "Cerrado",
};

export const policyStatusBadge: Record<string, { label: string; cls: string }> = {
  valid: { label: "VALIDA", cls: "bg-[color:var(--risk-low)]/15 text-[color:var(--risk-low)] border-[color:var(--risk-low)]/30" },
  expired: { label: "EXPIRADA", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  suspended: { label: "SUSPENDIDA", cls: "bg-[color:var(--risk-medium)]/15 text-[color:var(--risk-medium)] border-[color:var(--risk-medium)]/30" },
  invalid: { label: "INVALIDA", cls: "bg-destructive/15 text-destructive border-destructive/30" },
};

export async function invokeWebhook(payload: {
  hospital_api_key: string;
  patient_national_id: string;
  chief_complaint: string;
  triage_level: number;
  vital_signs: Record<string, any>;
}) {
  const t0 = Date.now();
  const { data, error } = await supabase.functions.invoke("emergency-admission-webhook", { body: payload });
  const elapsed = Date.now() - t0;
  return { data, error, elapsed };
}

export function formatCurrency(n: number) {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function calcAge(dob: string) {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}

export const DEMO_EMAIL = "demo@sate.health";
export const DEMO_PASSWORD = "demo1234";

export async function ensureAndSignInDemo() {
  let { error } = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
  if (error) {
    const { error: suErr } = await supabase.auth.signUp({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      options: { data: { full_name: "Dra. Patricia Robles" } },
    });
    if (suErr && !suErr.message.toLowerCase().includes("already")) throw suErr;
    const { error: si2 } = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    if (si2) throw si2;
  }
}