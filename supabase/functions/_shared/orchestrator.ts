// Shared orchestrator: validates policy, runs AI, creates case, sends notifications.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { analyzeRisk, type VitalSigns } from "./risk.ts";

export interface AdmissionPayload {
  hospital_id: string;
  patient_national_id: string;
  admitted_at?: string;
  chief_complaint: string;
  triage_level: number;
  vital_signs: VitalSigns;
}

export function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

function ageFromDob(dob: string): number {
  const d = new Date(dob);
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

function validatePolicy(
  policy: { status: string; end_date: string; start_date: string } | null,
  admittedAt: Date,
): { status: string; notes: string } {
  if (!policy) return { status: "invalid", notes: "No se encontró póliza asociada" };
  if (policy.status === "expired") return { status: "expired", notes: "Póliza expirada" };
  if (policy.status === "suspended") return { status: "suspended", notes: "Póliza suspendida" };
  if (policy.status === "cancelled") return { status: "invalid", notes: "Póliza cancelada" };
  const start = new Date(policy.start_date);
  const end = new Date(policy.end_date);
  if (admittedAt < start || admittedAt > end) {
    return { status: "expired", notes: "Fuera del periodo de vigencia" };
  }
  return { status: "valid", notes: "Póliza vigente y al día" };
}

export interface ProcessResult {
  case_id: string;
  case_code: string;
  status: "created";
  policy_validation_status: string;
  risk_level: string;
  risk_score: number;
  ai_engine: string;
}

export async function processAdmission(payload: AdmissionPayload): Promise<ProcessResult> {
  const sb = admin();

  // 1. Find patient
  const { data: patient, error: pErr } = await sb
    .from("policyholders")
    .select("*")
    .eq("national_id", payload.patient_national_id)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!patient) {
    const err: any = new Error(`No se encontró asegurado con cédula ${payload.patient_national_id}`);
    err.status = 404;
    throw err;
  }

  // 2. Find active-ish policy (most recent by end_date)
  const { data: policies } = await sb
    .from("policies")
    .select("*")
    .eq("policyholder_id", patient.id)
    .order("end_date", { ascending: false })
    .limit(1);
  const policy = policies?.[0] ?? null;

  const admittedAt = payload.admitted_at ? new Date(payload.admitted_at) : new Date();
  const policyValidation = validatePolicy(policy, admittedAt);

  // 3. Pre-existing conditions
  const { data: history } = await sb
    .from("medical_history")
    .select("condition, severity, is_preexisting")
    .eq("policyholder_id", patient.id);
  const preexisting = (history ?? []).filter((h) => h.is_preexisting);

  // 4. AI risk analysis
  const risk = await analyzeRisk({
    age: ageFromDob(patient.date_of_birth),
    preexisting: preexisting.map((p) => ({ severity: p.severity, condition: p.condition })),
    vital_signs: payload.vital_signs,
    chief_complaint: payload.chief_complaint,
    triage_level: payload.triage_level,
  });

  // 5. Assign on-call manager (round-robin by least recent assignment)
  const { data: managers } = await sb
    .from("case_managers")
    .select("id")
    .eq("is_on_call", true);
  const onCall = managers ?? [];
  let assignedManagerId: string | null = null;
  if (onCall.length) {
    const { data: lastCase } = await sb
      .from("emergency_cases")
      .select("assigned_manager_id")
      .order("created_at", { ascending: false })
      .limit(1);
    const lastMgr = lastCase?.[0]?.assigned_manager_id;
    const idx = lastMgr ? (onCall.findIndex((m) => m.id === lastMgr) + 1) % onCall.length : 0;
    assignedManagerId = onCall[idx % onCall.length].id;
  }

  // 6. Generate case code from current count
  const { count } = await sb.from("emergency_cases").select("id", { count: "exact", head: true });
  const caseNumber = (count ?? 0) + 1;
  const caseCode = `SATE-2025-${String(caseNumber).padStart(4, "0")}`;

  // 7. Insert case
  const { data: created, error: cErr } = await sb
    .from("emergency_cases")
    .insert({
      case_code: caseCode,
      policyholder_id: patient.id,
      policy_id: policy?.id ?? null,
      hospital_id: payload.hospital_id,
      assigned_manager_id: assignedManagerId,
      admitted_at: admittedAt.toISOString(),
      chief_complaint: payload.chief_complaint,
      triage_level: payload.triage_level,
      vital_signs: payload.vital_signs,
      policy_validation_status: policyValidation.status,
      policy_validation_notes: policyValidation.notes,
      risk_score: risk.risk_score,
      risk_level: risk.risk_level,
      risk_analysis: { key_factors: risk.key_factors, recommended_actions: risk.recommended_actions },
      ai_engine: risk.engine,
      status: "open",
    })
    .select()
    .single();
  if (cErr) throw new Error(cErr.message);

  // 8. Notifications
  await sendNotificationsFor(created.id);

  return {
    case_id: created.id,
    case_code: created.case_code,
    status: "created",
    policy_validation_status: policyValidation.status,
    risk_level: risk.risk_level,
    risk_score: risk.risk_score,
    ai_engine: risk.engine,
  };
}

export async function sendNotificationsFor(caseId: string) {
  const sb = admin();
  const { data: c } = await sb
    .from("emergency_cases")
    .select(`
      id, case_code, chief_complaint, risk_level, risk_score, policy_validation_status,
      policyholder:policyholders(full_name, national_id),
      policy:policies(policy_number, plan_type, coverage_limit, deductible),
      hospital:hospitals(name, admissions_contact),
      manager:case_managers!emergency_cases_assigned_manager_id_fkey(full_name, email)
    `)
    .eq("id", caseId)
    .single();
  if (!c) return;

  const policyValid = c.policy_validation_status?.toUpperCase() ?? "DESCONOCIDA";
  const riskUpper = c.risk_level?.toUpperCase() ?? "DESCONOCIDO";
  const patientName = (c.policyholder as any)?.full_name ?? "Paciente";
  const policyNumber = (c.policy as any)?.policy_number ?? "—";
  const planType = (c.policy as any)?.plan_type ?? "—";
  const coverage = (c.policy as any)?.coverage_limit ?? 0;
  const hospital = c.hospital as any;
  const manager = c.manager as any;

  // 1. Hospital admissions email
  await sb.from("notifications").insert({
    case_id: c.id,
    recipient_type: "hospital_admissions",
    recipient_name: hospital?.name ?? "Admisiones del hospital",
    channel: "email",
    subject: `[SATE] Caso ${c.case_code} — Póliza ${policyValid} — Riesgo ${riskUpper}`,
    body: [
      `Paciente: ${patientName}`,
      `Póliza: ${policyNumber} (${planType})`,
      `Estado póliza: ${policyValid}`,
      `Cobertura disponible: US$ ${Number(coverage).toLocaleString("es-EC")}`,
      `Motivo: ${c.chief_complaint}`,
      `Nivel de riesgo SATE: ${riskUpper} (score ${c.risk_score})`,
      ``,
      policyValid === "VALID"
        ? `✅ AUTORIZACIÓN PRE-APROBADA: proceder con la atención inicial. El gestor de caso se comunicará en menos de 15 minutos.`
        : `⚠️ Atención: la póliza no está vigente. Contactar al gestor antes de iniciar procedimientos electivos.`,
    ].join("\n"),
  });

  // 2. Case manager SMS
  if (manager) {
    await sb.from("notifications").insert({
      case_id: c.id,
      recipient_type: "case_manager",
      recipient_name: manager.full_name,
      channel: "sms",
      subject: `Nuevo caso ${riskUpper}`,
      body: `SATE ${c.case_code}: ${patientName} en ${hospital?.name ?? "hospital"}. Motivo: ${c.chief_complaint}. Riesgo ${riskUpper} (${c.risk_score}). Detalle: /cases/${c.id}`,
    });
  }
}