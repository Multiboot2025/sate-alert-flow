// Deterministic rule-based risk engine + optional OpenAI enrichment.

export interface VitalSigns {
  heart_rate?: number;
  blood_pressure?: string; // "160/95"
  temperature?: number;
  oxygen_saturation?: number;
}

export interface RiskInput {
  age: number;
  preexisting: Array<{ severity: string | null; condition: string }>;
  vital_signs: VitalSigns;
  chief_complaint: string;
  triage_level: number | null;
}

export interface RiskOutput {
  risk_score: number;
  risk_level: "low" | "medium" | "high" | "critical";
  key_factors: string[];
  recommended_actions: string[];
  engine: "rules" | "openai";
}

function classify(score: number): RiskOutput["risk_level"] {
  if (score >= 80) return "critical";
  if (score >= 55) return "high";
  if (score >= 30) return "medium";
  return "low";
}

function parseSystolic(bp?: string): number | null {
  if (!bp) return null;
  const m = bp.match(/^(\d{2,3})\s*\/\s*(\d{2,3})$/);
  return m ? parseInt(m[1], 10) : null;
}

export function rulesEngine(input: RiskInput): RiskOutput {
  let score = 0;
  const factors: string[] = [];
  const actions: string[] = [];

  // Triage
  if (input.triage_level === 1) { score += 40; factors.push("Triaje crítico (nivel 1)"); }
  else if (input.triage_level === 2) { score += 25; factors.push("Triaje emergente (nivel 2)"); }
  else if (input.triage_level === 3) { score += 10; factors.push("Triaje urgente (nivel 3)"); }

  // Pre-existing conditions
  for (const c of input.preexisting) {
    const sev = (c.severity || "").toLowerCase();
    if (sev === "grave") { score += 15; factors.push(`Pre-existencia grave: ${c.condition}`); }
    else if (sev === "moderada") { score += 8; factors.push(`Pre-existencia moderada: ${c.condition}`); }
    else if (sev === "leve") { score += 3; }
  }

  // Vitals
  const hr = input.vital_signs.heart_rate;
  if (typeof hr === "number" && (hr > 120 || hr < 50)) {
    score += 10;
    factors.push(`Frecuencia cardiaca anormal (${hr} lpm)`);
    actions.push("Monitorizar ritmo cardiaco");
  }

  const spo2 = input.vital_signs.oxygen_saturation;
  if (typeof spo2 === "number" && spo2 < 92) {
    score += 20;
    factors.push(`Saturación de oxígeno baja (${spo2}%)`);
    actions.push("Oxigenoterapia inmediata");
  }

  const sys = parseSystolic(input.vital_signs.blood_pressure);
  if (sys !== null && (sys > 180 || sys < 90)) {
    score += 15;
    factors.push(`Presión arterial sistólica anormal (${sys} mmHg)`);
    actions.push("Control de presión arterial");
  }

  // Age
  if (input.age > 65) {
    score += 10;
    factors.push(`Adulto mayor (${input.age} años)`);
  }

  // Default recommendations
  if (actions.length === 0) actions.push("Observación clínica");
  if (score >= 55) actions.push("Notificar al gestor de casos");
  if (score >= 80) actions.push("Evaluación inmediata por UCI");

  score = Math.min(100, score);

  return {
    risk_score: score,
    risk_level: classify(score),
    key_factors: factors.length ? factors : ["Sin factores de riesgo significativos"],
    recommended_actions: actions,
    engine: "rules",
  };
}

export async function openaiEngine(input: RiskInput): Promise<RiskOutput | null> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return null;
  try {
    const prompt = `Eres un médico evaluador de riesgo de una aseguradora. Analiza este caso y devuelve SOLO JSON válido con la estructura: {"risk_score": int (0-100), "risk_level": "low|medium|high|critical", "key_factors": [string en español], "recommended_actions": [string en español]}.\n\nDatos:\nEdad: ${input.age}\nMotivo: ${input.chief_complaint}\nTriaje: ${input.triage_level}\nSignos vitales: ${JSON.stringify(input.vital_signs)}\nPre-existencias: ${JSON.stringify(input.preexisting)}`;
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Devuelves únicamente JSON válido." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content);
    return {
      risk_score: Math.max(0, Math.min(100, Math.round(parsed.risk_score))),
      risk_level: parsed.risk_level,
      key_factors: Array.isArray(parsed.key_factors) ? parsed.key_factors : [],
      recommended_actions: Array.isArray(parsed.recommended_actions) ? parsed.recommended_actions : [],
      engine: "openai",
    };
  } catch (_e) {
    return null;
  }
}

export async function analyzeRisk(input: RiskInput): Promise<RiskOutput> {
  const ai = await openaiEngine(input);
  return ai ?? rulesEngine(input);
}