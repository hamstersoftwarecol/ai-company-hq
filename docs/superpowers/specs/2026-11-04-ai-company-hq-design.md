# AI Company HQ — Sistema de Agentes IA

**Fecha:** 2026-11-04  
**Autor:** Alejandro López Murillo  
**Estado:** Aprobado — listo para implementación

---

## 1. Visión General

Sistema de agentes IA organizados como una empresa. El usuario actúa como **presidente** desde un dashboard web en tiempo real, dando instrucciones a un orquestador (CEO Agent) que las descompone y delega a crews especializados. Cada crew reporta progreso en tiempo real vía WebSockets.

### Objetivos de éxito
- El presidente escribe una instrucción y ve a los agentes trabajar en segundos
- Cada agente muestra su estado, tarea actual y outputs en el dashboard
- El sistema rutea automáticamente tareas a modelos remotos (Claude, GPT-4o) o locales (Ollama) según criticidad
- El sistema corre localmente y se puede desplegar en la nube

---

## 2. Stack Tecnológico

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| Framework de agentes | CrewAI (Python) | Nativo Python, metáfora de crew/equipo natural |
| Backend | FastAPI + Python 3.11 | Async nativo, WebSockets, fácil integración con CrewAI |
| Comunicación tiempo real | WebSockets (FastAPI) | Stream de eventos de agentes al dashboard |
| Capa unificada de modelos | LiteLLM | Mismo código para Claude, GPT-4o y Ollama |
| Modelos remotos | Claude Sonnet (Anthropic), GPT-4o (OpenAI) | Decisiones críticas |
| Modelos locales | Ollama (Llama 3.2, Mistral) | Tareas rutinarias, ahorro de costo |
| Dashboard | Next.js 14 + React + TypeScript | Full-stack, WebSocket client, deploy fácil |
| Estilos | Tailwind CSS | Rápido de prototipar, responsive |

---

## 3. Arquitectura General

```
┌─────────────────────────────────────────────────────┐
│                  DASHBOARD (Next.js)                 │
│  Vista Presidente: agentes, tareas, logs, chat       │
│  Puerto 3000 — WebSocket client                      │
└──────────────────────┬──────────────────────────────┘
                       │ WebSocket (ws://localhost:8000/ws)
┌──────────────────────▼──────────────────────────────┐
│              BACKEND CORE (FastAPI + Python)         │
│                                                      │
│  ┌─────────────────┐    ┌────────────────────────┐  │
│  │  CEO Agent      │───▶│  Task Router           │  │
│  │  (Orquestador)  │    │  descompone y delega    │  │
│  │  LLM: Claude    │    └──────────┬─────────────┘  │
│  └─────────────────┘               │                │
│                    ┌───────────────┼──────────────┐  │
│                    ▼               ▼              ▼  │
│              [Marketing]      [Dev Web]       [Mobile]│
│              [Imágenes]       [Planning]              │
│                    Crews CrewAI especializados        │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  Model Router (LiteLLM)                      │   │
│  │  critical  → claude-sonnet-4-5 (remoto)      │   │
│  │  standard  → gpt-4o (remoto)                 │   │
│  │  local     → ollama/llama3.2 (local)         │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Flujo de una instrucción:**
1. Presidente escribe instrucción en el dashboard
2. Next.js POST a `/task` en FastAPI
3. CEO Agent (Claude) descompone la tarea y llama al Task Router
4. Task Router instancia los crews relevantes
5. Cada agente emite eventos WebSocket al ejecutar
6. Dashboard recibe eventos y actualiza AgentCards + LiveLog en tiempo real
7. CEO Agent consolida resultados y emite evento `task_complete`

---

## 4. Sistema de Agentes

### 4.1 CEO Agent (Orquestador)
- **Modelo:** Claude Sonnet — siempre remoto
- **Responsabilidad:** Recibir instrucciones del presidente, descomponer en subtareas, delegar a crews, consolidar resultados finales
- **Herramientas CrewAI:** `delegate_to_crew`, `read_project_memory`, `write_project_memory`
- **Input:** Texto libre del presidente
- **Output:** Plan de acción + resultados consolidados de todos los crews

### 4.2 Crews Especializados

#### Crew de Marketing
| Agente | Rol | Modelo |
|--------|-----|--------|
| `marketing_strategist` | Estrategia de campaña, copy, audiencia objetivo | GPT-4o (remoto) |
| `reels_creator` | Scripts para Reels, hooks, estructura de video | Ollama local |
| `analytics_agent` | Métricas, KPIs, reportes de desempeño | Ollama local |

#### Crew de Frontend
| Agente | Rol | Modelo |
|--------|-----|--------|
| `frontend_architect` | Diseño de componentes, estructura UI, decisiones de arquitectura | Claude (remoto) |
| `frontend_developer` | Implementación de código React/Vue/Next.js | Claude (remoto) |

#### Crew de Backend
| Agente | Rol | Modelo |
|--------|-----|--------|
| `backend_architect` | Diseño de APIs, schema de BD, lógica de negocio | Claude (remoto) |
| `backend_developer` | Implementación de endpoints, migraciones | Claude (remoto) |

#### Crew de Apps Móviles
| Agente | Rol | Modelo |
|--------|-----|--------|
| `mobile_developer` | React Native / Flutter, lógica de pantallas | Claude (remoto) |
| `mobile_qa` | Pruebas, casos de uso, reportes de bugs | Ollama local |

#### Crew de Imágenes
| Agente | Rol | Modelo |
|--------|-----|--------|
| `prompt_engineer` | Genera y refina prompts para modelos de imagen | Ollama local |
| `image_generator` | Llama a DALL-E 3 / Flux API con los prompts | API externa |

#### Crew de Planificación
| Agente | Rol | Modelo |
|--------|-----|--------|
| `project_planner` | Roadmaps, sprints, timelines, dependencias | GPT-4o (remoto) |
| `resource_manager` | Asignación de crews, priorización de tareas | Ollama local |

### 4.3 Esquema de Evento WebSocket
Todos los agentes emiten eventos con esta estructura:
```json
{
  "event_id": "uuid-v4",
  "agent": "frontend_developer",
  "crew": "frontend",
  "status": "working | idle | error | complete",
  "task": "Crear componente LoginForm",
  "output": "Texto parcial o resultado final del agente",
  "model_used": "claude-sonnet-4-5",
  "timestamp": "2026-11-04T10:30:00Z"
}
```

---

## 5. Backend — FastAPI

### 5.1 Estructura de Archivos
```
backend/
├── main.py                    # FastAPI app, monta rutas y WebSocket hub
├── orchestrator/
│   ├── ceo_agent.py           # CEO Agent (orquestador principal)
│   └── task_router.py         # Mapea tareas → crews
├── crews/
│   ├── base_crew.py           # Clase base con emit_event()
│   ├── marketing_crew.py
│   ├── frontend_crew.py
│   ├── backend_crew.py
│   ├── mobile_crew.py
│   ├── images_crew.py
│   └── planning_crew.py
├── model_router/
│   ├── router.py              # Decide modelo por tier (critical/standard/local)
│   ├── remote.py              # LiteLLM → Claude / GPT-4o
│   └── local.py               # LiteLLM → Ollama
├── events/
│   └── ws_manager.py          # WebSocket broadcaster (broadcast a todos los clientes)
├── config.py                  # API keys, model mapping, settings
└── requirements.txt
```

### 5.2 Endpoints REST
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/ws` | WebSocket | Stream de eventos en tiempo real |
| `/task` | POST | Enviar instrucción del presidente al CEO Agent |
| `/agents` | GET | Estado actual de todos los agentes |
| `/history` | GET | Historial de tareas completadas |
| `/health` | GET | Health check del servidor |

### 5.3 Model Router — Reglas de Routing
```python
MODEL_TIERS = {
    "critical": "claude-sonnet-4-5",    # Orquestador, arquitectos
    "standard": "gpt-4o",               # Marketing estratega, planificación
    "local": "ollama/llama3.2"          # Creadores de contenido, QA, analistas
}

AGENT_TIER_MAP = {
    "ceo_agent": "critical",
    "frontend_architect": "critical",
    "backend_architect": "critical",
    "mobile_developer": "critical",
    "marketing_strategist": "standard",
    "project_planner": "standard",
    "reels_creator": "local",
    "analytics_agent": "local",
    "mobile_qa": "local",
    "prompt_engineer": "local",
    "resource_manager": "local",
}
```

### 5.4 WebSocket Manager
- Mantiene lista de conexiones activas
- `broadcast(event)` envía a todos los clientes conectados
- `send_to(client_id, event)` para mensajes privados (futuro)
- Reconexión automática en el cliente

---

## 6. Frontend — Next.js Dashboard

### 6.1 Estructura de Archivos
```
frontend/
├── app/
│   ├── page.tsx               # Dashboard principal (layout completo)
│   ├── layout.tsx             # Layout global con providers
│   └── api/
│       └── task/route.ts      # API route: proxy POST al backend Python
├── components/
│   ├── AgentCard.tsx          # Tarjeta de agente: estado, tarea, modelo
│   ├── AgentsGrid.tsx         # Grid 3×2 de todos los crews
│   ├── CommandInput.tsx       # Input del presidente + botón Enviar
│   ├── LiveLog.tsx            # Stream de eventos filtrable por crew
│   └── StatusBar.tsx          # Barra superior: agentes activos, uptime
├── hooks/
│   └── useWebSocket.ts        # Conexión WS, reconexión automática, cola de eventos
├── types/
│   └── agent.ts               # Tipos: AgentEvent, AgentStatus, Crew
├── lib/
│   └── api.ts                 # Funciones para llamar al backend
└── next.config.ts
```

### 6.2 Layout del Dashboard
```
┌──────────────────────────────────────────────────────────┐
│  🏢 AI Company HQ        [3 activos] [uptime: 00:42:15]  │
├─────────────────┬────────────────────────────────────────┤
│  COMANDO        │  AGENTS GRID (2 filas × 3 cols)        │
│                 │  ┌──────────┐┌──────────┐┌──────────┐  │
│  [textarea      │  │Marketing ││Frontend  ││Backend   │  │
│   instrucción]  │  │● Activo  ││◉ Idle    ││● Activo  │  │
│                 │  │Tarea:... ││          ││Tarea:... │  │
│  [Enviar]       │  └──────────┘└──────────┘└──────────┘  │
│                 │  ┌──────────┐┌──────────┐┌──────────┐  │
│  HISTORIAL      │  │Mobile    ││Imágenes  ││Planning  │  │
│  ─────────      │  │◉ Idle    ││● Activo  ││◉ Idle    │  │
│  • Tarea 1 ✓    │  │          ││Tarea:... ││          │  │
│  • Tarea 2 ✓    │  └──────────┘└──────────┘└──────────┘  │
├─────────────────┴────────────────────────────────────────┤
│  LIVE LOG  [Filtrar: todos ▼]                             │
│  10:31 [marketing/estratega] Analizando audiencia...     │
│  10:31 [images/generator]    Prompt: "hero shot..."      │
│  10:32 [backend/architect]   Schema: users, posts...     │
└──────────────────────────────────────────────────────────┘
```

### 6.3 AgentCard — Estados Visuales
- **● Activo (verde)** — ejecutando tarea, muestra output parcial
- **◉ Idle (gris)** — disponible, sin tarea asignada
- **⚠ Error (rojo)** — falló, muestra mensaje de error
- **✓ Completo (azul)** — tarea terminada, muestra resultado resumido

---

## 7. Configuración e Infraestructura

### 7.1 Variables de Entorno (`backend/.env`)
```env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
OLLAMA_BASE_URL=http://localhost:11434
DEFAULT_LOCAL_MODEL=llama3.2
DEFAULT_REMOTE_MODEL=claude-sonnet-4-5
```

### 7.2 Estructura del Monorepo
```
agentesdeIA/
├── backend/           # Python + FastAPI + CrewAI
├── frontend/          # Next.js + React
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-11-04-ai-company-hq-design.md
```

**Inicio del sistema:**
- Backend: `cd backend && uvicorn main:app --reload --port 8000`
- Frontend: `cd frontend && npm run dev` (puerto 3000)

---

## 8. Consideraciones de Escalabilidad Futura

- **Redis Streams** — si el número de agentes crece, reemplazar el WebSocket manager por Redis pub/sub
- **Autenticación** — añadir JWT para proteger el dashboard antes de exponer en la nube
- **Memoria persistente** — integrar ChromaDB o Supabase para que los agentes recuerden contexto entre sesiones
- **Agentes adicionales** — el patrón base_crew.py facilita añadir nuevos crews sin modificar el orquestador

---

## 9. Criterios de Éxito

1. El presidente escribe una instrucción y ve logs en el dashboard en menos de 5 segundos
2. El Model Router rutea correctamente: agentes críticos a Claude/GPT-4o, rutinarios a Ollama
3. Al menos 3 crews funcionales en la entrega inicial (Marketing, Frontend, Backend)
4. El dashboard muestra estados de agentes en tiempo real sin recarga de página
