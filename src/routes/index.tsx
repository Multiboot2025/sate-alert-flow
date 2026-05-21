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
import { Activity, AlertTriangle, HeartPulse, Hospital, Loader2, Play, Siren, Stethoscope } from "lucide-react";
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
            <CasesTable cases={cases} />
          </TabsContent>

          <TabsContent value="simulator" className="mt-4">
            <Simulator onDone={refreshCases} />
          </TabsContent>

          <TabsContent value="demo" className="mt-4">
            <DemoRunner onDone={refreshCases} />
          </TabsContent>
        </Tabs>
      </main>
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

function CasesTable({ cases }: { cases: CaseRow[] }) {
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
                  <tr key={c.id} className="border-b border-border/30 transition-colors hover:bg-muted/40">
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
          </div>
        )}
      </CardContent>
    </Card>
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
          <Button onClick={run} disabled={loading} className="w-full gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Enviar webhook al SATE
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Respuesta del orquestador</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[420px] overflow-auto rounded-md bg-muted/40 p-3 text-xs">
            {lastResult ? JSON.stringify(lastResult, null, 2) : "Esperando ejecución…"}
          </pre>
        </CardContent>
      </Card>
    </div>
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