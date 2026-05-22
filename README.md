# SATE — Sistema de Alerta Temprana de Emergencias

> Plataforma integral para aseguradoras de salud que automatiza la recepción, validación y análisis de riesgo de ingresos a emergencias hospitalarias en tiempo real.

---

## ¿Qué hace SATE?

SATE conecta hospitales con aseguradoras de salud mediante un flujo automatizado que opera en segundos:

1. **Recepción** — Un hospital envía un webhook con los datos del paciente, motivo de ingreso, signos vitales y nivel de triaje.
2. **Validación** — El sistema busca al asegurado en la base de datos, valida su póliza y verifica que esté vigente.
3. **Análisis de riesgo** — Un motor híbrido (reglas determinísticas + IA opcional) calcula un score de riesgo y clasifica el caso.
4. **Asignación** — Se asigna automáticamente un gestor de caso del turno on-call.
5. **Notificación** — Se envían alertas por email al hospital y por SMS al gestor asignado.
6. **Trazabilidad visual** — Todo el proceso queda registrado y es visible en el panel de control, incluyendo las coincidencias encontradas en cada tabla de la base de datos.

---

## Arquitectura tecnológica

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + TanStack Start v1 (SSR/SSG) + Tailwind CSS v4 |
| Componentes UI | shadcn/ui (Radix + Tailwind) |
| Backend | TanStack Server Functions (`createServerFn`) |
| Base de datos & Auth | Lovable Cloud (PostgreSQL + Auth) |
| Edge / Webhooks | Supabase Edge Functions (Deno) |
| Motor de riesgo | Reglas determinísticas + OpenAI GPT-4o-mini (fallback) |
| Lenguaje | TypeScript (strict) |
| Build | Vite 7 + Bun |

---

## Estructura del proyecto

```
src/
├── routes/
│   ├── __root.tsx              # Layout raíz (QueryClient, Toaster)
│   ├── index.tsx               # Dashboard principal con 3 pestañas
│   └── api/                    # Rutas de API pública (si aplica)
├── components/ui/              # Componentes shadcn/ui
├── integrations/supabase/    # Clientes Supabase (browser, server, auth)
├── lib/
│   ├── sate.ts                 # Tipos, helpers y funciones compartidas
│   ├── utils.ts                # Utilidades generales (cn, etc.)
│   └── error-*.ts              # Manejo de errores
├── router.tsx                  # Configuración del router TanStack
└── styles.css                  # Design system con tokens semánticos OKLCH

supabase/
├── functions/
│   ├── emergency-admission-webhook/   # Webhook de admisión hospitalaria
│   ├── process-emergency-case/        # Procesamiento de admisión
│   ├── ai-risk-analysis/              # Motor de riesgo por IA
│   ├── send-notifications/            # Envío de notificaciones
│   └── _shared/
│       ├── orchestrator.ts            # Orquestador principal (valida, analiza, crea caso, notifica)
│       ├── risk.ts                    # Motor de riesgo (reglas + OpenAI)
│       └── cors.ts                    # Headers CORS compartidos
└── config.toml                        # Configuración del proyecto Supabase
```

---

## Tablas de la base de datos

| Tabla | Propósito |
|-------|-----------|
| `policyholders` | Asegurados (cédula, nombre, fecha de nacimiento, contacto) |
| `policies` | Pólizas (vigencia, plan, cobertura, deducible, estado) |
| `medical_history` | Historial médico (condiciones, severidad, pre-existencias) |
| `emergency_cases` | Casos de emergencia generados por el sistema |
| `case_managers` | Gestores de caso (nombre, especialidad, turno on-call) |
| `hospitals` | Hospitales afiliados (nombre, contacto, API key) |
| `notifications` | Notificaciones enviadas (email, SMS, destinatario) |
| `webhook_logs` | Logs de todas las peticiones al webhook |

---

## Flujo del webhook de admisión

```
Hospital ──POST──► /functions/v1/emergency-admission-webhook
                        │
                        ▼
                 [1] Valida API key del hospital
                        │
                        ▼
                 [2] Busca asegurado por cédula
                        │
                        ▼
                 [3] Busca póliza activa + valida vigencia
                        │
                        ▼
                 [4] Consulta historial médico (pre-existencias)
                        │
                        ▼
                 [5] Motor de riesgo: reglas + IA opcional
                        │
                        ▼
                 [6] Asigna gestor on-call (round-robin)
                        │
                        ▼
                 [7] Crea caso en emergency_cases
                        │
                        ▼
                 [8] Envía notificaciones (email + SMS)
                        │
                        ▼
                 [9] Guarda log en webhook_logs
```

---

## Motor de riesgo

### Reglas determinísticas (siempre disponible)

| Factor | Condición | Puntos |
|--------|-----------|--------|
| Triaje crítico (T1) | `triage_level === 1` | +40 |
| Triaje emergente (T2) | `triage_level === 2` | +25 |
| Triaje urgente (T3) | `triage_level === 3` | +10 |
| Pre-existencia grave | `severity === 'grave'` | +15 |
| Pre-existencia moderada | `severity === 'moderada'` | +8 |
| SpO₂ baja | `oxygen_saturation < 92%` | +20 |
| Presión sistólica anormal | `< 90 ó > 180 mmHg` | +15 |
| Frecuencia cardiaca anormal | `< 50 ó > 120 lpm` | +10 |
| Adulto mayor | `edad > 65 años` | +10 |

### Clasificación por score

| Nivel | Score | Color |
|-------|-------|-------|
| Bajo | < 30 | Verde |
| Medio | 30–54 | Amarillo |
| Alto | 55–79 | Naranja |
| Crítico | ≥ 80 | Rojo |

### Fallback a IA

Si la variable de entorno `OPENAI_API_KEY` está configurada, el motor primero intenta enriquecer el análisis con GPT-4o-mini. Si falla o no está configurada, cae automáticamente al motor de reglas.

---

## Panel de control (Dashboard)

La aplicación cuenta con tres pestañas:

### 1. Dashboard
- KPIs en tiempo real (casos totales, abiertos, críticos, pólizas observadas)
- Tabla de ingresos a emergencia con actualización en vivo (Supabase Realtime)
- Reglas activas del agente de riesgo
- **Trazabilidad visual** al hacer clic en un caso: se despliega un drawer con el paso a paso del agente, incluyendo las **coincidencias visibles en la base de datos** (emergency_cases, policyholders, policies, medical_history, notifications)

### 2. Simulador
- Formulario para enviar una admisión manual al webhook
- Campos: API key del hospital, cédula del paciente, motivo, triaje, signos vitales

### 3. Demo en vivo
- Escenarios predefinidos (Crítico, Alto, Medio)
- Ejecución paso a paso con visibilidad de las consultas a la base de datos
- Muestra en tiempo real: paciente encontrado, póliza validada, historial médico, riesgo calculado

---

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave pública (cliente browser) |
| `SUPABASE_URL` | URL del proyecto (servidor) |
| `SUPABASE_PUBLISHABLE_KEY` | Clave pública (servidor) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio (bypass RLS, solo servidor) |
| `OPENAI_API_KEY` | *(opcional)* Para enriquecimiento de riesgo con IA |

> **Nota:** Las variables `VITE_*` son públicas (build-time). Las que no llevan prefijo son secretas del servidor (runtime).

---

## Cómo ejecutar localmente

```bash
# 1. Instalar dependencias
bun install

# 2. Ejecutar en modo desarrollo
bun dev
```

El servidor de desarrollo levanta el frontend y las server functions en paralelo.

---

## Cómo desplegar

El proyecto está optimizado para **Lovable Cloud** (Supabase gestionado):

1. Conecta tu proyecto a Lovable Cloud (base de datos + auth automáticos)
2. Las Edge Functions se despliegan automáticamente
3. El frontend se publica desde el preview de Lovable

Para publicar manualmente:
```bash
bun run build
```

---

## Seguridad

- **RLS (Row Level Security)** habilitado en todas las tablas
- Auth con email/password + OAuth (Google)
- La clave de servicio (`SUPABASE_SERVICE_ROLE_KEY`) **nunca** se expone al cliente
- Las server functions protegidas usan `requireSupabaseAuth` middleware
- Verificación de API key de hospital en cada webhook

---

## Licencia

Proyecto generado con [Lovable](https://lovable.dev). Uso interno para demostración de flujo de admisión de emergencias.

---

## Contacto / Demo

Usuario demo: `demo@sate.health` / `demo1234`

Escenarios predefinidos listos para probar en la pestaña **Demo en vivo**.
