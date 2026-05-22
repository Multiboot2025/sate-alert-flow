import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ensureAndSignInDemo,
  invokeWebhook,
  riskColor,
  riskLabel,
  statusLabel,
  type RiskLevel,
} from "@/lib/sate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Activity, AlertTriangle, BellRing, CheckCircle2, FileCheck2, Gauge, HeartPulse, Hospital, Loader2, Play, ShieldAlert, Siren, Stethoscope, User, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SATE — Sistema de Alerta Temprana de Emergencias" },
      { name: "description", content: "Sistema de Alerta Temprana de Ingresos a Emergencias para aseguradoras de salud." },
    ],
  }),
  component: HomePage,
});

type CaseRow = {
  id: string;
  case_code: string;
  chief_complaint: string;
  status: string;
  triage_level: number | null;
  risk_score: number | null;
  risk_level: RiskLevel | null;
  ai_engine: string | null;
  policy_validation_status: string | null;
  admitted_at: string;
  hospital_id: string | null;
};

const DEMO_HOSPITAL_KEY = "hk_metropolitano_a1b2c3";

const SCENARIOS = [
  {
    label: "Crítico · Dolor torácico",
    payload: {
      hospital_api_key: DEMO_HOSPITAL_KEY,
      patient_national_id: "1001234567",
      chief_complaint: "Dolor torácico opresivo irradiado a brazo izquierdo, disnea súbita",
      triage_level: 1,
      vital_signs: { heart_rate: 132, systolic_bp: 178, diastolic_bp: 105, oxygen_saturation: 89, temperature: 37.2, respiratory_rate: 28 },
    },
  },
  {
    label: "Alto · Politraumatismo",
    payload: {
      hospital_api_key: DEMO_HOSPITAL_KEY,
      patient_national_id: "1001234570",
      chief_complaint: "Politraumatismo por accidente de tránsito, fractura abierta",
      triage_level: 2,
      vital_signs: { heart_rate: 118, systolic_bp: 95, diastolic_bp: 60, oxygen_saturation: 94, temperature: 36.5, respiratory_rate: 24 },
    },
  },
  {
    label: "Medio · Cuadro febril",
    payload: {
      hospital_api_key: DEMO_HOSPITAL_KEY,
      patient_national_id: "1001234572",
      chief_complaint: "Fiebre alta persistente con vómito y deshidratación moderada",
      triage_level: 3,
      vital_signs: { heart_rate: 102, systolic_bp: 122, diastolic_bp: 78, oxygen_saturation: 97, temperature: 39.4, respiratory_rate: 20 },
    },
  },
];

function HomePage() {
  const [authed, setAuthed] = useState(false);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await ensureAndSignInDemo();
        if (!alive) return;
        setAuthed(true);
      } catch (e: any) {
        toast.error("No se pudo iniciar sesión demo: " + e.message);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const refreshCases = async () => {
    const { data, error } = await supabase
      .from("emergency_cases")
      .select("id, case_code, chief_complaint, status, triage_level, risk_score, risk_level, ai_engine, policy_validation_status, admitted_at, hospital_id")
      .order("admitted_at", { ascending: false })
      .limit(25);
    if (!error && data) setCases(data as CaseRow[]);
  };

  useEffect(() => {
    if (!authed) return;
    refreshCases();
    const channel = supabase
      .channel("sate-cases")
      .on("postgres_changes", { event: "*", schema: "public", table: "emergency_cases" }, () => {
        refreshCases();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [authed]);

  const kpis = useMemo(() => {
    const open = cases.filter((c) => c.status === "open").length;
    const critical = cases.filter((c) => c.risk_level === "critical" || c.risk_level === "high").length;
    const denied = cases.filter((c) => c.policy_validation_status && c.policy_validation_status !== "valid").length;
    return { total: cases.length, open, critical, denied };
  }, [cases]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Siren className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">SATE</h1>
              <p className="text-xs text-muted-foreground">Sistema de Alerta Temprana de Emergencias</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5">
              <span className={`h-2 w-2 rounded-full ${authed ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
              {authed ? "Conectado" : "Conectando…"}
            </Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard icon={<Activity className="h-4 w-4" />} label="Casos totales" value={kpis.total} />
          <KpiCard icon={<HeartPulse className="h-4 w-4" />} label="Abiertos" value={kpis.open} accent="text-emerald-500" />
          <KpiCard icon={<AlertTriangle className="h-4 w-4" />} label="Alto / Crítico" value={kpis.critical} accent="text-destructive" />
          <KpiCard icon={<Hospital className="h-4 w-4" />} label="Pólizas observadas" value={kpis.denied} accent="text-amber-500" />
        </section>

        <Tabs defaultValue="dashboard" className="mt-6">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="simulator">Simulador</TabsTrigger>
            <TabsTrigger value="demo">Demo en vivo</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <CasesTable cases={cases} onSelect={setSelectedCaseId} />
              <AgentRulesPanel />
            </div>
          </TabsContent>

          <TabsContent value="simulator" className="mt-4">
            <Simulator onDone={refreshCases} />
          </TabsContent>

          <TabsContent value="demo" className="mt-4">
            <DemoRunner onDone={refreshCases} />
          </TabsContent>
        </Tabs>
      </main>
      <CaseDetailDrawer caseId={selectedCaseId} onClose={() => setSelectedCaseId(null)} />
    </div>
  );
}

function KpiCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs uppercase tracking-wider">{label}</span>
          <span className={accent ?? ""}>{icon}</span>
        </div>
        <div className={`mt-2 text-3xl font-bold ${accent ?? ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function CasesTable({ cases, onSelect }: { cases: CaseRow[]; onSelect: (id: string) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Stethoscope className="h-4 w-4 text-primary" /> Ingresos a emergencia · tiempo real
        </CardTitle>
      </CardHeader>
      <CardContent>
        {cases.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Aún no hay casos. Lanza un escenario desde el Simulador o la pestaña Demo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border/60">
                  <th className="py-2 pr-3">Caso</th>
                  <th className="py-2 pr-3">Motivo</th>
                  <th className="py-2 pr-3">Triage</th>
                  <th className="py-2 pr-3">Riesgo</th>
                  <th className="py-2 pr-3">Póliza</th>
                  <th className="py-2 pr-3">Motor IA</th>
                  <th className="py-2 pr-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => onSelect(c.id)}
                    className="cursor-pointer border-b border-border/30 transition-colors hover:bg-muted/40"
                  >
                    <td className="py-2 pr-3 font-mono text-xs">{c.case_code}</td>
                    <td className="py-2 pr-3 max-w-xs truncate">{c.chief_complaint}</td>
                    <td className="py-2 pr-3">T{c.triage_level ?? "-"}</td>
                    <td className="py-2 pr-3">
                      {c.risk_level ? (
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${riskColor[c.risk_level]}`}>
                          {riskLabel[c.risk_level]} · {c.risk_score ?? 0}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variant={c.policy_validation_status === "valid" ? "secondary" : "destructive"}>
                        {c.policy_validation_status ?? "—"}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{c.ai_engine ?? "—"}</td>
                    <td className="py-2 pr-3">{statusLabel[c.status] ?? c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted-foreground">💡 Haz clic en un caso para ver la trazabilidad del agente paso a paso.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const AGENT_RULES: Array<{ label: string; pts: string; cond: string }> = [
  { label: "Triaje crítico (T1)", pts: "+40", cond: "triage_level === 1" },
  { label: "Triaje emergente (T2)", pts: "+25", cond: "triage_level === 2" },
  { label: "Triaje urgente (T3)", pts: "+10", cond: "triage_level === 3" },
  { label: "Pre-existencia grave", pts: "+15", cond: "severity === 'grave'" },
  { label: "Pre-existencia moderada", pts: "+8", cond: "severity === 'moderada'" },
  { label: "SpO₂ baja", pts: "+20", cond: "oxygen_saturation < 92%" },
  { label: "Presión sistólica anormal", pts: "+15", cond: "BP < 90 ó > 180 mmHg" },
  { label: "FC anormal", pts: "+10", cond: "HR < 50 ó > 120 lpm" },
  { label: "Adulto mayor", pts: "+10", cond: "edad > 65 años" },
];

function AgentRulesPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="h-4 w-4 text-primary" /> Reglas activas del agente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs">
          <div className="mb-2 font-semibold text-foreground">Clasificación por score</div>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded border px-1.5 py-0.5 bg-[color:var(--risk-low)]/15 text-[color:var(--risk-low)] border-[color:var(--risk-low)]/30">BAJO &lt; 30</span>
            <span className="rounded border px-1.5 py-0.5 bg-[color:var(--risk-medium)]/15 text-[color:var(--risk-medium)] border-[color:var(--risk-medium)]/30">MEDIO 30-54</span>
            <span className="rounded border px-1.5 py-0.5 bg-[color:var(--risk-high)]/15 text-[color:var(--risk-high)] border-[color:var(--risk-high)]/30">ALTO 55-79</span>
            <span className="rounded border px-1.5 py-0.5 bg-destructive/15 text-destructive border-destructive/30">CRÍTICO ≥ 80</span>
          </div>
        </div>
        <ul className="space-y-1.5 text-xs">
          {AGENT_RULES.map((r) => (
            <li key={r.label} className="flex items-start gap-2 rounded-md border border-border/40 p-2">
              <span className="mt-0.5 inline-flex h-5 min-w-[36px] items-center justify-center rounded bg-primary/15 px-1.5 font-mono text-[10px] font-bold text-primary">
                {r.pts}
              </span>
              <div className="min-w-0">
                <div className="font-medium">{r.label}</div>
                <code className="block truncate text-[10px] text-muted-foreground">{r.cond}</code>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-muted-foreground">
          Si <code>OPENAI_API_KEY</code> está configurada el motor IA reemplaza este puntaje; si falla, el agente cae automáticamente a estas reglas.
        </p>
      </CardContent>
    </Card>
  );
}

function CaseDetailDrawer({ caseId, onClose }: { caseId: string | null; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!caseId) {
      setData(null);
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      const [{ data: c }, { data: notifs }] = await Promise.all([
        supabase
          .from("emergency_cases")
          .select(
            `*,
            policyholder:policyholders(full_name, national_id, date_of_birth),
            policy:policies(policy_number, plan_type, status, start_date, end_date, coverage_limit, deductible),
            hospital:hospitals(name),
            manager:case_managers!emergency_cases_assigned_manager_id_fkey(full_name, email, phone)`,
          )
          .eq("id", caseId)
          .maybeSingle(),
        supabase.from("notifications").select("*").eq("case_id", caseId).order("created_at", { ascending: true }),
      ]);
      let history: any[] = [];
      if (c?.policyholder_id) {
        const { data: h } = await supabase
          .from("medical_history")
          .select("condition, severity, is_preexisting, diagnosed_at")
          .eq("policyholder_id", c.policyholder_id);
        history = h ?? [];
      }
      if (alive) {
        setData({ c, notifs: notifs ?? [], history });
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [caseId]);

  const c = data?.c;
  const preexisting = (data?.history ?? []).filter((h: any) => h.is_preexisting);
  const risk = c?.risk_analysis ?? {};
  const policyValid = c?.policy_validation_status === "valid";

  return (
    <Sheet open={!!caseId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="font-mono text-base">{c?.case_code ?? "Caso"}</SheetTitle>
          <SheetDescription>Trazabilidad del agente SATE — qué validó y por qué.</SheetDescription>
        </SheetHeader>

        {loading || !c ? (
          <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando trazabilidad…
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Paciente */}
            <Step
              n={1}
              title="Identificación del paciente"
              icon={<HeartPulse className="h-4 w-4" />}
              ok={!!c.policyholder}
            >
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Field k="Nombre" v={c.policyholder?.full_name} />
                <Field k="Cédula" v={c.policyholder?.national_id} />
                <Field k="Motivo" v={c.chief_complaint} full />
                <Field k="Hospital" v={c.hospital?.name} />
                <Field k="Triage" v={`T${c.triage_level ?? "-"}`} />
              </div>
            </Step>

            {/* Póliza */}
            <Step
              n={2}
              title="Validación de póliza"
              icon={<FileCheck2 className="h-4 w-4" />}
              ok={policyValid}
            >
              {c.policy ? (
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <Field k="Número" v={c.policy.policy_number} />
                    <Field k="Plan" v={c.policy.plan_type} />
                    <Field k="Vigencia" v={`${c.policy.start_date} → ${c.policy.end_date}`} full />
                    <Field k="Cobertura" v={`US$ ${Number(c.policy.coverage_limit).toLocaleString("es-EC")}`} />
                    <Field k="Deducible" v={`US$ ${Number(c.policy.deductible).toLocaleString("es-EC")}`} />
                  </div>
                  <div
                    className={`flex items-start gap-2 rounded-md border p-2 text-xs ${
                      policyValid
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                        : "border-destructive/30 bg-destructive/10 text-destructive"
                    }`}
                  >
                    {policyValid ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                    <div>
                      <div className="font-semibold uppercase">{c.policy_validation_status}</div>
                      <div>{c.policy_validation_notes}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-destructive">No se encontró póliza asociada.</p>
              )}
            </Step>

            {/* Pre-existencias */}
            <Step
              n={3}
              title={`Pre-existencias detectadas (${preexisting.length})`}
              icon={<AlertTriangle className="h-4 w-4" />}
              ok={preexisting.length === 0}
            >
              {preexisting.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin pre-existencias registradas.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {preexisting.map((h: any, i: number) => (
                    <li key={i} className="flex items-center justify-between rounded border border-border/40 p-2">
                      <span>{h.condition}</span>
                      <Badge variant={h.severity === "grave" ? "destructive" : "secondary"}>
                        {h.severity ?? "—"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Step>

            {/* Riesgo */}
            <Step n={4} title="Análisis de riesgo" icon={<Gauge className="h-4 w-4" />} ok={c.risk_level !== "critical"}>
              <div className="mb-3 flex items-center gap-3">
                <div
                  className={`flex h-16 w-16 flex-col items-center justify-center rounded-xl border-2 font-bold ${
                    c.risk_level ? riskColor[c.risk_level as RiskLevel] : ""
                  }`}
                >
                  <span className="text-xl">{c.risk_score}</span>
                  <span className="text-[10px]">{c.risk_level ? riskLabel[c.risk_level as RiskLevel] : ""}</span>
                </div>
                <div className="text-xs">
                  <div className="text-muted-foreground">Motor</div>
                  <Badge variant="outline" className="mt-0.5 font-mono">{c.ai_engine}</Badge>
                </div>
              </div>
              {risk.key_factors?.length > 0 && (
                <div className="mb-3">
                  <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Factores que sumaron</div>
                  <ul className="space-y-1 text-sm">
                    {risk.key_factors.map((f: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {risk.recommended_actions?.length > 0 && (
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Acciones recomendadas</div>
                  <ul className="space-y-1 text-sm">
                    {risk.recommended_actions.map((a: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Step>

            {/* Notificaciones */}
            <Step n={5} title={`Notificaciones enviadas (${data.notifs.length})`} icon={<BellRing className="h-4 w-4" />} ok={data.notifs.length > 0}>
              {data.notifs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aún no se han enviado notificaciones.</p>
              ) : (
                <div className="space-y-2">
                  {data.notifs.map((n: any) => (
                    <div key={n.id} className="rounded-md border border-border/40 p-2">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <Badge variant="outline" className="text-[10px] uppercase">{n.recipient_type}</Badge>
                        <span className="text-muted-foreground">{n.channel} → {n.recipient_name}</span>
                      </div>
                      <div className="text-sm font-semibold">{n.subject}</div>
                      <pre className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{n.body}</pre>
                    </div>
                  ))}
                </div>
              )}
            </Step>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Step({
  n,
  title,
  icon,
  ok,
  children,
}: {
  n: number;
  title: string;
  icon: React.ReactNode;
  ok: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
            ok ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500"
          }`}
        >
          {n}
        </span>
        <span className="text-primary">{icon}</span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="pl-8">{children}</div>
    </div>
  );
}

function Field({ k, v, full }: { k: string; v: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="truncate">{v ?? "—"}</div>
    </div>
  );
}

function Simulator({ onDone }: { onDone: () => void }) {
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const s = SCENARIOS[scenarioIdx];
  const [form, setForm] = useState(s.payload);

  useEffect(() => {
    setForm(SCENARIOS[scenarioIdx].payload);
  }, [scenarioIdx]);

  const run = async () => {
    setLoading(true);
    setLastResult(null);
    const { data, error, elapsed } = await invokeWebhook(form);
    setLoading(false);
    if (error) {
      toast.error("Webhook falló: " + error.message);
      setLastResult({ error: error.message });
      return;
    }
    toast.success(`Caso procesado en ${elapsed}ms`);
    setLastResult(data);
    onDone();
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Simulador de ingreso hospitalario</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Escenario predefinido</Label>
            <Select value={String(scenarioIdx)} onValueChange={(v) => setScenarioIdx(Number(v))}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCENARIOS.map((sc, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {sc.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Cédula del paciente</Label>
            <Input value={form.patient_national_id} onChange={(e) => setForm({ ...form, patient_national_id: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label>Motivo de consulta</Label>
            <Input value={form.chief_complaint} onChange={(e) => setForm({ ...form, chief_complaint: e.target.value })} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Triage (1-5)</Label>
              <Input
                type="number"
                min={1}
                max={5}
                value={form.triage_level}
                onChange={(e) => setForm({ ...form, triage_level: Number(e.target.value) })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>SpO₂ (%)</Label>
              <Input
                type="number"
                value={form.vital_signs.oxygen_saturation}
                onChange={(e) =>
                  setForm({ ...form, vital_signs: { ...form.vital_signs, oxygen_saturation: Number(e.target.value) } })
                }
                className="mt-1"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>FC (lpm)</Label>
              <Input
                type="number"
                value={form.vital_signs.heart_rate}
                onChange={(e) =>
                  setForm({ ...form, vital_signs: { ...form.vital_signs, heart_rate: Number(e.target.value) } })
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label>Sistólica (mmHg)</Label>
              <Input
                type="number"
                value={form.vital_signs.systolic_bp}
                onChange={(e) =>
                  setForm({ ...form, vital_signs: { ...form.vital_signs, systolic_bp: Number(e.target.value) } })
                }
                className="mt-1"
              />
            </div>
          </div>
          <Button onClick={run} disabled={loading} className="w-full gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Enviar webhook al SATE
          </Button>
        </CardContent>
      </Card>

      <LiveValidation form={form} serverResult={lastResult} />
    </div>
  );
}

// ---------- Live validation (mirrors server rules in supabase/functions/_shared/risk.ts) ----------

type LiveSnapshot = {
  loading: boolean;
  patient: { full_name: string; date_of_birth: string; age: number } | null;
  policy: any | null;
  policyValidation: { status: string; notes: string } | null;
  preexisting: Array<{ condition: string; severity: string | null }>;
};

function classify(score: number) {
  if (score >= 80) return { level: "critical" as RiskLevel, label: "CRÍTICO" };
  if (score >= 55) return { level: "high" as RiskLevel, label: "ALTO" };
  if (score >= 30) return { level: "medium" as RiskLevel, label: "MEDIO" };
  return { level: "low" as RiskLevel, label: "BAJO" };
}

function computeRules(snap: LiveSnapshot, form: any): Array<{ label: string; pts: number; hit: boolean; detail?: string }> {
  const rules: Array<{ label: string; pts: number; hit: boolean; detail?: string }> = [];
  const t = form.triage_level;
  rules.push({ label: "Triaje crítico (T1)", pts: t === 1 ? 40 : 0, hit: t === 1 });
  rules.push({ label: "Triaje emergente (T2)", pts: t === 2 ? 25 : 0, hit: t === 2 });
  rules.push({ label: "Triaje urgente (T3)", pts: t === 3 ? 10 : 0, hit: t === 3 });

  const graves = snap.preexisting.filter((p) => (p.severity ?? "").toLowerCase() === "grave");
  const moderadas = snap.preexisting.filter((p) => (p.severity ?? "").toLowerCase() === "moderada");
  rules.push({
    label: `Pre-existencia grave ×${graves.length}`,
    pts: graves.length * 15,
    hit: graves.length > 0,
    detail: graves.map((g) => g.condition).join(", ") || undefined,
  });
  rules.push({
    label: `Pre-existencia moderada ×${moderadas.length}`,
    pts: moderadas.length * 8,
    hit: moderadas.length > 0,
    detail: moderadas.map((g) => g.condition).join(", ") || undefined,
  });

  const hr = form.vital_signs?.heart_rate;
  const hrAb = typeof hr === "number" && (hr > 120 || hr < 50);
  rules.push({ label: "FC anormal (<50 ó >120)", pts: hrAb ? 10 : 0, hit: hrAb, detail: hr ? `${hr} lpm` : undefined });

  const spo2 = form.vital_signs?.oxygen_saturation;
  const spo2Low = typeof spo2 === "number" && spo2 < 92;
  rules.push({ label: "SpO₂ baja (<92%)", pts: spo2Low ? 20 : 0, hit: spo2Low, detail: spo2 ? `${spo2}%` : undefined });

  const sys = form.vital_signs?.systolic_bp;
  const sysAb = typeof sys === "number" && (sys > 180 || sys < 90);
  rules.push({ label: "Sistólica anormal (<90 ó >180)", pts: sysAb ? 15 : 0, hit: sysAb, detail: sys ? `${sys} mmHg` : undefined });

  const age = snap.patient?.age ?? 0;
  const old = age > 65;
  rules.push({ label: "Adulto mayor (>65)", pts: old ? 10 : 0, hit: old, detail: age ? `${age} años` : undefined });

  return rules;
}

function LiveValidation({ form, serverResult }: { form: any; serverResult: any }) {
  const [snap, setSnap] = useState<LiveSnapshot>({
    loading: false,
    patient: null,
    policy: null,
    policyValidation: null,
    preexisting: [],
  });

  // Debounced lookup whenever DNI changes
  useEffect(() => {
    const dni = form.patient_national_id?.trim();
    if (!dni) {
      setSnap({ loading: false, patient: null, policy: null, policyValidation: null, preexisting: [] });
      return;
    }
    let alive = true;
    setSnap((s) => ({ ...s, loading: true }));
    const t = setTimeout(async () => {
      const { data: patient } = await supabase
        .from("policyholders")
        .select("id, full_name, date_of_birth")
        .eq("national_id", dni)
        .maybeSingle();
      if (!alive) return;
      if (!patient) {
        setSnap({ loading: false, patient: null, policy: null, policyValidation: { status: "invalid", notes: "No se encontró asegurado con esta cédula" }, preexisting: [] });
        return;
      }
      const age = Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000));
      const [{ data: policies }, { data: history }] = await Promise.all([
        supabase.from("policies").select("*").eq("policyholder_id", patient.id).order("end_date", { ascending: false }).limit(1),
        supabase.from("medical_history").select("condition, severity, is_preexisting").eq("policyholder_id", patient.id),
      ]);
      const policy = policies?.[0] ?? null;
      let policyValidation: { status: string; notes: string };
      if (!policy) policyValidation = { status: "invalid", notes: "No hay póliza asociada" };
      else if (policy.status === "expired") policyValidation = { status: "expired", notes: "Póliza expirada" };
      else if (policy.status === "suspended") policyValidation = { status: "suspended", notes: "Póliza suspendida" };
      else if (policy.status === "cancelled") policyValidation = { status: "invalid", notes: "Póliza cancelada" };
      else {
        const now = new Date();
        const start = new Date(policy.start_date);
        const end = new Date(policy.end_date);
        policyValidation = now >= start && now <= end ? { status: "valid", notes: "Póliza vigente y al día" } : { status: "expired", notes: "Fuera del periodo de vigencia" };
      }
      if (!alive) return;
      setSnap({
        loading: false,
        patient: { full_name: patient.full_name, date_of_birth: patient.date_of_birth, age },
        policy,
        policyValidation,
        preexisting: (history ?? []).filter((h: any) => h.is_preexisting).map((h: any) => ({ condition: h.condition, severity: h.severity })),
      });
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [form.patient_national_id]);

  const rules = computeRules(snap, form);
  const total = Math.min(100, rules.reduce((acc, r) => acc + r.pts, 0));
  const cls = classify(total);
  const policyValid = snap.policyValidation?.status === "valid";

  const serverScore = serverResult?.risk?.score ?? serverResult?.risk_score;
  const serverLevel = serverResult?.risk?.level ?? serverResult?.risk_level;
  const serverEngine = serverResult?.risk?.engine ?? serverResult?.ai_engine;
  const matches = serverScore != null && Number(serverScore) === total;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="h-4 w-4 text-primary" /> Validación en vivo
          {snap.loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Paciente */}
        <div className="rounded-md border border-border/60 p-2.5 text-xs">
          <div className="mb-1 flex items-center gap-1.5 font-semibold">
            <User className="h-3.5 w-3.5" /> Paciente
          </div>
          {snap.patient ? (
            <div className="text-muted-foreground">
              <span className="text-foreground">{snap.patient.full_name}</span> · {snap.patient.age} años · DNI {form.patient_national_id}
            </div>
          ) : (
            <div className="text-destructive">No encontrado</div>
          )}
        </div>

        {/* Póliza */}
        <div className={`rounded-md border p-2.5 text-xs ${policyValid ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5"}`}>
          <div className="mb-1 flex items-center justify-between font-semibold">
            <span className="flex items-center gap-1.5">
              <FileCheck2 className="h-3.5 w-3.5" /> Póliza
            </span>
            {snap.policyValidation && (
              <Badge variant={policyValid ? "secondary" : "destructive"} className="text-[10px] uppercase">
                {snap.policyValidation.status}
              </Badge>
            )}
          </div>
          {snap.policy ? (
            <div className="space-y-0.5 text-muted-foreground">
              <div>{snap.policy.policy_number} · {snap.policy.plan_type}</div>
              <div>Vigencia: {snap.policy.start_date} → {snap.policy.end_date}</div>
              <div>Cobertura: US$ {Number(snap.policy.coverage_limit).toLocaleString("es-EC")}</div>
              {snap.policyValidation && <div className="text-foreground">{snap.policyValidation.notes}</div>}
            </div>
          ) : (
            <div className="text-muted-foreground">{snap.policyValidation?.notes ?? "—"}</div>
          )}
        </div>

        {/* Pre-existencias */}
        <div className="rounded-md border border-border/60 p-2.5 text-xs">
          <div className="mb-1 flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="h-3.5 w-3.5" /> Pre-existencias ({snap.preexisting.length})
          </div>
          {snap.preexisting.length === 0 ? (
            <div className="text-muted-foreground">Ninguna registrada</div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {snap.preexisting.map((p, i) => (
                <Badge key={i} variant={p.severity === "grave" ? "destructive" : "secondary"} className="text-[10px]">
                  {p.condition} · {p.severity}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Reglas en vivo */}
        <div className="rounded-md border border-border/60 p-2.5">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <Gauge className="h-3.5 w-3.5" /> Reglas evaluadas
            </span>
          </div>
          <ul className="space-y-1 text-xs">
            {rules.map((r) => (
              <li
                key={r.label}
                className={`flex items-center justify-between rounded px-2 py-1 ${
                  r.hit ? "bg-primary/10 text-foreground" : "text-muted-foreground/60"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {r.hit ? <CheckCircle2 className="h-3 w-3 text-primary" /> : <span className="h-3 w-3 rounded-full border border-muted-foreground/30" />}
                  <span>{r.label}</span>
                  {r.detail && <span className="text-[10px] text-muted-foreground">({r.detail})</span>}
                </span>
                <span className={`font-mono text-[11px] ${r.hit ? "font-bold text-primary" : ""}`}>
                  {r.pts > 0 ? `+${r.pts}` : "—"}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2">
            <span className="text-xs font-semibold">Score predicho</span>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-bold ${riskColor[cls.level]}`}>
              {total} · {cls.label}
            </span>
          </div>
        </div>

        {/* Comparación con servidor */}
        {serverResult && !serverResult.error && (
          <div className={`rounded-md border p-2.5 text-xs ${matches ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
            <div className="mb-1 flex items-center justify-between font-semibold">
              <span>Comparación con servidor</span>
              <Badge variant="outline" className="text-[10px]">motor: {serverEngine}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">Predicho (cliente)</div>
                <div className="font-mono">{total} · {cls.label}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted-foreground">Real (servidor)</div>
                <div className="font-mono">{serverScore} · {String(serverLevel ?? "").toUpperCase()}</div>
              </div>
            </div>
            <div className="mt-1.5 text-[11px]">
              {matches ? (
                <span className="text-emerald-600">✓ El motor de reglas coincide exactamente.</span>
              ) : serverEngine === "openai" ? (
                <span className="text-amber-600">⚠ OpenAI ajustó el score con contexto clínico adicional.</span>
              ) : (
                <span className="text-amber-600">⚠ Diferencia: revisar reglas.</span>
              )}
            </div>
          </div>
        )}
        {serverResult?.error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
            Error servidor: {serverResult.error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DemoRunner({ onDone }: { onDone: () => void }) {
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const stopRef = useRef(false);

  const append = (line: string) => setLog((l) => [...l, `[${new Date().toLocaleTimeString()}] ${line}`]);

  const start = async () => {
    setRunning(true);
    stopRef.current = false;
    setLog([]);
    append("🚀 Iniciando secuencia demo de 3 olas…");
    for (let i = 0; i < SCENARIOS.length; i++) {
      if (stopRef.current) break;
      const sc = SCENARIOS[i];
      append(`📡 Ola ${i + 1}/3 → ${sc.label}`);
      const { data, error, elapsed } = await invokeWebhook(sc.payload);
      if (error) {
        append(`❌ Falló: ${error.message}`);
      } else {
        const code = (data as any)?.case_code ?? "?";
        const risk = (data as any)?.risk?.level ?? "?";
        const engine = (data as any)?.risk?.engine ?? "?";
        append(`✅ ${code} · riesgo ${String(risk).toUpperCase()} · motor ${engine} · ${elapsed}ms`);
      }
      onDone();
      if (i < SCENARIOS.length - 1) {
        for (let s = 5; s > 0 && !stopRef.current; s--) {
          append(`⏳ Próxima ola en ${s}s…`);
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
    append("🏁 Secuencia finalizada.");
    setRunning(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Demo automatizada para pitch</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Ejecuta 3 ingresos consecutivos (crítico, alto y medio) con 5 segundos entre cada uno. Mira cómo el dashboard reacciona en tiempo real.
        </p>
        <div className="flex gap-2">
          <Button onClick={start} disabled={running} className="gap-2">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {running ? "Ejecutando…" : "Lanzar demo (3 olas)"}
          </Button>
          {running && (
            <Button variant="outline" onClick={() => (stopRef.current = true)}>
              Detener
            </Button>
          )}
        </div>
        <div className="rounded-md border border-border/60 bg-muted/30 p-3 font-mono text-xs">
          {log.length === 0 ? (
            <span className="text-muted-foreground">Logs de la demo aparecerán aquí…</span>
          ) : (
            log.map((l, i) => <div key={i}>{l}</div>)
          )}
        </div>
      </CardContent>
    </Card>
  );
}