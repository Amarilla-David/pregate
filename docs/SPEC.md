# PREGATE: The Last Tool For IA
### Especificación de producto y técnica, v2.1 (2026-10-01)

**Design history, with later implementation notes.** Current behavior and options
are documented in [the command reference](CLI.md), [pack inventory](packs.md),
[feature guides](README.md) and [delivery status](STATUS.md). The original absolute
pre-write promise and early exclusions below are historical intent: supported edit
tools can be checked before writing, shell inspection is heuristic, and reports,
feedback and whole-project audits are now implemented. Catalog prose is not
executable enforcement. Historical pack counts/acceptance apply to their candidate.

The current core 0.3.1 activates 64 project requirements, including the original
48 software invariants, plus four general change guards by default, with reviewed
explicit disable. Unbound requirements remain unverified. Source engine 0.2.12
is unpublished; 0.2.11 remains the published pilot. Engineering
policies formerly named `core/clean-code`, `core/clean-architecture`, `core/tdd`
and `core/ddd-tactical` are now optional packs. [Project fitness](features/project-fitness.md)
supersedes the historical mandatory-integrity/default selection model below.

The current candidate also bounds engine stdin at 16 MiB, requires strict UTF-8
and EOF within five seconds, and rejects invalid input before version redirection.
Supervisor Pre failures use each harness's native denial format; the universal
exit-2 launcher description in the historical 0.2.4 contract below is superseded.
See [harness guarantees](features/harness-and-shell-guarantees.md) for scope and
[stdin evidence](research/stdin-boundary-verification.md) for verification limits.

**0.2.4 implementation contract:** [MULTI-HARNESS.md](MULTI-HARNESS.md) supersedes the original per-repo installation and declarative profiles below. Five pure adapters (`claude-code`, `codex`, `cursor`, `grok`, `agy`) normalize calls to `pre-edit.changes[]` with optional move origin `from`. Reconstruction supports full, append, ranged old/new, exact Codex hunks and delete; multi-file calls overlay their proposed tree and one deny blocks all. Empty old text creates a missing file only. Standalone directories operate with or without Git: directory traversal and snapshot fallbacks decouple the Git/GitHub requirement (O72). Over 300 invariant rules covering software engineering, future human maintainability, modular monolith architecture, and agent skill contracts are systematically cataloged, with 81 automated checks active across 8 library packs and 9 presets (O73). Outside every preset, machine protection remains active with no git, parser or state; unreadable envelopes deny, while recognized rejected envelopes with only unrooted directories are neutral. Grok shutdown is ignored (MH-01–17).

Global `setup` installs engines under `<DATA>/<version>/`, launcher under `<DATA>/bin/`, and `~/.local/bin/pregate` on PATH. Claude/Cursor/Grok share one Claude settings registration; Cursor also has a native Stop registration; Codex has trusted hooks; agy has the `pregate-global` plugin. Real CLI corrections and acceptance are in MULTI-HARNESS §6.4. `update [--version v | --engine v]`, `uninstall [--purge]` and `doctor` operate on the machine; repo `install [--git-hook] [--ci github]` removes legacy registrations and only manages pre-commit/CI. Runtime derives DATA from its executable; hook exit 3 redirects once to the lock's engine, and CLI read-only repo commands delegate before reading stdin. Pins below `FLOOR = "0.2.0"` deny. Pre launcher faults universally emit exit 2, empty stdout and nonempty single-line stderr. SessionStart without a preset is silent. Roots whose preset predates first contact are accepted without SessionStart. `doctor` checks drift/trust and each adapter's canary through literal `$SHELL -c`. Releases carry LICENSE, THIRD_PARTY_NOTICES, installer and `SHA256SUMS` (MH-18–34). Release v0.2.4 is published on GitHub Releases and verified on macOS, Linux, and Windows.

> **A prevention gate for bad code and bad architecture. If it breaks your invariants, it never gets written.** *(tagline elegido, U11)*
>
> **En una frase.** Un PreToolUse con cientos de invariantes sacados de libros de arquitectura y patrones, elegidos por metodología en un JSON preset, que valida o invalida cada llamada de escritura para que lo que entra ya cumpla el contrato de mantenibilidad que el usuario eligió.
>
> El paso que rompe el invariante no propaga.

> **Convenciones**
> - **[V]** marca un comportamiento verificado en documentación oficial o en código fuente. Para Claude Code la fuente es el markdown crudo de `https://code.claude.com/docs/en/<página>.md` (última versión en el changelog al 2026-10-01: **v2.1.287**). Para los demás harnesses, la matriz verificada de `docs/research/harnesses-2026-10-01.json` y `harnesses-grok-2026-10-01.json`.
> - **(a verificar)** marca un supuesto que hay que confirmar con un test de contrato contra la versión instalada antes de implementar.
> - **[MVP] / [v1] / [v1.1] / [v2]** indica en qué entrega aparece cada capacidad.
> - **U1–U11** son decisiones del usuario (Apéndice A; en `docs/inputs/decisiones-usuario.md` figuran como D1–D11). Mandan sobre cualquier otra cosa del documento. **DD-NN** son decisiones de diseño (Apéndice B).
> - **Alcance (U10).** PREGATE tiene una sola responsabilidad: que el código que viola el preset **nunca se escriba**. Es autosuficiente (funciona sin ArkGate) y componible (puede convivir con ArkGate sin doble enforcement). Reportes, burn-down, coverage y flujos de ciclo de vida son territorio de ArkGate, su generación anterior (U9, §15.0).
> - Las metodologías se citan por libro y capítulo, siempre parafraseadas. El documento no reproduce texto literal de ningún libro.
> - IDs, nombres de campos y términos técnicos van en inglés.

---

## 1. Visión y problema

**Qué es.** Un gate de pre-escritura. Antes de que el agente escriba o edite, cada llamada se valida contra un conjunto de invariantes. Si la viola, la llamada se invalida y el motivo vuelve como restricción del siguiente intento. No es un linter después del merge ni un párrafo en el prompt: es la ecuación del paso.

**Visión, en una frase verificable.** Elegís una o varias metodologías (por ejemplo Clean Architecture + DDD) y la IA no puede escribir código que las viole: cada escritura se valida *antes* de tocar el disco contra las invariantes que tu preset JSON activa, y el rechazo le dice a la IA qué corregir en el próximo intento. ESLint no sabe qué es un aggregate, una capa o un value object; PREGATE sí.

**Para qué.** El agente hoy gana si el código anda. Con el gate, la correctitud sigue siendo necesaria pero deja de ser suficiente. Una llamada puede compilar, pasar tests y aun así ser inválida si concentra complejidad, cruza una capa, parte una responsabilidad, inventa una abstracción de un solo uso o deja una dependencia en la dirección prohibida.

**Cómo se comporta el agente frente a una regla.** El agente no negocia la regla. Reescribe hasta cumplirla, o declara que la tarea no entra en el sobre del preset y se detiene. No hay tercera vía: ni esquivarla, ni recortar la tarea, ni reintentar lo mismo esperando otro resultado.

**Qué significa "100 % mantenible".** Significa **100 % conforme a las invariantes del preset elegido**, no "100 % a prueba de contexto futuro". El gate obliga a cumplir lo que está escrito; no obliga a que un humano no odie el código dentro de un año, y eso incluye lo que ningún libro nombró todavía. Por eso el preset dice de forma explícita qué metodologías están encendidas. Si una regla se puede satisfacer en la letra y romper en el espíritu, se parte en una regla más chica o se saca. **Una regla que el agente puede ganar sin mejorar la estructura no se queda en el catálogo** (§5.4, §12).

**El preset viaja con el proyecto.** `.pregate/preset.json` se versiona en el repo y fija las versiones de las fuentes de reglas. Otro agente, otra sesión u otro harness (Claude Code, Codex, Grok Build…) aplican las mismas invariantes. La metodología deja de ser una preferencia del prompt y pasa a ser configuración.

**Ambición, aterrizada.**
- **Catálogo:** cientos de invariantes binarias trazables a libros. El horizonte es de unas 400 entradas sobre unos 265 checks canónicos deterministas (§7). Las prácticas que hoy no se pueden volver binarias no entran al catálogo: esperan en un backlog de candidatas (§5.5).
- **Lo que bloquea:** en v1, entre 60 y 120 invariantes deterministas para TypeScript con precisión medida. El MVP trae 18 (12 de metodología y 6 de integridad), elegidas para demostrar que la combinación de metodologías cambia lo que se bloquea.

**El problema.**
- Los agentes producen código que **funciona** (compila, pasa tests) y que con frecuencia **no es mantenible por humanos**:
  - capas violadas (el dominio importa el ORM);
  - funciones largas y anidadas;
  - abstracciones especulativas o, al revés, fragmentación sin sentido;
  - errores tragados;
  - conocimiento duplicado;
  - tests debilitados para que pasen.
- Las reglas en el prompt (CLAUDE.md, AGENTS.md, `.cursorrules`) son **sugerencias**: el modelo puede ignorarlas.
- Los linters existentes tienen tres limitaciones para este caso:
  - revisan **después** de escribir, o dependen de que el agente decida llamarlos por MCP;
  - no están organizados por **metodología**;
  - no producen mensajes pensados para que un LLM se corrija.
- La deuda la paga el humano que hereda el código.

**Hipótesis del producto.** Si cada escritura de la IA tiene que cumplir restricciones explícitas, elegidas por el equipo y verificables, y el rechazo permite corregir en un intento, entonces baja el costo del **próximo** cambio, lo haga un humano o una IA. Se mide en §16.

**Límite, dicho adentro del producto.** Gran parte del buen diseño (SRP real, nombres que revelan intención, el nivel de abstracción correcto) **no es hoy una invariante mecánica**. Esas prácticas no se disfrazan de reglas: quedan como candidatas en el backlog y entran al catálogo solo cuando el Rule Forge demuestra una versión binaria y no ganable, normalmente porque el preset aportó conocimiento (un glosario, un mapa de capas, marcadores) (§5.5, §12). *(U3, decidida: catálogo solo determinista.)*

**"Sí o sí", dicho con honestidad (U10).** La garantía es el conjunto **hook fail-closed + pre-commit + CI**, los tres con el mismo binario y el mismo lock. El hook es el enforcement primario y, ante input que no puede verificar (truncado, payload desconocido, parser que falla), deniega. Pero varios harnesses fallan abierto ante un timeout o un crash, y existen escrituras fuera de la tool de edición (shell, MCP, generadores). Esos huecos los cierran pre-commit y CI corriendo **exactamente las mismas invariantes**: no es una feature de ciclo de vida, es parte de la garantía.

**Repo piloto (U7, U8).** `Amarilla-David/amarilla-platform`: TypeScript mayoritario (además JS, PLpgSQL, Python y C#), grande y vivo, con ArkGate ya instalado como PreToolUse, eslint-rules con warning-ratchet y unos 240 tests de arquitectura. Por eso el ratchet para legado y la convivencia con ArkGate son críticos desde el MVP.

---

## 2. Qué es y qué NO es

### Qué es
- **[MVP]** Un **gate de pre-escritura** construido sobre un **core agnóstico de harness y de lenguaje**. El core recibe un evento normalizado (`ProposedChange`), reconstruye el archivo resultante, lo evalúa contra las invariantes del preset y devuelve una `Decision`:
  - `deny`, con un motivo accionable que ve la IA;
  - sin objeción (el flujo normal de permisos del harness sigue);
  - escalamiento (`ask` al humano o detención).
- **[MVP]** Un **adaptador de Claude Code** (PreToolUse sobre `Write`/`Edit`, guard de `Bash`/`PowerShell`/`Monitor`, gate en `Stop`). **[v1→v2]** Adaptadores para otros harnesses con hooks de pre-edición, y **[v1.1]** adaptadores post-edit con revert donde no hay pre-edit (§14).
- **[MVP]** Un **preset JSON** donde el usuario elige metodologías, resuelve de forma explícita los conflictos entre ellas, ajusta parámetros y severidades, y declara capas. Responde a la pregunta "¿qué invariantes valida cada llamada?" (§8.7).
- **[MVP]** **Reglas en JSON, nunca en prosa** (U1): una carpeta por check canónico, con su `check.json` y sus fixtures `pass`/`fail`/`trap`. La regla viaja con su prueba (§6).
- **[MVP]** Un **modo sombra** (`enforcement: "shadow"`) que evalúa sin bloquear. Es un modo **explícito de calibración** (piloto, convivencia con ArkGate), nunca el default: el default es `enforce`.
- **[MVP]** Un **pack de integridad** siempre activo, contra las evasiones baratas.
- **[MVP]** Un **binario único** que se usa igual en el hook, en pre-commit y en CI, con el mismo lock en disco: cada regla tiene una sola implementación. Desde el MVP hay pre-commit versionado y una plantilla mínima de CI; SARIF y plantillas por plataforma llegan en v1.
- **[MVP]** **Convivencia con ArkGate** sin doble enforcement (`coexist` en el preset, §15.0). **[v1]** Importador `pregate import arkgate`.
- **[MVP→v1]** Un **ratchet** para código legado que bloquea solo lo que empeora. En el MVP deniega toda violación en un símbolo nuevo y compara conteos por (regla, archivo) para los preexistentes; en v1, fingerprints por símbolo.
- **[v1]** Un **catálogo curado** de checks canónicos agrupados por área y de manifiestos de metodología que los referencian.
- **[MVP→v1]** Un **compilador de presets** que exige resolución explícita de cada conflicto y produce un lockfile determinista en disco (MVP); herencia, scopes y fuentes remotas en v1.
- **[v1]** Un **servidor MCP de PREGATE** con dos funciones: introspección para el agente (`get_active_invariants`, `check`, `explain_rule`) y el **Rule Forge**, donde el agente propone invariantes nuevas y PREGATE actúa como juez determinista (U2, U4; §12).
- **[v1]** Distribución como **plugin** de Claude Code.

Arquitectura: **un core, tres caras.** El hook es el enforcement, la CLI es la cara del humano y el MCP es la cara del agente (U4).

### Qué NO es (no-objetivos)
1. **No es una frontera contra un adversario malicioso.** El hook es el **enforcement primario y falla cerrado**; pre-commit y CI corren las mismas invariantes con el mismo binario y el mismo lock, y forman parte de la misma garantía (U10). Lo que no promete es resistir a alguien con permisos locales que quiere apagarlo a propósito: el agente tiene permisos de escritura y varios harnesses fallan abierto ante un timeout o un crash (§14.5). Contra eso, la red es CI con CODEOWNERS.
2. **No contiene reglas de juicio.** El catálogo solo tiene reglas binarias y deterministas (U3, decidida). Las prácticas de juicio esperan en el backlog de candidatas. Las revisiones con LLM **quedan fuera del producto** (§18.6).
3. **No es una herramienta de ciclo de vida.** No hace reportes de deuda, burn-down, coverage, exploración, planificación ni guía "antes" del tipo CLAUDE.md: eso es territorio de ArkGate (U10). PREGATE solo previene, y verifica las mismas invariantes en pre-commit y CI.
4. **No usa el MCP como enforcement.** El MCP es opcional: el agente puede no llamarlo. El enforcement es solo el hook (y, como red, pre-commit y CI).
5. **El agente no escribe sus propias restricciones.** Puede **proponer** reglas por el Forge y proponer cambios al preset como solicitudes; nunca **activarlas**. Activar en el preset es un acto humano por la CLI (`pregate preset apply`, `pregate forge promote --activate`), y `preset.json` es siempre `deny` para el agente (U4, §8.6).
6. **No reemplaza ESLint, Ruff, Sonar ni el compilador.** No valida sintaxis, tipos, formato ni corrección funcional. Su valor está en la capa de metodologías y en el bucle con el agente.
7. **No corrige código por su cuenta.** Nunca reescribe el input de la herramienta (`updatedInput` o equivalente): deniega y explica (§13.9).
8. **No garantiza "buen diseño".** Garantiza el cumplimiento de un contrato explícito.
9. **No reproduce los libros.** Solo paráfrasis cortas con cita.
10. **No implementa todos los lenguajes ni todos los harnesses en el MVP.** El MVP trae el language pack de TS/JS y el adaptador de Claude Code, pero el core se diseña agnóstico de harness y de lenguaje desde el día 1 (U6).
11. **No reemplaza la revisión humana de PRs.** Le quita al revisor los problemas mecánicos.
12. **No es para organizaciones en el MVP.** Managed settings, CODEOWNERS y el registro de packs llegan en v1 o v2.

---

## 3. Usuarios y casos de uso

**Usuario primario del MVP:** un dev individual o un equipo chico que trabaja en TypeScript y delega mucho en un agente de código (Claude Code en el MVP).

| Usuario | Entrega | Situación | Qué necesita |
|---|---|---|---|
| **Dev individual** | MVP | Proyecto nuevo o mediano, delega mucho a la IA | Elegir 2 o 3 metodologías y que la IA no se salga del carril sin revisar cada diff. Instalación en menos de 5 minutos |
| **Equipo chico con legado** | MVP (conteos + símbolos nuevos) → v1 (fingerprints) | Repo con deuda | Que la IA no empeore el código (ratchet) sin quedar bloqueada por violaciones heredadas |
| **Equipo del repo piloto** (amarilla-platform, U7) | MVP | Repo TS grande y vivo, con ArkGate ya instalado y reglas propias en `arkrules`, CLAUDE.md, AGENTS.md y `docs/north-star` | Un pack `amarilla/` con sus invariantes (U8), convivencia con ArkGate sin doble enforcement (U9) y ratchet confiable |
| **Equipo multi-harness** | v1 | Una persona usa Claude Code, otra Codex o Grok Build, en el mismo repo | El mismo preset produce las mismas decisiones en cualquier harness soportado |
| **Tech lead** | v1 | Varios devs y agentes en el mismo repo | Preset versionado como contrato de diseño, el mismo en el hook y en CI, y excepciones con aprobación humana |
| **Equipo con convenciones propias** | v1 | Le falta una invariante que ningún pack trae | Que su agente la proponga por el Forge, que PREGATE la juzgue y que un humano la active |
| **Organización o plataforma** | v2 | Muchos repos y políticas comunes | Preset corporativo, packs compartidos por git o npm, hook en managed settings, métricas agregadas |
| **Autor de reglas o comunidad** | v2 | Quiere aportar una metodología o un language pack | Reglas como datos, fixtures como prueba, corpus de trampas, precisión medida |

**Casos de uso**
- **UC1. Greenfield con arquitectura elegida [MVP].** Preset con `clean-architecture` + `ddd-tactical`. La IA importa `@prisma/client` desde `src/domain/`. El hook deniega con CA-DEP-002 e indica la ruta de puertos declarada en el preset, y la IA corrige.
- **UC2. Dos presets, dos comportamientos [MVP, criterio de demo].** Sobre el mismo repo:
  - con `functional-core-imperative-shell`, `Date.now()` dentro de `src/core/` se deniega (FCIS-IO-002);
  - con `clean-architecture` + `ddd-tactical`, ese código pasa, y lo que se deniega es un setter público en una entidad (DDD-ENT-001).
- **UC3. Legado [MVP].** Una función de 180 líneas recibe un bugfix. Se permite si no aparecen violaciones nuevas en el archivo respecto del inicio de la sesión, y toda violación sobre un símbolo que no existía al inicio de la sesión se deniega sin compensación. En v1 además se exige que la función no crezca, con un aviso de *sprout method*.
- **UC4. Tests debilitados [MVP].** La IA borra aserciones para que el test pase. TDD-DEL-001 escala de inmediato al humano (`ask`) en sesiones interactivas de harnesses donde `ask` es confiable y, en las demás, deniega y detiene el turno.
- **UC5. Bypass por shell [MVP].** Después de un deny, la IA intenta `cat > src/x.ts <<EOF`. El guard de shell lo deniega, el gate de Stop lo detecta igual si se escapó, y el pre-commit lo frena antes del commit.
- **UC6. Explicar [MVP].** Dos comandos:
  - `pregate explain CC-FN-002` muestra fuente, porqué, fixtures de ejemplo y parámetros efectivos;
  - `pregate explain --path src/domain/invoice.ts` lista todas las invariantes que aplican a ese archivo.
- **UC7. Conflicto entre metodologías [v1].** El usuario agrega `code-complete` a un preset que ya tiene `clean-code`. Las dos fijan `fn.params` (3 contra 7). `pregate preset compile` falla, muestra el conflicto, propone la sugerencia de `pairs.json` y espera a que el humano escriba la resolución en el preset. Nadie elige el lado fácil por él. *(En el MVP los manifiestos embebidos no se pisan entre sí; el camino de error del compilador se prueba con un manifiesto local de fixture que fija otro `fn.params`.)*
- **UC8. CI [MVP plantilla mínima; v1 SARIF].** `pregate check --ratchet` aplica en el pipeline el mismo lock que vio el agente, con el mismo binario (U10).
- **UC9. Mismo preset, otro harness [v1].** En una sesión de Grok Build, el agente intenta el mismo import de Prisma desde el dominio. El adaptador de Grok normaliza el `search_replace`, el core deniega con CA-DEP-002 y el motivo compacto (≤ 256 caracteres) llega al modelo.
- **UC10. Forjar una invariante [v1].** El equipo quiere "ningún archivo de `src/domain/` declara una clase con sufijo `Repository` que no sea una interface". El agente, vía MCP, crea el borrador, escribe `check.json` y fixtures, y pide el juicio. El juez corre las fixtures, verifica determinismo y aplica el corpus de trampas: detecta que renombrar a `Repo` evade la regla y la rechaza con ese motivo. El agente endurece la regla, el juez la admite y el humano la promueve y la activa con la CLI.
- **UC11. Piloto con ArkGate [MVP].** En amarilla-platform, ArkGate sigue haciendo cumplir sus capas. El preset declara en `coexist.arkgate` qué invariantes son de ArkGate; PREGATE no las evalúa (quedan en el lock con ese origen) y aplica el resto. Ninguna invariante la deniegan las dos herramientas a la vez.

---

## 4. Cómo funciona (flujo end-to-end)

### 4.1 Arquitectura del flujo: adaptador → core → adaptador

```
 Harness (Claude Code, Codex, Grok Build, …)
   │  evento nativo (PreToolUse / BeforeTool / tool.execute.before / …)
   ▼
 Adaptador del harness  ──► ProposedChange { harness, tool, path, before, after, session, … }
   │                        (normaliza archivo completo | old/new string(s) | patch)
   ▼
 Core PREGATE (agnóstico de harness y de lenguaje)
   · raíz del proyecto + preset/lock + fuentes de reglas fijadas
   · ¿ruta protegida? · scope · reconstrucción validada
   · language pack → IR neutral (módulos, imports resueltos, funciones, params,
     complejidad, superficie pública)
   · reglas activas (phase=pre) · ratchet contra before_sesión · contadores
   ▼
 Decision { verdict: allow | deny | ask, halt, violations[], warnings[],
            reasonCompact (≤ 256), reasonFull }
   │
   ▼
 Adaptador del harness ──► salida nativa (exit 2 + JSON, throw, {block, reason}, …)
                           allow ⇒ "sin objeción": NUNCA un allow nativo
```

El mismo core sirve a la CLI (`pregate check`, pre-commit, CI) y al servidor MCP (`check` en modo dry-run). Lo que cambia entre caras es solo la entrada y la salida.

### 4.2 Diagrama del adaptador de referencia (Claude Code)

```
 SessionStart (startup|resume; y "compact" para reinyectar [v1])
   └─► pregate hook session-start --harness claude-code
        · busca .pregate/preset.json (sin preset → systemMessage 1 vez/sesión, inactivo)
        · lock en disco vigente? (hash del preset + fuentes + motor) → si no, recompila en
          memoria (determinista, desde el preset commiteado) + systemMessage "corré pregate
          preset compile y commiteá el lock". Si la compilación falla → failMode en Pre.
          pre-commit y CI fallan si el lock commiteado no coincide con el preset
        · SNAPSHOT de sesión por (session_id, raíz): HEAD + git status + copia de los
          archivos sucios/no rastreados en scope. Si SessionStart falló o venció, se toma
          de forma perezosa en el primer evento de la sesión                      [MVP]
        · additionalContext: resumen compacto del preset + comando de pre-check    [MVP]

 Claude decide Write / Edit / (MultiEdit)
        │
        ▼
 ┌──── PreToolUse  matcher "Write|Edit|MultiEdit|NotebookEdit|Bash|PowerShell|Monitor" ─────────────┐
 │ 0. Despacho por tool_name (un único handler; los handlers que coinciden corren en paralelo [V]) │
 │ 1. stdin: tool_name, tool_input, tool_use_id, cwd, session_id, permission_mode, agent_id?       │
 │ 2. Adaptador: ¿el payload coincide con el perfil declarado (--harness)? Si no → failMode        │
 │ 3. ProposedChange; path = realpath del ancestro existente más profundo + segmentos restantes;   │
 │    raíz = primer .pregate/ hacia arriba, aceptada solo si existía en la snapshot o en HEAD,      │
 │    o si el preset raíz la declara (si no: la raíz anidada se ignora y es ruta protegida)        │
 │ 4. ¿Ruta protegida? (**/.pregate/**, carpetas de reglas, settings de harnesses, directorio de    │
 │    datos; sin distinguir mayúsculas en volúmenes que no distinguen) → deny                      │
 │ 5. Scope: include − exclude − generado − .pregate/** (siempre fuera). Un marcador de generado o   │
 │    un exclude eximen solo archivos que el agente no edita: crear uno nuevo → EVA-GEN-001 /      │
 │    EVA-SCOPE-001; editar uno que ya existía → EVA-GEN-002                                       │
 │ 6. Reconstrucción: current = disco; after = aplicar tool_input (§4.4)                           │
 │ 7. before_sesión = snapshot (o HEAD; o ∅ si el archivo es nuevo en la sesión). Snapshot         │
 │    ausente para una sesión ya registrada → failMode, nunca un nuevo "primer contacto"           │
 │ 8. Language pack: parse (tree-sitter) → IR. Nodos ERROR en el rango cambiado → deny de forma    │
 │ 9. Reglas phase=pre del lock (A, B-local, integridad) sobre after                               │
 │10. Ratchet: violaciones(after) contra violaciones(before_sesión)                                │
 │11. Decisión: severidad × enforcement × contadores (estado append-only) × permission_mode        │
 └──────────────────────────────────────────────────────────────────────────────────────────────────┘
    │ nada nuevo            │ solo warn (introducido)      │ deny                │ escalamiento
    ▼                       ▼                              ▼                     ▼
 exit 0 vacío        exit 0 + additionalContext    exit 2 + JSON deny     interactivo: exit 0 + ask
 (sigue el flujo     ("informational; no action    + reason (lo ve        (+ additionalContext)
  normal de permisos) required for this task")      Claude)               resto: exit 2 + deny
                                                                          + continue:false + stopReason
    │
    ▼ la tool escribe en disco
 PostToolUse Write|Edit [v1] ─► relee el disco; emite SOLO si Pre no evaluó o hay deny nuevo no
                                informado (dedupe por tool_use_id + fingerprint):
                                "This write WAS ALREADY APPLIED. Fix forward with Edit."
 PreToolUse Bash/PowerShell/Monitor [MVP]
                             ─► rutas protegidas, comandos administrativos, binarios de otros
                                harnesses, escritura a rutas en scope → deny.
                                Snapshot puntual solo si coincide la heurística [v1]
 PostToolUse Bash [v1]       ─► si hubo snapshot puntual: diff → evaluar → block + reason
 PostToolBatch [v1]          ─► solo registra imports resueltos dentro del lote; additionalContext si
                                se verifica que lo admite. NUNCA block (detiene el loop agéntico);
                                las violaciones van a Stop
 ConfigChange [v1]           ─► block de cambios que apagan hooks o el plugin
    │
    ▼
 Stop [MVP] / SubagentStop [v1, solo archivos del agent_id]
   ─► git diff + status contra la snapshot de cada raíz tocada en la sesión (incluye worktrees;
      cubre Bash, MCP, run_in_background)
   ─► si background_tasks[] no está vacío: sesión pendiente → re-evaluar en el próximo Pre/Stop
      y en SessionEnd
   ─► reglas phase=stop: integridad de tests por sesión, contrapesos, ciclos y duplicación [v1]
   ─► violaciones introducidas en la sesión: decision:block (máx. 2 por turno)
      heredadas o de bajo impacto: additionalContext (feedback no-error [V])
   ─► después del tope: systemMessage al humano con lo pendiente

 pre-commit [MVP] / CI [MVP plantilla mínima; v1 SARIF] ─► mismo binario, mismo lock
   ─► cierre de la garantía (U10): las mismas invariantes para todo harness, con o sin hooks
```

Los demás harnesses siguen el mismo esquema con sus eventos equivalentes (inicio de sesión, pre-tool, post-tool, fin de turno) cuando existen. La tabla de equivalencias y lo que falta en cada uno está en §14.

### 4.3 Entrada que recibe el adaptador de Claude Code [V]

**Campos comunes** (fuente: https://code.claude.com/docs/en/hooks, sección "Common input fields"):
- `session_id`, `prompt_id`, `transcript_path`, `cwd`, `permission_mode`, `hook_event_name` y `effort.level`;
- `agent_id` y `agent_type` cuando la llamada viene de un subagente.

**Campos de PreToolUse:** `tool_name`, `tool_input` y `tool_use_id`.

**Formas de `tool_input`** (según la doc de hooks y los tipos del SDK de TypeScript):

| Tool | `tool_input` |
|---|---|
| `Write` | `{ file_path, content }` |
| `Edit` | `{ file_path, old_string, new_string, replace_all? }`. Reemplazo exacto, sin regex, contra el contenido actual [V] |
| `NotebookEdit` | `{ notebook_path, cell_id?, new_source, cell_type?, edit_mode? }`. Queda fuera del MVP |
| `Bash` / `PowerShell` | `{ command, description?, timeout?, run_in_background? }`. `PowerShell` existe también como opt-in en macOS y Linux [V] |
| `Monitor` | Ejecuta comandos en background con las mismas reglas de permisos que `Bash` [V]. Se normaliza a `ProposedCommand` con `background: true` |
| `MultiEdit` | **No figura** en la documentación actual. Va en el matcher por compatibilidad; si llega, `reconstruction: unknown` ⇒ `failMode` hasta tener un test de contrato |

**Otros hechos verificados:**
- En Write y Edit, `file_path` llega **siempre absoluto**. En Windows usa backslashes.
- `cwd` sigue a Claude en `cd` y en worktrees, pero `${CLAUDE_PROJECT_DIR}` no. Por eso la raíz se determina buscando `.pregate/` hacia arriba desde `file_path`.

### 4.4 Reconstrucción del archivo resultante

Hay **tres formas de edición** entre los harnesses relevados. El adaptador traduce cada herramienta nativa a una de ellas y el core reconstruye `after` con un algoritmo común (el detalle por harness está en §14.2):

| Forma | Ejemplos nativos | Algoritmo |
|---|---|---|
| **Archivo completo** | Claude `Write`, Gemini/Qwen `write_file`, Copilot `create`, VS Code `create_file`, Grok `write`, opencode/Kilo `write`, Factory `Create`, pi `write` | `after = content`. Si el perfil marca la tool con `mayRewrite` (Gemini `write_file`: unescape con modelos no Gemini 2/3 y `ModifyWithEditor` [V]), `exact` vale solo para el contenido declarado y la re-evaluación post-tool es obligatoria [v1] |
| **Insert / append** | Kiro `fs_write` insert/append, Cline `editor.insert_line` | Insertar en la línea o al final según el perfil; si la posición no es determinable, `unknown` |
| **old/new string(s)** | Claude `Edit`, Qwen `edit`, Gemini `replace`, Copilot `edit`, Grok `search_replace`, opencode/Kilo `edit`, Augment `str-replace-editor` (pares numerados), pi `edit` (lista de pares contra el original), Cline `editor`, VS Code `replace_string_in_file` / `multi_replace_string_in_file` | Leer el disco y aplicar cada reemplazo con la semántica del harness: exacto y único salvo `replace_all`; en secuencia o contra el original, según declare el perfil |
| **Patch** | Codex `apply_patch` (`*** Begin Patch`, multiarchivo, hunks por contexto), opencode/Kilo/Amp/Factory/Cline/VS Code/Grok-codex `apply_patch`, Grok `hashline_edit` (anclas por hash de línea) | Parsear el patch con el parser del dialecto, generar un `ProposedChange` por archivo afectado (alta, baja, modificación, movimiento) y aplicar los hunks sobre el disco con matching por contexto o por ancla |

**Resultado de la reconstrucción.** Cada `ProposedChange` lleva un campo `reconstruction`:
- `exact`: se evaluó el contenido final con certeza.
- `tool-will-fail`: en un harness con matching exacto, `old_string` no aparece o no es único. **Se deniega de forma**, sin consumir el contador de la regla: "old_string not found / not unique; re-read the file and resend". La tool iba a fallar igual, así que denegar no cuesta nada, y cierra el hueco de una edición paralela que haga aparecer `old_string` entre el Pre y la ejecución (TOCTOU).
- `unknown`: el resultado no se puede determinar. Casos: matching difuso del harness (Gemini `replace` prueba exacto → flexible → regex → fuzzy [V]), placeholders del tipo "...existing code..." (VS Code `insert_edit_into_file` [V]), payload no documentado, dialecto de patch sin parser todavía (por ejemplo `hashline_edit` antes de su soporte), `old_string` vacío en un harness cuyo perfil declara `emptyOld: "unknown"`.
- `truncated`: el harness truncó el input (Grok Build reemplaza un `toolInput` de más de 128 KiB por un string que termina en " [truncated]" y marca `toolInputTruncated` [V]).

**`old_string` vacío.** En Qwen y Grok crea un archivo nuevo [V]; en Claude Code no está documentado. El perfil declara `emptyOld: "create" | "error" | "unknown"`; con `unknown` se aplica `failMode`. Hay un test de contrato para `Edit` de Claude con `old_string: ""`.

**Regla dura (U10):** `unknown` y `truncated` **nunca** producen "sin objeción". Se aplica `failMode` (default `closed`: deny) con un motivo de forma: "PREGATE cannot evaluate this edit; resend it as an exact replacement or a full write". El agente puede cumplir de forma determinista.

**Input truncado (Grok Build).** Si `tool_input` llega como string o `toolInputTruncated` es `true`, el adaptador extrae `file_path` del prefijo con un parser JSON tolerante (el orden de claves no está garantizado). Si la ruta queda fuera de scope (un lockfile, por ejemplo), no hay objeción. Si no se puede extraer o está en scope, `failMode` con el motivo "input truncated by the harness (>128 KiB): create the file small, then extend it with search_replace edits under 128 KiB each".

**Detalles**
- **Normalización.** Se detectan BOM y CRLF, se normaliza a `\n` y las posiciones se mapean de vuelta para los mensajes.
- **Errores de sintaxis en `after` (U10: "parser falla ⇒ deny").** Si `after` tiene nodos `ERROR` dentro del rango cambiado por la llamada, la salida es un **deny de forma** que no consume contador: "PREGATE cannot parse the edited region (<file>:<line>); send syntactically complete code". Los `ERROR` preexistentes fuera del rango cambiado no bloquean, pero las reglas que necesitan ese subárbol lo reportan como no evaluado. Así se cierra la evasión de escribir código que tsc acepta y tree-sitter no parsea.
- **Borrado (`change.kind: delete`).** En Pre se evalúan rutas protegidas y borrado de tests (TDD-DEL-001, EVA-TEST-001); el resto de las reglas se re-evalúa en Stop sobre el árbol resultante.
- **Patch multiarchivo.** Si cualquiera de los archivos del patch produce `deny`, se deniega la llamada entera: el harness no permite aplicarla en parte. El mensaje agrupa por archivo.
- **Llamadas en paralelo.**
  - Las capas se deciden por la **ruta** resuelta del import, no por su existencia. Un import relativo hacia un archivo que todavía no existe (porque se escribe en el mismo lote) igual se evalúa por glob.
  - Un import que no se puede resolver (alias sin coincidencia) y que no es un paquete externo: en un archivo de una capa `kind: core | port`, **deny de forma** ("unresolvable import in a core layer; use a relative path or a tsconfig alias that resolves"). Fuera de esas capas, no genera violación en Pre y se re-evalúa en Stop.
  - Dos ediciones paralelas sobre el mismo archivo se evalúan contra el mismo disco. El estado las marca y Stop evalúa el resultado combinado.

### 4.5 Decisión y salida (adaptador de Claude Code)

| Resultado | Salida | Quién lo ve |
|---|---|---|
| Fuera de scope, o sin violaciones nuevas | `exit 0`, stdout vacío. **[V]** "Staying silent doesn't approve it": sigue el flujo normal de permisos | nadie |
| `enforcement: shadow` | `exit 0` vacío; lo que se habría denegado va a `state/` | nadie (log) |
| Solo `warn` **introducidos en esta llamada** | `exit 0` + `hookSpecificOutput.additionalContext` | Claude, como system-reminder **[V]** |
| `deny` | **`exit 2`** + JSON con `permissionDecision:"deny"` y `permissionDecisionReason`; stderr lleva **siempre** el mismo `reasonFull` (con JSON inválido, Claude toma el motivo de stderr) | **Claude** **[V]**: el canal de autocorrección |
| Escalamiento en sesión interactiva (`loop.escalate: "ask"`) | `exit 0` + `permissionDecision:"ask"` + reason + `additionalContext` con la violación (a verificar que `additionalContext` se entrega junto a `ask`) | el humano ve el reason **[V]**; Claude ve el `additionalContext` |
| Escalamiento por defecto (`"stop"`), o cualquier `ask` en una sesión no interactiva | `exit 2` + JSON `deny` + `continue:false` + `stopReason` (a verificar que `continue` se respeta con exit 2) | el humano (`stopReason`) y Claude (reason) |
| Sin preset en el repo | `exit 0` + `systemMessage` una vez por sesión: "PREGATE inactivo: corré `pregate init`" | el humano |
| Lock desactualizado | Recompilación en memoria desde el preset commiteado + `systemMessage`. Si falla, se aplica `failMode`. pre-commit y CI fallan con lock desactualizado | el humano |
| Versión del motor o de `core` distinta de la fijada en el preset | `failMode` con "engine/core version mismatch"; `check` en pre-commit/CI sale con exit ≠ 0 | el humano |
| Payload que no coincide con el perfil del harness declarado | `failMode` con el motivo "harness payload not recognized" | según el modo |
| Error interno o watchdog vencido | `failMode` (§13.6) | según el modo |

**[V] Hechos que condicionan el diseño** (fuentes: hooks y https://code.claude.com/docs/en/hooks-guide):
- **Exit 2 bloquea siempre**, aunque el JSON sea inválido (desde v2.1.214), y usa como motivo el `reason` del JSON. Por eso todo deny sale con exit 2 **y** JSON. Con exit 0, un JSON truncado equivale a no decidir.
- Exit 1 sin JSON, un crash, un timeout o una ruta mal escrita **no bloquean**: "a mistyped path in settings.json leaves the gate silently disabled".
- **Precedencia** entre hooks: `deny > defer > ask > allow`. Un `deny` bloquea en **todos** los modos, incluido `bypassPermissions`.
- `continue:false` tiene prioridad sobre cualquier decisión.
- `ask` fuerza el prompt en modo `auto`. Con `bypassPermissions` y `dontAsk`, su comportamiento no está documentado. Por eso, **regla dura**: `ask` se emite solo si se cumplen todas estas condiciones:
  - `permission_mode ∈ {default, acceptEdits, auto, plan}`;
  - no hay `agent_id`;
  - `loop.allowAsk` no es `false`;
  - `CLAUDE_CODE_REMOTE` no es `true`;
  - el perfil del harness declara `ask` confiable **para ese modo nativo** y hay una señal de interactividad (`ask.modes`, `ask.headlessSignal`, §14.3);
  - **la ruta no es protegida**: sobre configuración de PREGATE o de harnesses nunca hay `ask`, siempre `deny` (§8.6), porque no está verificado que `ask` obligue a mostrar el prompt en todos los modos (por ejemplo `acceptEdits`; el changelog registra un caso en que `auto` anulaba un `ask` de hook).

  En cualquier otro caso, `ask` se convierte en deny con `continue:false`. Sin señal de interactividad, `ask` se convierte en `deny`. Las sesiones `-p` o SDK no traen un campo documentado que las identifique (a verificar), así que para CI o headless se configura `loop.allowAsk: false`.
- PREGATE **nunca** emite `permissionDecision:"allow"` (ni el allow nativo de ningún harness): solo restringe, no otorga permisos. En Qwen Code, por ejemplo, `allow` significa "correr sin el prompt de aprobación" [V].

---

## 5. Modelo de invariantes

### 5.1 Qué es una regla: cuatro cosas

Una regla es un invariante, no un estilo. Tiene exactamente cuatro cosas, y cada una vive en un campo JSON:

| Qué | Campo | Ejemplo |
|---|---|---|
| **Qué mira** | `check.observes` (`diff`, `file`, `import-graph`, `public-surface`, `session`) + `check.ir` (capacidades de IR que necesita) | el archivo resultante y sus funciones |
| **Cuándo falla** | `check.impl` + parámetros (defaults del alias, resolución del preset) | una función con más de 3 parámetros |
| **Qué devuelve para el reintento** | `check.feedback` + `alias.why`, `alias.fixHint`, `alias.avoid` + datos que calcula el motor | "agrupá los parámetros que viajan juntos en un tipo con nombre del glosario" |
| **De qué fuente sale** | `alias.source` (obra, capítulo, paráfrasis corta) | *Clean Code*, cap. 3 |

"Preferí nombres claros" no entra. "Ningún tipo de dominio importa un framework de infraestructura" entra. "No subas la masa de complejidad de una función que ya está sobre el umbral" entra. "No agregues una abstracción pública con un solo caller" entra.

Una invariante activa sin fuente no compila: toda regla que el preset enciende llega a través de un alias de metodología con `source`, aunque sea una metodología local del equipo ("ADR-012 del equipo").

### 5.2 Niveles de verificabilidad y dónde corre cada uno

El catálogo contiene **solo reglas binarias y deterministas**: mismo input, mismo veredicto, y el veredicto es "se cumple" o "no se cumple" (U3, decidida el 2026-10-01).

| Nivel | Qué necesita | Costo | Dónde corre | Severidad máxima |
|---|---|---|---|---|
| **A**, determinista local | IR del archivo resultante + preset | 1 a 30 ms | **Pre** + Stop + pre-commit + CI | `deny` |
| **A con `heuristic:true`** | Igual que A; binaria y determinista, y **pasa el corpus de trampas como cualquier otra**, pero con falsos positivos esperables por umbrales difusos y precisión todavía no medida. Un check léxico sin conocimiento del preset (glosario, marcadores) no es heurístico: es ganable y va al backlog (§5.5) | 1 a 30 ms | Pre | `warn`. Sube a `deny` solo con precisión medida ≥ 0,9 o con `allowHeuristicDeny` explícito |
| **B-local**, estructural decidible con el archivo tocado | Imports del archivo resueltos a capas por glob, siguiendo re-exports hasta 3 saltos | 5 a 50 ms | **Pre** | `deny` |
| **B-global**, grafo del proyecto o estado | Grafo de imports y de llamadas cacheado, historial de sesión, git | 50 ms a varios s | **Stop / SubagentStop**, pre-commit, CI | `deny` (vía bloqueo de fin de turno) |
| **Diff / integridad** | `before_sesión` contra `after` | 1 a 30 ms | Pre (por llamada) y Stop (por sesión) | `deny` / `ask` |
| ~~C, semántica~~ | — | — | **No existe en el catálogo.** Las prácticas de juicio son *candidatas* (§5.5) | — |

**Criterio para que una regla corra en Pre:** su violación **nunca** puede ser un estado intermedio válido de un buen refactor.
- Una arista de import prohibida, un `catch` vacío o una supresión nueva: van en Pre.
- Un ciclo transitorio, una duplicación mientras se extrae un módulo o la "proporción de funciones llamadas una vez": van en Stop.

**Contrapesos (anti-Goodhart).** APOSD-CONJ-001 y la proporción de funciones triviales llamadas una sola vez necesitan el grafo de llamadas, así que son **B-global**.
- [v1] Corren en Stop, pre-commit y CI como **delta de sesión**, con `warn`, o con `ask` si superan un umbral. **Nunca** son `deny` por llamada: Extract Function produce, por definición, una función con un solo caller.
- En Pre solo aparecen como texto "Avoid:" en el mensaje. En el MVP los contrapesos existen **solo** como ese texto.

**Precisión: una sola regla.** El requisito de precisión medida ≥ 0,9 para `deny` aplica a las reglas `heuristic:true`. Las reglas A y B no heurísticas son `deny` por construcción (binarias, con fixtures y corpus de trampas), y su precisión se **monitorea** después: si la medición cae por debajo de 0,9, o la corrección beneficiosa no llega al umbral (§16.1), la regla **sale del catálogo** (vuelve a `forging` en el backlog) o se parte en una regla más chica. No se queda como `warn`: una regla que no mejora la estructura no se queda.

**El preset puede volver verificable una candidata.** Si el usuario externaliza conocimiento, prácticas que eran de juicio pasan a A o B y pueden entrar al catálogo por el Forge:
- `glossary` convierte "usá el lenguaje ubicuo" en DDD-UL-001 (sinónimos prohibidos), nivel A;
- `layers` convierte "no mezcles capas" en B-local;
- `markers` (sufijo, carpeta o decorador) convierte varias reglas DDD en A.

`init` pide estos artefactos de forma explícita [v1].

### 5.3 Checks canónicos y alias de metodología

Cerca del 35 % de las reglas de distintos libros son el mismo check con otro umbral. Por eso hay dos capas:

- **Check canónico** (`core/complexity/fn-max-lines`, `core/dependencies/layer-direction`, …).
  - Es la implementación, escrita una vez. Si opera sobre la IR neutral, sirve para todo lenguaje cuyo language pack provea esas capacidades; si es idiomático, vive en el language pack (§13.4).
  - Vive en **su propia carpeta**, agrupada por **área** (`dependencies`, `complexity`, `api-surface`, `errors`, `testing`, `naming`, …), con su `check.json` y sus fixtures (§6).
  - **Es dueño de los parámetros, con nombres canónicos** (`max`, `paths`, `packages`).
  - Declara su `cardinality`:
    - `singleton`: umbrales. Hay **una sola regla efectiva por (canónico, scope)**. Si dos metodologías activas le dan valores **o severidades** distintos, es un **conflicto** que el preset tiene que resolver (§8.5).
    - `multi`: listas o patrones dirigidos a rutas. Hay una regla efectiva por instancia, y las instancias con parámetros idénticos se deduplican. Combinar es **unión**: CA-DEP-002 y FCIS-IO-001 son dos instancias de `core/dependencies/banned-imports` y las dos se aplican. Si dos instancias idénticas traen severidades distintas, también es un conflicto a resolver.
  - **Excepción única: integridad.** Si un alias de `core/pregate-integrity` y uno de metodología usan el mismo check (EVA-TEST-001 y TDD-DEL-001 sobre `assertions-no-decrease`), el de integridad absorbe al otro: una sola violación con la severidad más alta. No es un default silencioso: la integridad no se puede bajar (§8.5.7), así que ese es el único resultado legal.
- **Invariante de metodología (alias)** (`CC-FN-001`, `CC2-RT-001`, `RF-SM-003`).
  - Vive **dentro del manifiesto de su metodología** (`methodologies/<id>.json`), que referencia el check por ID. La metodología no es una carpeta de reglas: es un manifiesto (U5).
  - **Correspondencia con U5.** La "regla" de U5 (`rule.json` en su carpeta, con su prueba) es, en esta spec, el **check canónico** (`check.json` + `fixtures/`). El alias es la vista de metodología sobre ese check y vive en el manifiesto; si necesita fixtures propias con sus defaults, van en `methodologies/<id>/aliases/<ALIAS>/fixtures/{pass,fail}` (§6.2). Así la regla sigue viajando con su prueba aunque el alias venga de otra fuente que el check.
  - Aporta defaults, fuente, `stance`, severidad por defecto, `why`, `fixHint`, `avoid` y referencias a fixtures del check como ejemplos.
  - En el lock, la regla efectiva lista sus `aliases[]`, y el mensaje usa el ID del alias ganador (el que el preset eligió en la resolución, o el único activo).

### 5.4 Anatomía en JSON

**Check canónico** (`checks/complexity/fn-max-params/check.json` en la fuente `core`):

```jsonc
{
  "$schema": "https://<dominio-a-definir>/schema/check.v1.json",
  "id": "core/complexity/fn-max-params",     // <namespace>/<área>/<check>, estable para siempre (§6.5)
  "version": "1.2.0",                        // semver; ver §6.6
  "area": "complexity",
  "observes": "file",                        // qué mira
  "ir": ["functions.params"],                // capacidades de IR requeridas
  "languages": "ir",                         // "ir" = todo language pack que provea `ir`; o lista explícita
  "verifiability": "A",                      // A | B-local | B-global | diff
  "heuristic": false,
  "cardinality": "singleton",
  "dimension": "fn.params",                  // enum cerrado: dimensions.v1.json
  "measures": ["fn.input-arity"],            // propiedades estructurales que la regla mide (§12.4, paso 7)
  "minSeverity": null,                       // piso de severidad; solo lo usan los checks de integridad
  "params": {
    "max":                      { "type": "integer", "minimum": 0 },
    "countInlineObjectMembers": { "type": "boolean", "default": true },  // cierra la trampa `opts: {a;b;c;d}`
    "exempt":                   { "type": "array", "items": { "type": "string" }, "default": ["constructor"] }
  },
  "impl": { "kind": "primitive", "primitive": "metric", "metric": "params", "op": "<=", "param": "max" },
  // otros kinds: "pattern" (ast-grep o query tree-sitter embebida en JSON, por lenguaje)
  //              "custom"  (checker.* en la carpeta; exige "customJustification")
  "phase": ["pre", "stop", "commit", "ci"],  // enum: pre | stop | commit | ci
  "fingerprint": "symbol",                   // symbol | file | edge | none
  "ratchetable": true,
  "feedback": {
    "message": "{symbol} takes {measured} parameters (limit {max}).",
    "computedHints": ["co-travelling-params"]   // [v1] datos que el motor calcula para el reintento
  },
  "fixtures": { "trapFamilies": ["inline-object", "options-bag"] }  // las del autor; el juez agrega
                                                                     // todas las familias aplicables del corpus
}
```

**Alias de metodología** (entrada del manifiesto `methodologies/clean-code.json`):

```jsonc
{
  "id": "CC-FN-002",                         // FQN: core/CC-FN-002; forma corta válida si no es ambigua
  "check": "core/complexity/fn-max-params",
  "stance": "few",                           // postura dentro de la dimensión
  "defaults": { "max": 3 },
  "severity": "deny",                        // deny | ask | warn | off
  "source": {
    "work": "Clean Code (R. C. Martin, 2008)",
    "locator": "cap. 3, Funciones",
    "paraphrase": "Cada argumento extra encarece entender, invocar y probar una función; conviene que sean pocos."
  },                                         // ≤ 300 caracteres, sin citas entre comillas
  "why": "Many parameters usually hide an unnamed concept or a function doing too much.",
  "fixHint": "Group parameters that always travel together into a named domain type, or split the function by responsibility. Take the type name from the glossary or the file's domain.",
  "avoid": "Untyped `options` bags; inline object types that just move the same parameters.",
  "examples": { "fail": "fail/four-primitive-params", "pass": "pass/grouped-domain-types" },  // fixtures del check
  "counterweights": ["APOSD-CONJ-001"],
  "precision": { "measured": null, "sample": 0, "minForDeny": 0.9 }
}
```

Las fixtures **reemplazan** a los `examples` en texto y a los `knownEvasions` del borrador anterior: los ejemplos son casos ejecutables y cada evasión conocida es una fixture `trap/`.

**Reglas de calidad del catálogo** (las verifica `pregate rules test`, en el CI del catálogo y en el juez del Forge):
1. **Sin prueba ejecutable no hay regla.** Cada check tiene al menos dos fixtures `pass`, dos `fail` y una `trap` por cada familia del corpus **aplicable** según `observes` y el lenguaje, haya o no declarado esa familia el autor en `trapFamilies`.
2. **Determinismo.** El check produce el mismo resultado al correr dos veces, con el orden de archivos permutado y desde otro `cwd`. Un checker custom no puede leer reloj, azar, red, variables de entorno ni el sistema de archivos fuera de lo que le entrega el core.
3. **No ganable.** Ninguna transformación del corpus estándar de trampas convierte una fixture `fail` en `pass` sin mejorar la propiedad estructural que esa transformación preserva (§12.4). Si alguna lo logra, la regla se endurece o se rechaza.
4. Un alias sin `why`, `fixHint`, `avoid` y ejemplos **no puede tener `deny`**.
5. `heuristic:true` arranca en `warn` y sube a `deny` solo con `precision.measured ≥ minForDeny` sobre una muestra etiquetada por humanos (§16).
6. El `fixHint` **nunca propone identificadores concretos**. Pide que el nombre salga del glosario o del dominio del archivo.
7. `source.paraphrase`: máximo 300 caracteres, cero citas entre comillas y revisión humana. No hay comparación automática contra el texto de los libros, porque procesar los libros completos sería en sí un problema de copyright.
8. **Satisfacibilidad.** Para cada combinación de reglas de una misma dimensión con los umbrales por defecto y los sugeridos en `pairs.json`, hay al menos una fixture `pass` que las cumple todas a la vez. El compilador emite un warning, y lo registra en el lock, cuando el usuario fija umbrales fuera de las combinaciones probadas.
9. **Ninguna fuente carga reglas sin prueba (U2).** `pregate preset compile` rechaza todo check de una fuente que no sea `builtin` si no trae en su `provenance` un hash de reporte del juez que coincida con hash del contenido + versión del corpus + versión del motor. En el MVP, sin el juez completo, el compilador corre `rules test` (fixtures + determinismo) sobre la fuente `path` y falla si algo no pasa. Una regla escrita "a mano" sigue el mismo camino.

### 5.5 Backlog de candidatas (ex nivel C)

*(U3, decidida.)* Las prácticas que hoy requieren juicio humano no entran al catálogo de invariantes. Viven en un **backlog de candidatas**, también en JSON:

```jsonc
// backlog/naming/intention-revealing-names.json
{
  "$schema": "https://<dominio-a-definir>/schema/candidate.v1.json",
  "id": "core/candidate/naming/intention-revealing-names",
  "practice": "Names reveal the responsibility and the intended use of the symbol.",
  "sources": [ { "work": "Clean Code (R. C. Martin, 2008)", "locator": "cap. 2" },
               { "work": "A Philosophy of Software Design, 2.ª ed. (J. Ousterhout, 2021)", "locator": "cap. 14" } ],
  "whyNotBinary": "Without project vocabulary, any lexical check is satisfiable by renaming without improving structure.",
  "unlockedBy": ["glossary"],                // conocimiento del preset que permitiría una versión binaria
  "partialInvariants": ["DDD-UL-001"],       // invariantes ya admitidas que cubren una parte
  "status": "candidate"                      // candidate | forging | admitted | rejected
}
```

- El backlog es la lista de trabajo del Forge: cuando el preset aporta `glossary`, `layers` o `markers`, `pregate forge suggest` [v1] lista las candidatas que se podrían intentar volver binarias.
- Una candidata solo pasa al catálogo como check nuevo admitido por el juez. Nunca se activa "en modo aviso" mientras sigue siendo de juicio.
- Ejemplos de candidatas: "la función hace una sola cosa", "la frontera tiene un propósito real", "el comentario no describe la implementación", "el patrón resuelve una variación real". Ejemplos de candidatas que el preset desbloquea: lenguaje ubicuo (con `glossary`), "solo los adapters hablan con la base" (con `layers`), "los value objects son inmutables" (con `markers`).
- También van al backlog las reglas que **parecen** binarias pero que el corpus de trampas demuestra ganables: por ejemplo, una lista de "palabras ruido" en nombres se satisface renombrando `data` a `payload` sin mejorar nada.
- Y las que hoy se leen como juicio aunque tengan nombre de regla: Feature Envy, "un `*Factory` cumple la forma del patrón", "modelo anémico". Viven como candidatas con su `unlockedBy` (por ejemplo `markers`) hasta que el Forge demuestre una versión binaria.
- Una regla admitida cuya precisión o corrección beneficiosa medida no alcanza el umbral (§16.1) vuelve acá con `status: "forging"`.

### 5.6 Fingerprints [v1]

```
fingerprint = ruleId | rutaRelativa | symbolPath | discriminador
  symbolPath:    "InvoiceService.calculateTotals"
  discriminador: si el símbolo es anónimo, padre + ordinal + hash del cuerpo normalizado
  valor:         la métrica medida (p. ej. 64 líneas), si la regla es métrica
emparejamiento before↔after: 1) symbolPath  2) hash del AST normalizado (sin identificadores
  ni trivia) o similitud ≥ 0,8, dentro del archivo y contra archivos borrados en la sesión
```

- Un fingerprint no depende del número de línea.
- **Un renombre no crea una violación nueva**: el símbolo se empareja por cuerpo.
- Los **contadores de reintento no usan fingerprints** (§11.3), porque renombrar no debe resetearlos.

---

## 6. Layout de reglas en disco y fuentes

### 6.1 Principios (U1, U5)

1. **Las reglas son JSON, no prosa.** Nadie escribe reglas en markdown. Cada archivo tiene `$schema` para autocompletado y validación en el editor.
2. **La unidad es una carpeta por check canónico**, con su prueba adentro. La regla viaja con sus fixtures.
3. **Agrupación por área, no por metodología.** Un check puede pertenecer a varias metodologías; las metodologías son manifiestos que lo referencian.
4. **Fuentes en capas, declaradas en el preset**, con versiones fijadas.
5. **IDs con namespace y sin sombreado silencioso.**
6. **Editar una regla es publicar una versión nueva** que sigue pasando todas sus fixtures anteriores.
7. **Toda carpeta de reglas declarada está protegida** contra escritura del agente.

### 6.2 Estructura de una fuente

Toda fuente (el catálogo built-in, un pack compartido o las reglas locales del repo) tiene la misma forma:

```
<fuente>/
├─ source.json                         namespace, versión, versión mínima del motor
├─ checks/
│  ├─ dependencies/
│  │  ├─ layer-direction/
│  │  │  ├─ check.json
│  │  │  └─ fixtures/
│  │  │     ├─ pass/<caso>/fixture.json + files/…
│  │  │     ├─ fail/<caso>/fixture.json + files/…
│  │  │     └─ trap/<caso>/fixture.json + files/…
│  │  └─ banned-imports/…
│  ├─ complexity/fn-max-lines/…
│  ├─ api-surface/…   errors/…   testing/…   naming/…
│  ├─ immutability/…  types/…    config/…    resilience/…
│  ├─ integrity/…                       (solo core: pack siempre activo)
│  └─ idiom-ts/…                        (idiomáticas de un language pack)
├─ methodologies/
│  ├─ clean-code.json                   manifiesto: aliases → checks, stances, requires, incompatibleWith,
│  │                                    conflicts[] (conflictos conocidos: SOLO sugerencias)
│  ├─ clean-code/aliases/<ALIAS>/fixtures/{pass,fail}/   (opcional) fixtures del alias con sus defaults
│  └─ …
├─ presets/<nombre>.json                presets publicados (heredables con `extends: ["preset:<ns>/<nombre>"]`)
├─ backlog/<área>/<candidata>.json      (solo core y packs que lo publiquen)
├─ pairs.json                           (solo core) conflictos conocidos entre metodologías de core
│                                       y resoluciones SUGERIDAS
├─ dimensions.v1.json                   (solo core) enum cerrado de dimensiones y posturas
└─ corpus/<familia>/<transformación>.json   (solo core) corpus estándar de trampas
```

Áreas iniciales: `dependencies`, `complexity`, `api-surface`, `errors`, `testing`, `naming`, `immutability`, `types`, `config`, `resilience`, `persistence`, `comments`, `duplication`, `structure` (clases y módulos), `integrity`, y `idiom-<lenguaje>` para las idiomáticas. Agregar un área es un cambio menor del schema. `presets` y `candidate` son palabras reservadas: no pueden ser nombres de área.

**Archivos de fixture no ejecutables.** Las fixtures `fail` y `trap` contienen, a propósito, código que viola reglas (por ejemplo un `*.spec.ts` con `.only`, que enfocaría toda la suite). Por eso se guardan con sufijo no ejecutable (`files/src/x.spec.ts.fixture`) y el loader las mapea al nombre real en memoria. Además, `.pregate/**` queda siempre fuera del scope de evaluación, sin depender del preset, y `pregate install` agrega `.pregate/` a los excludes de tsconfig, ESLint y del test runner.

### 6.3 `check.json` y el checker

`check.json` es el de §5.4. El campo `impl.kind` define cómo se verifica, en este orden de preferencia:

1. **`primitive`**: una primitiva built-in parametrizada. Ejemplos: `metric` (umbral sobre una métrica de la IR), `banned-import` (lista de módulos o paquetes por capa), `layer-edge` (dirección de dependencias entre capas del preset), `graph` (ciclos, fan-out, callers), `diff` (no-decrecimiento entre `before` y `after`), `surface` (exports y visibilidad).
2. **`pattern`**: una regla ast-grep o una query tree-sitter, **embebida en JSON** dentro de `check.json`, una por lenguaje (`impl.patterns.typescript`, `impl.patterns.python`, …).
3. **`custom`**: un módulo `checker.*` en la carpeta del check, solo si no alcanza ni una primitiva ni un patrón. Exige el campo `customJustification` (lo revisa el humano al promover) y corre en un **sandbox determinista**: recibe la IR y el AST del core, devuelve violaciones, y no tiene acceso a sistema de archivos, red, reloj, azar ni entorno (tecnología del sandbox a decidir en el spike de v1: WASM o un intérprete JS aislado). [v1]

### 6.4 Fixtures

Cada fixture es una carpeta con un `fixture.json` y los archivos que necesita (un mini-proyecto cuando la regla mira imports o capas):

```jsonc
// checks/dependencies/banned-imports/fixtures/trap/require-variable/fixture.json
{
  "$schema": "https://<dominio-a-definir>/schema/fixture.v1.json",
  "language": "typescript",
  "params": { "paths": ["src/domain/**"], "packages": ["@prisma/client"] },
  "context": {                                  // fragmento de preset que la fixture necesita
    "layers": { "entities": { "paths": ["src/domain/**"], "mayImport": [], "kind": "core" } }
  },
  "target": "src/domain/invoice.ts",            // archivo evaluado, dentro de files/
  "before": null,                               // o "before/" para checks de diff y ratchet
  "expect": { "verdict": "fail", "violations": [ { "line": 2 } ] },
  "trap": {
    "family": "dynamic-import",                 // familia del corpus
    "origin": "real",                           // real | corpus | forge
    "discovered": "2026-10-01",
    "note": "Agent replaced a static import with require(name) after a deny."
  }
}
```

- `pass`: cumple la regla con los `params` declarados.
- `fail`: viola la regla; `expect.violations` fija líneas y, opcionalmente, valores medidos.
- `trap`: **cumple la letra y rompe el espíritu**. La regla tiene que fallar igual. Una trampa real descubierta en uso (por ejemplo en modo sombra, en un Stop o en CI) **se agrega como fixture `trap/` con `origin: "real"`, y la regla tiene que endurecerse para rechazarla** en su próxima versión.
- Las fixtures declaran sus propios `params`, así que un mismo check se prueba con los defaults de cada alias que lo usa. El CI exige, por cada alias, al menos una fixture `pass` y una `fail` con esos defaults. Si el alias vive en otra fuente que el check (por ejemplo un alias `amarilla/` sobre un check de `core/`), esas fixtures van junto al manifiesto (`methodologies/<id>/aliases/<ALIAS>/fixtures/`), porque la carpeta del check pertenece a otra fuente y está protegida.

### 6.5 Fuentes en capas, namespaces y overrides

El preset declara de dónde salen las reglas y fija versiones exactas:

```jsonc
"engine": "1.0.0",                                                                    // versión exacta del motor
"sources": [
  { "ns": "core",  "kind": "builtin", "version": "1.0.0" },                         // embebida en el binario
  { "ns": "acme",  "kind": "git",  "url": "https://git.acme.dev/pregate-rules.git", "ref": "v2.1.0" },  // [v1]
  { "ns": "fintech", "kind": "npm", "package": "@acme/pregate-fintech", "version": "0.4.2" },       // [v1]
  { "ns": "amarilla", "kind": "path", "path": ".pregate/packs/amarilla" },           // [MVP] pack del piloto (U8)
  { "ns": "local", "kind": "path", "path": ".pregate/rules" }                          // [MVP]
]
```

- **Orden de capas:** built-in → packs compartidos (path, git, npm) → reglas locales del repo. El orden sirve para listar y explicar, **no para resolver choques**.
- **Versión de `core` y del motor.** El binario embebe una versión de `core`. Si `engine` o la versión de `core` fijadas en el preset no coinciden con las del binario instalado, el hook aplica `failMode` y `check` (pre-commit/CI) sale con exit ≠ 0 con "engine/core version mismatch". Nunca se usa en silencio la versión embebida (U10: mismo binario, mismo lock).
- **Namespaces e IDs.** Cada fuente es dueña de un namespace (`core/`, `<pack>/`, `local/`), y el `ns` declarado en el preset tiene que ser igual al de su `source.json`, o la compilación falla. Gramática de IDs:
  - check: `<ns>/<área>/<check>` (tres segmentos, área en minúsculas; `presets` y `candidate` reservadas);
  - manifiesto de metodología: `<ns>/<metodología>` (dos segmentos, minúsculas);
  - alias: `<ns>/<ALIAS>` (dos segmentos, mayúsculas y guiones, p. ej. `core/CC-FN-002`);
  - candidata: `<ns>/candidate/<área>/<nombre>`;
  - preset publicado: `preset:<ns>/<nombre>` (solo en `extends`).

  Un alias se puede escribir en forma corta (`CC-FN-002`) mientras no sea ambiguo; si lo es, el compilador falla y pide el FQN.
- **Sin sombreado silencioso.** Una fuente no puede declarar IDs en el namespace de otra. Dos fuentes con el mismo namespace son un error de compilación. Para cambiar una regla de otra fuente hay dos caminos, ambos explícitos:
  - `overrides` en el preset (parámetros, severidad, scope), que quedan en el lock con su origen (§8);
  - un check nuevo con ID propio y `derivedFrom: "core/complexity/fn-max-lines@1.2.0"`, que pasa por el juez como cualquier otro.
- **Fijación de versiones.** El preset fija versiones exactas, sin rangos, y el lock registra el hash de cada fuente. Otro agente u otra sesión ven exactamente las mismas reglas. `pregate sources update` [v1] muestra qué veredictos cambiarían sobre el repo antes de actualizar.
- **Prueba obligatoria.** Toda fuente que no sea `builtin` pasa por §5.4 regla 9 al compilar: sin reporte del juez (v1) o sin `rules test` en verde (MVP), sus checks no cargan. Un hash verificado garantiza integridad, no prueba.
- **MVP:** fuentes `builtin` y `path` (reglas locales y el pack `amarilla/`, solo con `primitive` y `pattern`). `git`, `npm` y checkers `custom` llegan en v1.

### 6.6 Versionado y regresión

- Cada `check.json` y cada manifiesto tiene `version` en semver.
- **Mejorar o editar una regla es una versión nueva.** Todas las fixtures existentes tienen que seguir pasando (regresión). Las fixtures son *append-only*: quitar una exige versión mayor y aprobación humana explícita en el registro de cambios del check.
- **Endurecer** (una trampa nueva pasa a rechazarse) es versión menor. **Cambiar un default** de un alias es versión menor del manifiesto y aparece en `pregate sources update`. **Cambiar el significado de un parámetro** es versión mayor.
- Debilitar una regla sin quitar fixtures es imposible por construcción: alguna fixture `fail` o `trap` pasaría a `pass` y la regresión falla.

### 6.7 Protección

- El hook protege `**/.pregate/**` **a cualquier profundidad** (un `.pregate/` anidado escrito por el agente secuestraría la raíz de todo lo que cuelga de él), **toda carpeta de reglas declarada** en `sources` con `kind: "path"` aunque esté fuera de `.pregate/`, y el directorio de datos de PREGATE (estado y snapshots, §11.3).
- En volúmenes que no distinguen mayúsculas (APFS por defecto), las rutas protegidas se comparan sin distinguirlas: `.Pregate/preset.json` o `.Claude/settings.json` no esquivan la protección.
- `preset.json` es **siempre `deny`** para el agente, sin `ask` (§8.6).
- Las fuentes `git` y `npm` se materializan en el directorio de datos de PREGATE, fuera del repo, verificadas por hash (integridad) y por reporte del juez (prueba).
- Únicas excepciones de escritura para el agente:
  - `.pregate/requests/**`: solicitudes en JSON validado por schema; nunca se cargan como configuración (§10.3);
  - `.pregate/forge/drafts/**`: **solo a través de las tools del MCP del Forge**, nunca con las herramientas de edición del harness (§12.3). Los borradores nunca son una fuente de reglas.

---

## 7. Catálogo de checks y metodologías

### 7.1 Manifiestos de metodología

Las fuentes están parafraseadas. Los totales son entradas de catálogo estimadas **A / B**, más las candidatas que quedan en el backlog. Son estimaciones previas al Forge: algunas reglas no van a pasar el corpus de trampas y van a bajar al backlog.

| Metodología (manifiesto) | Fuente | Invariantes estimadas (A/B) + candidatas | Estado v1 | Ejemplos |
|---|---|---|---|---|
| `core/pregate-integrity` | Propio (anti-evasión) | ~10 (A/diff) | **Siempre activo** | EVA-GEN-001 marcador de generado nuevo · EVA-GEN-002 el agente edita un archivo generado o excluido que ya existía · EVA-SUP-001 supresión inline nueva · EVA-DYN-001 import dinámico en una capa · EVA-CAST-001 doble aserción `as unknown as` · EVA-SCOPE-001 archivo nuevo en `exclude`, o archivo (nuevo o existente) de un lenguaje sin language pack dentro de una capa declarada · EVA-SCOPE-002 archivo que cae en dos scopes incompatibles · EVA-TEST-001 menos aserciones o matchers más débiles en la sesión · EVA-FORGE-001 código que importa desde los borradores del Forge |
| `core/clean-code` | Martin, *Clean Code* (2008) | ~35 (30/5) + 10 | **Completo** | CC-FN-001 función ≤ N líneas · CC-FN-002 ≤ N parámetros · CC-FN-003 sin flags booleanos en API pública · CC-ER-002 sin `catch` vacío ni que solo loguea · CC-OB-001 Deméter con `fluentAllow` · CC-G-001 sin números mágicos |
| `core/clean-architecture` | Martin, *Clean Architecture* (2017) | ~17 (6/11) + 3 | **Completo** | CA-DEP-001 un anillo interno no importa uno externo · CA-DEP-002 sin framework ni ORM en entities o usecases · CA-ENT-001 entidades sin anotaciones de persistencia · CA-UC-001 caso de uso con un solo método público |
| `core/ddd-tactical` | Evans (2003); Vernon, *Implementing DDD* (2013) | ~15 (8/7) + 5 | **Completo** | DDD-VO-001 value objects inmutables · DDD-ENT-001 sin setters públicos · DDD-AGG-001 referencia entre agregados solo por ID · DDD-UL-001 sinónimos prohibidos según el glosario |
| `core/tdd` | Beck, *TDD by Example* (2002); *Test Desiderata* (2019) | ~15 (10/5) + 3 | **Completo** | TDD-DEL-001 aserciones que no bajan (`ask`) · TDD-FOCUS-001 sin `.only` ni `.skip` · TDD-ASSERT-001 cada test tiene aserción · TDD-DET-001 tests deterministas |
| `core/philosophy-of-software-design` | Ousterhout, *APoSD*, 2.ª ed. (2021) | ~14 (8/6) + 11 | Preview (`warn`) | APOSD-PT-001 sin pass-through · APOSD-DEEP-001 profundidad/superficie ≥ R · APOSD-CONJ-001 contrapeso anti-fragmentación · APOSD-CMT-001 comentario de interfaz en exports |
| `core/functional-core-imperative-shell` | Bernhardt, *Boundaries* (2012); Normand, *Grokking Simplicity* (2021) | ~13 (11/2) + 1 | Preview; **FCIS-IO-001/002 completas (`deny`)** | FCIS-IO-001 el core no importa módulos con efectos · FCIS-IO-002 sin reloj, random ni env en el core · FCIS-ASYNC-001 el core no es async · FCIS-PURE-001 sin mutar argumentos |
| `core/ddd-strategic` | Evans, cap. 14 | ~7 (4/3) + 3 | Preview | DDD-BC-001 sin acceso a internals de otro contexto · DDD-ACL-001 sin tipos de SDK externos en el dominio |
| `core/solid` | Martin, *Agile Software Development: PPP* (2002), cap. 8–12; Liskov y Wing (1994) | ~12 (7/5) + 3 | Preview | SOLID-OCP-001 `switch` sobre tag de tipo fuera de factorías · SOLID-LSP-001 override "no implementado" · SOLID-ISP-001 interfaz ≤ N métodos |
| `core/refactoring-smells` | Fowler, *Refactoring*, 2.ª ed. (2018), cap. 3 | ~27 (18/9) + 8 | Preview | RF-SM-002 clones (regla de tres) · RF-SM-017 Middle Man · RF-SM-014 interfaz o clase abstracta exportada sin implementaciones ni usos en el proyecto (exime puertos). Feature Envy queda como candidata |
| `core/effective-typescript` | Vanderkam, 2.ª ed. (2024), por capítulo | ~29 (26/3) + 6 | Preview | ETS-ANY-001 sin `any` sin justificar · ETS-TS-001 sin `@ts-ignore` · ETS-EXH-001 `switch` exhaustivo · ETS-CFG-001 no apagar `strict` |
| `core/hexagonal` | Cockburn (2005); Cockburn y Garrido de Paz (2024) | ~11 (3/8) + 1 | Preview | HEX-CORE-001 el núcleo no importa adapters · HEX-PORT-003 puertos sin nombre de tecnología · HEX-ADP-002 sin llamadas entre adapters |
| `core/pragmatic-programmer` | Thomas y Hunt, 20.º aniv. (2019) | ~20 (13/7) + 10 | v1.1 | PP-DRY-001 un literal regex o una constante idéntica aparece ≥ 2 veces en el módulo · PP-RES-001 quien abre un recurso lo cierra · PP-SEC-001 sin secretos |
| `core/poeaa-*` (domain-model, transaction-script, active-record; excluyentes por scope) | Fowler, *PoEAA* (2002) | ~23 (15/8) + 7 | v2 | PEAA-SL-001 controladores sin ORM · PEAA-LL-001 sin llamada a repositorio u ORM dentro de un loop · PEAA-QRY-001 sin SQL concatenado · PEAA-MNY-001 sin `float` para dinero |
| `core/gof` | Gamma et al., *Design Patterns* (1994) | ~30 (20/10) + 5 | v2 | GOF-P-002 profundidad de herencia ≤ 2 · GOF-OBS-001 cada `subscribe` tiene su baja. "Un `*Factory` cumple la forma del patrón" queda como candidata |
| `core/code-complete` | McConnell, 2.ª ed. (2004) | ~50 (45/5) + 10 | v2 | CC2-CPX-001 ciclomática ≤ 10 · CC2-VAR-001 declaración cerca del uso · CC2-DATA-001 sin igualdad exacta entre flotantes |
| `core/legacy-code` | Feathers, *WELC* (2004) | ~14 (8/6) + 1; más **modo** que reglas | v1 (como opciones de ratchet) | WELC-SPROUT-001 un método legado grande crece ≤ N líneas · WELC-SEAM-001 constructores sin I/O |
| `core/twelve-factor` | Wiggins, 12factor.net (2011) | ~17 (12/5) + 1 | v2 | TF-III-001 sin hosts ni credenciales literales · TF-III-003 env solo en config · TF-XI-001 logs a stdout |
| `core/release-it` | Nygard, 2.ª ed. (2018) | ~18 (13/5) + 4 | v2 | RI-TO-001 timeout en llamadas salientes · RI-RETRY-001 reintentos acotados · RI-UNB-001 consultas con LIMIT |
| `core/effective-java` | Bloch, 3.ª ed. (2018) | ~42 (38/4) + 3 | v2 (delegando a Error Prone o PMD) | EJ-009 try-with-resources · EJ-011 equals implica hashCode |
| **Total** | | **≈ 409 entradas (≈ 295 A, ≈ 114 B) sin contar `pregate-integrity`, sobre ≈ 265 checks canónicos, + ≈ 95 candidatas en backlog** | | |

**Candidatos v2:** Object Calisthenics (Bay, 2008); las 4 reglas del diseño simple y *Tidy First?* (Beck); "Parse, don't validate" (King, 2019); *Domain Modeling Made Functional* (Wlaschin, 2018); OWASP ASVS como pack transversal; idiomáticas de Python, Go y Rust en sus language packs.

**Forma de un manifiesto** (resumen; los aliases tienen la forma de §5.4):

```jsonc
{
  "$schema": "https://<dominio-a-definir>/schema/methodology.v1.json",
  "id": "core/clean-code",
  "version": "1.0.0",
  "status": "complete",                       // complete | preview
  "source": { "work": "Clean Code (R. C. Martin, 2008)" },
  "stances": { "comments.policy": "minimal" }, // posturas a nivel de metodología
  "requires": [],                              // conocimiento del preset: layers | glossary | markers
  "incompatibleWith": [],                      // incompatibilidades duras (por archivo)
  "conflicts": [                               // conflictos conocidos: SOLO sugerencias, nunca resoluciones
    { "with": "core/philosophy-of-software-design", "dimension": "comments.policy",
      "suggest": { "use": "core/philosophy-of-software-design" }, "why": "string corto" }
  ],
  "invariants": [ /* aliases → checks */ ],
  "candidates": ["core/candidate/naming/intention-revealing-names"]
}
```

### 7.2 Checks por área (muestra)

| Área | Checks canónicos de ejemplo | Aliases que los usan |
|---|---|---|
| `dependencies` | `layer-direction`, `banned-imports`, `no-cycles` (B-global), `no-dynamic-import-in-layer` | CA-DEP-001, CA-DEP-002, HEX-CORE-001, FCIS-IO-001, DDD-ACL-001, EVA-DYN-001 |
| `complexity` | `fn-max-lines`, `fn-max-params`, `fn-max-nesting`, `fn-max-cyclomatic`, `fn-no-growth` (diff) | CC-FN-001/002/004, RF-SM-003/004, CC2-RT-001/002, CC2-CPX-001, WELC-MONSTER-001 |
| `api-surface` | `single-public-method`, `no-boolean-flag-param`, `interface-max-methods`, `exported-doc-comment`, `module-depth-ratio` | CA-UC-001, CC-FN-003, SOLID-ISP-001, APOSD-CMT-001, APOSD-DEEP-001 |
| `errors` | `no-empty-catch`, `no-log-and-continue`, `no-null-return-public`, `error-style` | CC-ER-001/002, PP-CRASH-001, RI-CATCH-001, FCIS-EXC-001 |
| `testing` | `no-focused-tests`, `assertions-no-decrease` (diff), `test-has-assertion`, `deterministic-tests` | TDD-FOCUS-001, TDD-DEL-001, TDD-ASSERT-001, TDD-DET-001, EVA-TEST-001 |
| `naming` | `glossary-synonyms`, `port-name-no-technology` | DDD-UL-001, HEX-PORT-003 |
| `immutability` | `readonly-fields-by-marker`, `no-public-setters-by-marker`, `no-arg-mutation` | DDD-VO-001, DDD-ENT-001, FCIS-PURE-001 |
| `integrity` | `new-generated-marker`, `edit-generated-or-excluded`, `new-inline-suppression`, `double-type-assertion`, `new-file-in-excluded-scope`, `incompatible-scope`, `no-import-from-forge-drafts` | EVA-* |

### 7.3 Honestidad sobre el volumen

- **Lo que bloquea** con buena precisión en v1: entre 60 y 120 reglas deterministas en TS, que vienen de los 4 manifiestos completos más la integridad.
- Las ~95 candidatas **no bloquean, no avisan y nunca se exportan**: son la lista de trabajo del Forge. PREGATE no genera CLAUDE.md, AGENTS.md ni ninguna guía en prosa (U1, U10): el contexto previo llega al agente por SessionStart y por la tool MCP `get_preset_summary`, siempre derivado del lock.
- **Costo de escritura del catálogo.** Un check `deny` lleva redacción del alias, fixtures `pass`/`fail`/`trap`, paso por el corpus de trampas y etiquetado de precisión. Estimación: entre **4 y 8 h por regla**, es decir unas 400 a 900 h para v1. El Forge reduce el costo de las reglas locales, no el del catálogo curado. Quién escribe el catálogo es una pregunta abierta (§19).

---

## 8. Presets JSON

### 8.1 Artefactos

| Archivo | Quién lo escribe | Propósito |
|---|---|---|
| `.pregate/preset.json` (o `.jsonc`) | **solo el humano**: a mano, o con `pregate preset apply <solicitud>` / `pregate forge promote --activate` desde la CLI. Para el agente es siempre `deny` | Motor y fuentes con versiones, metodologías elegidas, resoluciones de conflictos, overrides, capas, scopes y convivencia. Se versiona y viaja con el proyecto |
| `.pregate/requests/preset-<ts>.json` | el agente (o el skill `/pregate:init`) | Propuesta de cambio al preset como JSON-patch validado por schema. No cambia nada hasta que el humano la aplica |
| `.pregate/pregate.lock.json` [MVP] | `pregate preset compile` (lo corre el humano; `preset apply` también compila) | Regla efectiva por (check, scope, instancia): parámetros, severidad, fase, `aliases[]`, procedencia (fuente@versión y hash, obra, capítulo) y **cómo se resolvió cada conflicto** (qué entrada del preset lo decidió). Incluye `presetHash`, `sourcesHash` y `engineVersion`, y `confirmedBy` por cada resolución heredada. **El hook, pre-commit y CI leen el mismo lock** |
| `.pregate/rules/**` | el humano (a mano o promoviendo un borrador del Forge); en ambos casos tiene que pasar `rules test` al compilar (§5.4, regla 9) | Fuente `local`: checks, fixtures y manifiestos propios del repo (§6) |
| `pairs.json` (fuente `core`) | el catálogo | Conflictos conocidos entre metodologías y **resoluciones sugeridas**. Solo sugiere; nunca resuelve |
| `dimensions.v1.json` (fuente `core`) | el catálogo | Enum cerrado de dimensiones y posturas válidas |

En el MVP las fuentes `core` vienen embebidas en el binario y **el lock se escribe en disco desde el MVP**, porque U10 exige el mismo lock en el hook, en pre-commit y en CI.

### 8.2 Selección de metodologías (experiencia del usuario) [v1, parcial en MVP]

1. **Ficha por metodología** (`pregate packs`, `pregate packs show ddd-tactical`):
   - qué impide, con 3 fixtures `fail` como ejemplo;
   - cuántas invariantes bloquean y cuántas avisan;
   - con qué metodologías choca (dimensiones en conflicto) y con cuáles es incompatible;
   - qué requiere del preset (`layers`, `glossary`, `markers`);
   - estado (completo o preview) y candidatas asociadas en el backlog.
2. **Presets curados** con nombre, como punto de partida. En el MVP hay tres archivos de ejemplo: `backend-clean-ddd`, `functional-ts` y `legacy-safe`; `minimal-strict` llega en v1. Traen resoluciones **propuestas**, no confirmadas: al adoptar un preset curado o heredarlo por `extends`, `init` muestra cada resolución heredada y pide confirmarla, y el lock registra `confirmedBy` por conflicto. Hasta confirmar, no compila.
3. **Vista previa del impacto:** `pregate preview --preset X` responde "con este preset, hoy habría N bloqueos en M archivos; las 3 reglas que más bloquean son…".
4. **Lectura humana del contrato** [MVP]: `pregate preset show` responde "con este preset, la IA no podrá: …", agrupado por metodología y por ruta, e incluye "estas invariantes NO se aplican a archivos de los lenguajes X porque no hay language pack", "esta metodología hoy no bloquea N de M invariantes (preview)" y, con `enforcement: shadow`, "este preset NO bloquea nada".
5. **Desde la conversación:** el plugin incluye `/pregate:init` (skill), que hace las preguntas dentro del harness y deja una **propuesta** en `.pregate/requests/preset-<ts>.json`. El humano la aplica con `pregate preset apply <solicitud>`. También hay `pregate init` con flags para uso no interactivo, que corre el humano.
6. **Conflictos durante `init`:** por cada conflicto entre las metodologías elegidas, `init` muestra las dos posturas, la sugerencia de `pairs.json` y su porqué, y **el humano confirma o elige otra** antes de escribirla en `resolve`. No hay resolución por defecto aplicada en silencio.
7. `init` lee `eslint.config.*` y `tsconfig` y avisa si hay umbrales en conflicto (por ejemplo, `max-params: 5` en ESLint contra 3 en el preset). Ofrece adoptarlos como override.

### 8.3 Schema del preset (v1)

```jsonc
{
  "$schema": "https://<dominio-a-definir>/schema/preset.v1.json",
  "name": "string",                                 // requerido
  "version": "semver",                              // versión del preset del equipo
  "engine": "x.y.z",                                // versión exacta del motor; distinta ⇒ failMode / exit ≠ 0

  // Fuentes de reglas (§6.5): versiones exactas, sin rangos
  "sources": [ { "ns": "core", "kind": "builtin", "version": "1.0.0" },
               { "ns": "local", "kind": "path", "path": ".pregate/rules" } ],

  // Herencia de presets (no de metodologías). El hijo pisa al padre clave por clave
  "extends": ["./presets/acme-base.json"],         // o "preset:<ns>/<nombre>"

  // Elección del usuario: metodologías. Combinar es UNIÓN; el orden no importa
  "methodologies": ["core/clean-architecture", "core/ddd-tactical"],

  "languages": ["typescript", "javascript"],        // si falta, se infiere
  "scope": { "include": ["glob"], "exclude": ["glob"] },
  "generatedMarkers": ["@generated", "DO NOT EDIT"],

  // Modo global
  "enforcement": "enforce | shadow | advise",       // default: enforce. shadow y advise son modos explícitos
                                                    // de calibración; no afectan a core/pregate-integrity

  // Conocimiento del proyecto (vuelve verificables invariantes y candidatas)
  "layers": {
    "<capa>": { "paths": ["glob"], "mayImport": ["<capa>" | "*"], "kind": "core|port|adapter|main" }
  },
  "importPolicy": { "typeOnlyCountsAsEdge": true, "followReExports": 3, "denyDynamicInCore": true },
  "contexts": { "<bounded-context>": { "paths": ["glob"], "publicApi": ["glob"] } },
  "markers": {
    "valueObject":   { "suffix": ["Id", "Money"], "paths": ["glob"] },
    "entity":        { "paths": ["glob"] },
    "aggregateRoot": { "decorator": ["@AggregateRoot"] },
    "port":          { "paths": ["glob"] }
  },
  "glossary": "docs/ubiquitous-language.json",

  // Composición: TODO conflicto se resuelve acá o el preset no compila
  "resolve": {                                      // incluye errors.style (no hay otro campo para eso)
    "<dimension>": { "use": "<metodología | alias>", "params": {}, "severity": "...", "note": "string corto" }
                 | { "policy": "strictest | lenient", "note": "string corto" }   // solo umbrales
  },
  "overrides": {                                    // solo sobre invariantes de metodologías activas
    "<aliasId | checkId>": "off | warn | ask | deny"
                         | { "severity": "...", "params": {}, "note": "string corto" }
  },
  "severityCeiling": { "heuristic": "warn" },       // un override que lo supera es ERROR de compilación
  "allowHeuristicDeny": false,
  "scopes": [ { "paths": ["glob"], "methodologies": ["<id>"], "resolve": {}, "overrides": {} } ],

  // Legado
  "ratchet": { "mode": "strict | no-new | no-worse | boy-scout", "newFiles": "strict",
               "tolerance": { "core/complexity/fn-max-lines": 0 }, "lockImprovements": false,
               "baseline": ".pregate/baseline.json" },

  // Bucle con la IA
  "loop": { "maxDenialsPerFileRule": 3, "maxDenialsPerTurn": 15, "noProgressLimit": 2,
            "maxStopBlocks": 2, "escalate": "stop | ask", "allowAsk": true,
            "maxDetailedViolations": 5, "showAttemptMax": false,
            "agentMessageLanguage": "en", "userMessageLanguage": "es" },

  // Convivencia con ArkGate (U9, U10; §15.0): un mismo invariante lo hace cumplir UNA sola herramienta
  "coexist": { "arkgate": { "config": "ark.config.json",
                            "ownedByArkgate": ["<aliasId | checkId>"],   // PREGATE no las evalúa; quedan en el lock
                            "note": "string corto" } },

  // Robustez, harnesses y anti-bypass
  "failMode": "closed | ask",                       // default: closed (U10). ask es opt-in y solo aplica
                                                    // donde ask es confiable; si no, closed
  "harnesses": { "unrecognizedPayload": "fail-mode", "minVersions": { "copilot-cli": "1.0.70" } },
  "bash": { "guard": true, "diffCheck": true, "onWrite": "flag | revert" },
  "protectedPaths": ["**/.claude/settings*.json", "~/.claude/settings*.json", "~/.claude/plugins/**",
                     "**/.pregate/**", ".git/hooks/**", ".github/workflows/**",
                     ".codex/config.toml", "~/.codex/config.toml"],
                     // + carpetas de reglas declaradas, directorio de datos de PREGATE y archivos de
                     //   config de cada harness instalado (automático); comparación sin distinguir
                     //   mayúsculas en volúmenes que no distinguen
  "suppressions": { "inlineAllowed": false, "exceptionsFile": ".pregate/exceptions.json",
                    "requireExpires": false }
}
```

**Subconjunto MVP:** `name`, `engine`, `sources` (`builtin` + `path`), `methodologies`, `scope`, `enforcement`, `layers`, `resolve` (conflictos de umbral o severidad del mismo check), `overrides` (incluidos parámetros de ruta como `paths` y `packages`), `coexist.arkgate.ownedByArkgate`, `ratchet.mode` (`no-new` por conteo + símbolos nuevos), `loop` (contadores y `escalate`) y `failMode`.
- Sin `extends`, `scopes`, `markers` ni `glossary`.
- Las invariantes del MVP no tienen posturas opuestas entre sí, pero el compilador del MVP ya falla ante cualquier conflicto de umbral o severidad sin resolver (probado con un manifiesto local de fixture; UC7 completo en v1).

### 8.4 Ejemplos

**Ejemplo 1. Backend TS que combina Clean Code, Clean Architecture, DDD táctico, Effective TypeScript y Philosophy of Software Design** [v1].

```jsonc
{
  "$schema": "https://<dominio-a-definir>/schema/preset.v1.json",
  "name": "billing-backend",
  "version": "1.0.0",
  "engine": "1.0.0",
  "sources": [ { "ns": "core", "kind": "builtin", "version": "1.0.0" } ],
  "methodologies": [
    "core/clean-code",
    "core/effective-typescript",
    "core/clean-architecture",
    "core/ddd-tactical",
    "core/philosophy-of-software-design"
  ],
  "languages": ["typescript"],
  "enforcement": "enforce",
  "scope": { "include": ["src/**", "test/**"], "exclude": ["src/infra/migrations/**"] },
  "layers": {
    "entities": { "paths": ["src/domain/**"],               "mayImport": [],                                "kind": "core" },
    "usecases": { "paths": ["src/application/**"],          "mayImport": ["entities", "ports"],             "kind": "core" },
    "ports":    { "paths": ["src/application/ports/**"],    "mayImport": ["entities"],                      "kind": "port" },
    "adapters": { "paths": ["src/infra/**", "src/http/**"], "mayImport": ["entities", "usecases", "ports"], "kind": "adapter" },
    "main":     { "paths": ["src/main.ts"],                 "mayImport": ["*"],                             "kind": "main" }
  },
  "markers": {
    "valueObject":   { "paths": ["src/domain/**/values/**"] },
    "entity":        { "paths": ["src/domain/**/entities/**"] },
    "aggregateRoot": { "suffix": ["Aggregate"] }
  },
  "glossary": "docs/ubiquitous-language.json",     // habilita DDD-UL-001
  "resolve": {
    // Cada resolución es una sugerencia de pairs.json o de conflicts[], confirmada por el humano en init.
    // Conflicto: APoSD prohíbe pass-through; CA pide mapear en cada frontera.
    "module.pass-through": { "use": "APOSD-PT-001", "params": { "exemptAcrossLayers": true },
                             "note": "Prohibido dentro de una capa; permitido al cruzar una frontera declarada." },
    // Conflicto: CC pide funciones pequeñas; APoSD pide módulos profundos.
    "fn.size":             { "use": "CC-FN-001", "params": { "max": 40 },
                             "note": "Umbral moderado; contrapesos de APoSD en Stop." },
    // Conflicto: CC minimiza comentarios; APoSD exige comentario de interfaz en exports.
    "comments.policy":     { "use": "core/philosophy-of-software-design",
                             "note": "Doc en exports; CC-CM-001 (sin código comentado) sigue activa." }
  },
  "overrides": {
    "APOSD-CMT-001": "deny",                         // APoSD está en preview (warn); el equipo lo sube
    "ETS-ANY-001":   "deny"
  },
  "ratchet": { "mode": "no-worse", "newFiles": "strict" },
  "loop": { "escalate": "stop" },
  "failMode": "closed"
}
```

**Ejemplo 2. Monolito legado que hereda un preset corporativo, con todos los conflictos resueltos** [v2, por `code-complete` heredado].

```jsonc
{
  "name": "legacy-monolith",
  "version": "0.3.0",
  "engine": "1.0.0",
  "sources": [ { "ns": "core", "kind": "builtin", "version": "1.0.0" },
               { "ns": "acme", "kind": "git", "url": "https://git.acme.dev/pregate-rules.git", "ref": "v2.1.0" } ],
  "extends": ["preset:acme/base"],                  // acme/base activa code-complete y philosophy-of-software-design;
                                                    // sus resoluciones se confirmaron en init (confirmedBy en el lock)
  "methodologies": ["core/clean-code", "core/pragmatic-programmer", "core/tdd", "core/legacy-code"],
  "languages": ["typescript", "javascript"],
  "scope": { "include": ["app/**", "lib/**"], "exclude": ["vendor/**", "public/**"] },
  "resolve": {
    "fn.size":         { "use": "CC-FN-001", "params": { "max": 30 }, "note": "CC pide ~20, CC2 tolera 200; APoSD aporta contrapesos." },
    "fn.params":       { "use": "CC-FN-002", "params": { "max": 4 },  "note": "CC 3, CC2 7." },
    "fn.nesting":      { "policy": "strictest", "note": "CC 2 contra CC2 3: elegimos 2." },
    "literals.magic":  { "use": "CC-G-001" },
    "comments.policy": { "use": "core/philosophy-of-software-design", "note": "Doc en exports; CC-CM-001 (sin código comentado) sigue activa." }
  },
  "overrides": {
    "WELC-SPROUT-001": { "params": { "legacyMinLines": 80, "maxAdded": 5 } }
  },
  "scopes": [
    { "paths": ["test/**", "**/*.spec.ts"],
      "overrides": { "CC-G-001": "off", "core/complexity/fn-max-lines": { "params": { "max": 60 } } } }
  ],
  "ratchet": { "mode": "no-worse", "baseline": ".pregate/baseline.json" },
  "bash": { "guard": true, "diffCheck": true, "onWrite": "flag" }
}
```

**Ejemplo 3. Combinación por scope: Hexagonal en todo el repo, DDD en el dominio y FCIS en el motor de precios** [v2, por `release-it`].

```jsonc
{
  "name": "pricing-platform",
  "version": "2.1.0",
  "engine": "1.0.0",
  "sources": [ { "ns": "core", "kind": "builtin", "version": "1.0.0" } ],
  "methodologies": ["core/hexagonal", "core/clean-code", "core/philosophy-of-software-design", "core/release-it"],
  "resolve": {
    "fn.size":             { "use": "CC-FN-001", "params": { "max": 60 }, "note": "Tamaño moderado; contrapesos de APoSD en Stop." },
    "comments.policy":     { "use": "core/philosophy-of-software-design" },
    "module.pass-through": { "use": "APOSD-PT-001", "params": { "exemptAcrossLayers": true } }
  },
  "layers": {
    "core":     { "paths": ["src/core/**"],     "mayImport": [],       "kind": "core" },
    "adapters": { "paths": ["src/adapters/**"], "mayImport": ["core"], "kind": "adapter" },
    "config":   { "paths": ["src/config/**"],   "mayImport": ["*"],    "kind": "main" }
  },
  "scopes": [
    { "paths": ["src/core/domain/**"],  "methodologies": ["core/ddd-tactical"] },
    { "paths": ["src/core/pricing/**"], "methodologies": ["core/functional-core-imperative-shell"],
      "resolve": { "errors.style": { "use": "FCIS-EXC-001", "note": "En el core funcional, errores como valores." } } }
    // ddd-tactical (modelo rico) y FCIS (datos + funciones) son incompatibles en un MISMO archivo.
    // El compilador lo verifica contra la lista real de archivos: hoy no se solapan, así que compila.
  ]
}
```

**Ejemplo 4. Piloto amarilla-platform, conviviendo con ArkGate** [MVP; plantilla, las capas salen de `ark.config.json` en el piloto].

```jsonc
{
  "$schema": "https://<dominio-a-definir>/schema/preset.v1.json",
  "name": "amarilla-platform",
  "version": "0.1.0",
  "engine": "1.0.0",
  "sources": [ { "ns": "core",     "kind": "builtin", "version": "1.0.0" },
               { "ns": "amarilla", "kind": "path",    "path": ".pregate/packs/amarilla" } ],  // U8; pasa rules test al compilar
  "methodologies": ["core/clean-architecture", "core/clean-code", "core/tdd", "amarilla/north-star"],
  "languages": ["typescript", "javascript"],          // .py, .sql y .cs: sin pack ⇒ EVA-SCOPE-001 en capas declaradas
  "enforcement": "shadow",                            // explícito: 2 semanas de calibración; después, enforce
  "scope": { "include": ["src/**"], "exclude": ["src/**/generated/**"] },
  "layers": { /* tomadas de ark.config.json */ },
  "coexist": { "arkgate": { "config": "ark.config.json",
                            "ownedByArkgate": ["CA-DEP-001"],
                            "note": "ArkGate ya hace cumplir la dirección de capas; pasa a PREGATE con el importador (v1)." } },
  "ratchet": { "mode": "no-new" },
  "failMode": "closed"
}
```

Los ejemplos 1 a 3 forman parte de la suite de tests del compilador y se validan en CI contra el compilador real de su entrega. El ejemplo 4 es una plantilla del piloto.

### 8.5 Reglas de composición

**0.2.1 implementation (O53):** `preset.enforcement` supplies the default;
`overrides[aliasOrCheck].enforcement` independently selects `enforce` or `shadow`.
Severity remains `deny`/`ask`/`warn`/`off`. Effective aliases of one check must agree
on enforcement or explicitly resolve it. Integrity always enforces and cannot be
shadowed. Reports preserve effective policy at call time. Cross-check stance
conflicts and parameterized patterns remain open (O55); `advise` remains outside
the implemented preset schema.

1. **Metodologías: unión, no promedio.**
   - Todas las invariantes de todas las metodologías elegidas quedan activas. El orden de `methodologies` no importa.
   - En checks `multi` (listas de imports prohibidos, patrones por ruta) las instancias se suman y las idénticas se deduplican. No hay conflicto.
   - En checks `singleton` y en dimensiones con postura, si dos metodologías activas en el mismo scope no coinciden, hay un **conflicto**.
2. **Todo conflicto exige resolución explícita en el preset, o el preset no compila.** Son conflictos:
   - **mismo check con distinto umbral** (por ejemplo `fn.params`: 3 en CC, 4 en RF, 7 en CC2);
   - **mismo check efectivo con distinta severidad** (dos aliases, o dos instancias `multi` idénticas, uno en `deny` y otro en `warn`), salvo la absorción por integridad de §5.3;
   - **posturas opuestas en la misma dimensión** (por ejemplo `comments.policy: minimal` contra `interface-required`, o `fn.size: small` contra `deep-modules`).

   Formas válidas de resolver:
   - `resolve[dimension].use` = una metodología o un alias (con `severity` opcional si el conflicto es de severidad). Desactiva las demás invariantes de esa dimensión en ese scope (para apagar invariantes fuera de la dimensión se usa `overrides: "off"`);
   - `resolve[dimension].policy` = `strictest` o `lenient`, **solo para umbrales**, escrito por el usuario. `strictest` no se recomienda en dimensiones filosóficas, porque induce fragmentación;
   - un `overrides[checkId].params` que fija el valor del umbral en conflicto. Cuenta como resolución explícita y el lock lo registra así. Las posturas opuestas solo se resuelven con `use`.
3. **`pairs.json` y los `conflicts[]` de los manifiestos solo sugieren.** `init` y el Forge proponen la sugerencia; el humano la confirma o elige otra, y recién entonces queda escrita en `resolve`. No existe ningún default de precedencia: ni "gana el último en la lista", ni "gana el más estricto", ni "gana el pack más nuevo". Una resolución que llega escrita en un preset curado o heredado también exige confirmación (`confirmedBy` en el lock).
4. **Herencia de presets (`extends`).**
   - Acepta archivos locales (`./presets/x.json`) o presets publicados por una fuente declarada (`acme/presets/base`).
   - Se resuelve en profundidad y en orden: el hijo pisa al padre clave por clave, igual que en tsconfig.
   - Las `methodologies` de toda la cadena se suman (unión).
   - Un conflicto que aparece por herencia se resuelve en cualquier eslabón de la cadena; si nadie lo resuelve, no compila. Si lo resuelve un eslabón que el equipo no escribió, la resolución tiene que estar confirmada (punto 3).
   - Un ciclo de `extends` es un error.
5. **Orden de precedencia** para fijar el valor efectivo por (archivo, check, instancia), de mayor a menor:
   1. `overrides` del último scope que coincide;
   2. `overrides` de nivel superior;
   3. `resolve[dimension]` del último scope que coincide, y después el de nivel superior;
   4. los defaults del **único** alias activo en esa dimensión.

   Si en el paso 4 hay más de un alias con valores distintos, es el error de compilación del punto 2. Cada valor efectivo queda en el lock con su origen.
6. **Overrides solo sobre lo activo.** `overrides` modifica invariantes de metodologías activas; no enciende reglas sueltas. Para sumar una invariante individual, el equipo crea un manifiesto local (`local/team-conventions`) que la referencia con su fuente. Así el preset sigue leyéndose como metodologías y toda regla activa tiene fuente.
7. **Severidades.**
   - Los valores posibles son:
     - `deny`: bloquea y el agente recibe el motivo;
     - `ask`: escala al humano, solo en sesiones interactivas y en harnesses donde `ask` es confiable;
     - `warn`: no bloquea y agrega contexto, solo para violaciones introducidas;
     - `off`.
   - `severityCeiling.heuristic` es un **techo**. Un `overrides` que lo supera no se recorta en silencio: es un **error de compilación** ("override exceeds heuristic ceiling; set allowHeuristicDeny or remove it"). El techo se levanta solo si `precision.measured ≥ minForDeny`, o con `allowHeuristicDeny:true`, y la decisión queda registrada en el lock.
   - `enforcement` se aplica al final: `shadow` registra sin decidir y `advise` convierte todo en `warn`. **Ninguno de los dos afecta a `core/pregate-integrity`.**
   - Las invariantes de `core/pregate-integrity` **no se pueden poner en `off`** ni bajar de su `minSeverity` (campo de `check.json`).
8. **Incompatibilidades duras** (`incompatibleWith`: `ddd-tactical` con FCIS, `poeaa-active-record` con `clean-architecture`). Se verifican contra **la lista real de archivos** al compilar (si un archivo existente cae en dos scopes incompatibles, no compila) y otra vez en runtime: un archivo nuevo que cae en dos scopes incompatibles produce `deny` con EVA-SCOPE-002.
9. **Contrapesos [v1].** Si un preset limita tamaño, los manifiestos declaran contrapesos. Desde v1, un preset que limita tamaño sin contrapesos **declarados** no compila, y los contrapesos se evalúan en Stop (§5.2). En el MVP los contrapesos aparecen solo como texto `Avoid:`.
10. **Scoping por path y glob.**
    - `scope.include` y `scope.exclude` definen el universo.
    - `scopes[]` se aplica en orden y el último que coincide gana; sus `methodologies` se suman a las globales.
    - Los globs se evalúan sobre la ruta relativa a la raíz, después de `realpath`.
    - Un archivo **nuevo** que cae en `exclude` produce `deny` (EVA-SCOPE-001; `ask` solo con `failMode: ask` y sesión interactiva), nunca un permiso silencioso.
    - Editar un archivo **existente** que cae en `exclude` o tiene marcador de generado produce `deny` (EVA-GEN-002): los generados se regeneran, no se editan.
11. **Lenguajes.**
    - Cada check declara qué capacidades de IR necesita o qué lenguajes implementa.
    - El compilador avisa si una invariante activa no tiene implementación para un lenguaje del proyecto, la registra como `unimplemented` y `preset show` lo dice en voz alta.
    - Un archivo nuevo **o existente** de un lenguaje sin language pack, dentro de una capa declarada, produce `deny` (EVA-SCOPE-001). En el piloto (`.py`, `.sql`, `.cs`) eso obliga a declarar esas rutas fuera de las capas o a esperar su pack.
12. **Convivencia con ArkGate (U9, U10).** Cada invariante que ArkGate ya hace cumplir figura en `coexist.arkgate.ownedByArkgate`: PREGATE no la evalúa en ninguna cara y el lock lo registra con ese origen. [v1] El importador lee `ark.config.json` y `arkrules/*.json`, detecta las invariantes PREGATE equivalentes y, si alguna superposición no está asignada a una sola herramienta, el preset no compila. Nunca hay doble enforcement ni un dueño elegido en silencio.

**Ejemplo de error de compilación:**
```
$ pregate preset compile
✗ Unresolved conflict in dimension "comments.policy" (scope: global)
  core/clean-code@1.0.0                          stance=minimal            (no exige documentación)
  core/philosophy-of-software-design@1.0.0       APOSD-CMT-001 stance=interface-required
  Suggestion (pairs.json): APoSD rules exported symbols; CC-CM-001 (no commented-out code) stays active.
  To accept it, add to the preset:
    "resolve": { "comments.policy": { "use": "core/philosophy-of-software-design" } }
  Or choose clean-code:
    "resolve": { "comments.policy": { "use": "core/clean-code" } }
✗ 1 conflict unresolved. The preset does not compile.
```

**Conflictos conocidos** con su resolución **sugerida** en `pairs.json` (nunca aplicada sin confirmación):

| Conflicto | Resolución sugerida |
|---|---|
| Largo de función | Umbral moderado (40) y contrapesos activos |
| Parámetros | Elegir explícitamente un alias y su umbral (no hay sugerencia universal) |
| DRY contra la regla de tres | Duplicación textual con `minOcc=3`; DRY de conocimiento (constantes, regex) desde la segunda aparición |
| Interfaz con una sola implementación contra YAGNI | Exenta si es un port o un seam de test |
| Comentarios | Sin código comentado; doc solo en exports si APoSD está activo |
| Clases pequeñas contra "classitis" | Se mide profundidad además del tamaño |
| Capas contra pass-through | Exento al cruzar una frontera declarada |
| Estilo de errores | Fijar `resolve["errors.style"]` |
| Modelo rico contra datos y funciones | Incompatibles en el mismo archivo; separar por scope |
| Active Record | Incompatible con CA, HEX y DDD |
| Inmutabilidad | Obligatoria en VO, core y DTO; las entidades mutan por métodos con intención |
| Deméter contra APIs fluidas | `fluentAllow` |
| `switch` contra polimorfismo | El `switch` exhaustivo sobre una unión discriminada es válido |
| Singleton | Solo sin estado y conectado en la raíz de composición |
| Herencia | Profundidad ≤ 2, nunca desde clases concretas de terceros |
| Configuración externa contra menos perillas | Al entorno solo lo que cambia entre deploys |
| TDD contra legado | Archivo nuevo: TDD-FIRST; existente: caracterización + ratchet |
| Getters y setters | Getters sí; setters públicos no en entidades ni VO |

### 8.6 Qué puede hacer el agente con el preset

- **Editar `preset.json`:** siempre `deny`, en todo harness y en todo modo, con las tools de edición y con el shell. El motivo le indica al agente cómo proponer: "write a JSON-patch request in .pregate/requests/preset-<ts>.json and ask the user to run `pregate preset apply`".
- **Proponer cambios al preset:** el agente escribe `.pregate/requests/preset-<ts>.json` (JSON-patch validado por schema, con justificación). El humano lo revisa y lo aplica con `pregate preset apply <solicitud>`, que valida, compila y escribe preset y lock. El guard de shell deniega ese subcomando al agente. **No hay `ask` sobre `preset.json`:** no está verificado que `ask` obligue a mostrar el prompt en todos los modos, y un clic durante la tarea sería negociar la regla en caliente.
- **Cambiar `enforcement`** (por ejemplo a `shadow`): solo por solicitud + `preset apply`. El agente no puede bajar el gate en mitad de una tarea.
- **Lock, baseline, excepciones, `.pregate/rules/**`, packs y cualquier carpeta de reglas declarada:** siempre `deny`.
- **Forge:** el agente puede proponer reglas y pedir su activación (una solicitud); no puede activarlas (§12).
- **MCP:** no expone ninguna tool para editar, suprimir o desactivar reglas ni el preset.
- **Sin preset:** el hook queda inactivo y lo avisa una vez por sesión.

### 8.7 "¿Qué invariantes valida cada llamada?"

La respuesta es **determinista y consultable**:
- el lock (en disco desde el MVP) lista cada regla efectiva por scope, con su parámetro, severidad, fase, procedencia y la entrada del preset que resolvió cada conflicto;
- `pregate explain --path <archivo>` muestra exactamente qué invariantes se aplican a ese archivo y de qué metodología, scope u override viene cada una;
- `get_active_invariants(path)` [v1] da lo mismo al agente por MCP, antes de escribir;
- cada deny incluye el hash del lock que lo produjo.

---

## 9. Código legado: baseline y ratchet

Si el gate exige que el archivo entero cumpla, la primera edición en cualquier repo real queda bloqueada. Precedentes: Betterer, los baselines de PHPStan y Psalm, las supresiones masivas de ESLint y el gate de no-regresión de CodeScene. El ratchet es coherente con la visión: **lo que entra** tiene que cumplir; la deuda heredada no se propaga ni crece.

**El "antes" del ratchet es el inicio de la sesión, no el disco de la llamada anterior.**
- `before_sesión`:
  - el contenido en `HEAD` si el archivo estaba limpio al iniciar;
  - la copia guardada en la snapshot de inicio de sesión si estaba sucio o no rastreado;
  - vacío (∅) si el archivo se creó en la sesión.
- Sin git, se usa una snapshot en el primer contacto, con aviso: la protección es más débil.
- El disco actual sirve solo para reconstruir `after` y para detectar reintentos.
- **Motivo.** Si el "antes" fuera el disco de cada llamada, cualquier escape quedaría blanqueado como nueva base: shell, un `ask` aprobado, el tope de Stop o un hook caído. La tolerancia, además, se acumularía (diez ediciones de +2 líneas con tolerancia 2 suman +20 sin un solo deny).
- En **pre-commit**, el "antes" es `HEAD`. En **CI**, el baseline commiteado (o el merge-base).
- En harnesses **sin evento de inicio de sesión** utilizable, la snapshot se toma en el primer evento de la sesión que llegue al adaptador; si tampoco hay identificador de sesión, el "antes" es `HEAD`.

| Modo | Qué deniega | Uso |
|---|---|---|
| `strict` | Cualquier violación en `after` | Archivos nuevos (siempre) y greenfield |
| `no-new` | Violaciones nuevas. **MVP:** (1) toda violación sobre un `symbolPath` que no existía en `before_sesión` es nueva **sin compensación**; (2) para los símbolos preexistentes, conteo por (regla, archivo) contra `before_sesión` | Mínimo viable. Un renombre o un movimiento de un símbolo preexistente no cambia el conteo |
| **`no-worse`** [v1, default] | Fingerprints nuevos **y** métricas que empeoran (`after > before_sesión + tolerancia`) | Recomendado |
| `boy-scout` [v1] | Además, los símbolos tocados tienen que cumplir | Opt-in; agranda el alcance de la tarea |

- **Limitación del MVP:** como el conteo se aplica solo a símbolos preexistentes, una función larga **nueva** ya no puede compensarse con una legada que bajó del límite. Lo que queda: entre símbolos preexistentes, empeorar uno y mejorar otro en la misma regla y archivo pasa; y un renombre de un símbolo con violación se ve como símbolo nuevo (falso positivo conservador, que el agente resuelve sin renombrar). Ambos se resuelven en v1 con fingerprints y emparejamiento por cuerpo.
- **`lockImprovements`** [v1, default `false`]: una mejora lograda en la sesión pasa a ser el nuevo piso. Viene apagado para no castigar refactors en varios pasos.
- **Baseline de proyecto** (`.pregate/baseline.json`) [v1]:
  - lo genera un humano con `pregate baseline` y se commitea;
  - está protegido, CI lo usa y CODEOWNERS lo cubre;
  - el agente nunca lo regenera: el guard de shell deniega ese subcomando.
- **Mensajes con ratchet:** "legacy code: at session start it measured 64 lines; keep it ≤ 64, do not grow it".
- **Las violaciones preexistentes nunca se mencionan en un `warn`** (salvo con `boy-scout`). Si se mencionaran, empujarían al agente a "arreglar de paso" código que no se le pidió.
- **Sin burn-down ni reportes de deuda** (U10): la gestión de la deuda heredada es territorio de ArkGate. PREGATE usa el baseline solo para decidir qué es nuevo.
- **Reglas de WELC** como opciones del ratchet [v1]: sprout, monster method que no crece y clase grande que no gana métodos públicos.

---

## 10. Anti-bypass y escape hatches

**Modelo de amenaza.** El agente no es malicioso, pero **busca el camino de menor resistencia** (*specification gaming*). Las defensas están pensadas para ese comportamiento, y la garantía es el conjunto hook fail-closed + pre-commit + CI con el mismo binario y el mismo lock (U10). Contra un adversario real con permisos locales, la red es CI con CODEOWNERS.

### 10.1 Vectores conocidos

| Vector | Ejemplos |
|---|---|
| Escritura por shell | `>`, `>>`, `tee`, heredoc, `sed -i`, `perl -pi`, `python -c`, `node -e`, `cp`, `mv`, `git apply`, `patch`, `git checkout -- file`, `curl -o`, scripts. **[V]** En Claude Code, un PostToolUse `Edit\|Write` no se dispara si el shell reescribe el archivo, y `bashEditDiff` es beta, "not to enforce a policy". **[V]** En Codex se observó al modelo esquivar un deny de `apply_patch` con `perl -pi` |
| Escritura diferida | `run_in_background` y `Monitor` escriben después del Post del shell, y pueden seguir escribiendo después de Stop. Los cubre Stop (con re-evaluación si `background_tasks[]` no está vacío), SessionEnd y pre-commit |
| MCP y otras tools | Servidores que escriben archivos; tools de extensiones con esquema propio (en pi, cualquier tool de extensión dispara su evento con su nombre) |
| Auto-exención | Agregar `// @generated` o `DO NOT EDIT`; crear código en una ruta de `exclude` o en un lenguaje sin language pack; editar un archivo generado o excluido que ya existía; supresión inline; escribir un `.pregate/` anidado para secuestrar la raíz; variar mayúsculas en rutas protegidas (`.Pregate/`); escribir en un worktree que la snapshot no cubre |
| Evasión de reglas | Import dinámico o `require(var)`; barrel que re-exporta infra; `as unknown as T`; `catch (e) { void e }`; `const ONE_HUNDRED = 100`; `opts: {a;b;c;d}`; closures anidadas; tablas de lambdas; `toBe(5)` → `toBeDefined()`; borrar el archivo de test. **Cada una es una familia del corpus de trampas** |
| Apagar el gate (Claude Code) | Editar `.claude/settings*.json` (proyecto **o usuario**); `"disableAllHooks": true` **[V]**; `enabledPlugins: {"pregate": false}`; `claude plugin disable`; `--settings`; `--no-verify`; `git config core.hooksPath` |
| Invocar otro harness sin hooks desde el shell | `claude -p --settings …`, `codex exec -c features.hooks=false`, `GROK_CLAUDE_HOOKS_ENABLED=0 grok -p`, `KILO_PURE=1 kilo`, `aider --yes`: un agente lanza otro agente que escribe sin gate |
| Apagar el gate (otros harnesses) | `disableAllHooks` en Qwen y Copilot; `[compat.claude] hooks=false` o `GROK_CLAUDE_HOOKS_ENABLED` en Grok Build; `KILO_PURE=1` en Kilo; `--yolo` desactiva hooks en Cline; `hooksConfig.enabled:false` en Gemini; `chat.useHooks` en VS Code; editar `.codex/hooks.json`, `[features] hooks` en `.codex/config.toml`, `.grok/hooks/`, `.gemini/settings.json`, `.qwen/settings.json`, `.cursor/hooks.json`, `.github/hooks/`, `.factory/hooks.json`, `.kiro/hooks/`, `.opencode/plugins/`, `.amp/plugins/` |
| Manipular el estado | `preset.json`, lock, baseline, `exceptions.json`, `state/` y snapshots (borrarlos para forzar un "primer contacto" que blanquee el ratchet), carpetas de reglas |
| Usar el Forge como bypass | Escribir código de producción en un borrador; proponer una regla "más débil"; pedir activación como si fuera aprobación; fixtures que se ejecutan como tests reales (un `.only` en una fixture enfoca toda la suite) |
| Optimizar contra la métrica | Fragmentar en helpers triviales; pass-through; renombrar para esquivar listas |

### 10.2 Defensas en capas

1. **Prevención en contexto [MVP].**
   - **[V]** En Claude Code, SessionStart acepta `hookSpecificOutput.additionalContext`. Se inyecta un resumen compacto del preset y el comando de pre-check (§11.6). Los demás adaptadores usan su canal equivalente cuando existe.
   - [v1] Reinyección después de la compactación (matcher `compact`; el valor exacto de `source` está a verificar), junto con las reglas más denegadas en la sesión.
2. **Pack de integridad [MVP parcial, v1 completo].** Invariantes EVA-* evaluadas por diff contra `before_sesión`:
   - un marcador de generado o una supresión inline cuentan solo si ya existían antes;
   - el import dinámico en una capa se deniega;
   - la doble aserción de tipo se deniega;
   - un archivo generado o excluido que ya existía no se edita (EVA-GEN-002);
   - las aserciones y la fuerza de los matchers no pueden bajar en la sesión (en Stop) [v1];
   - ningún archivo fuera de `.pregate/forge/drafts/` puede importar desde ahí (EVA-FORGE-001);
   - cada check tiene fixtures `trap/` para cada familia aplicable del corpus.
3. **Guard de shell en el pre-tool [MVP].** Heurístico, sin pretender completitud. Matchea la herramienta de shell de cada harness (`Bash|PowerShell|Monitor`, `run_terminal_command`, `exec_command`, `run_shell_command`, `bash`, `Execute`, `launch-process`, …, ver §14.2). Deniega:
   - un patrón de escritura más una ruta en scope (motivo: "use the edit tools");
   - cualquier comando que toque `protectedPaths`, las carpetas de reglas o los archivos de configuración de hooks de cualquier harness instalado;
   - comandos administrativos: `pregate baseline|approve|disable|exceptions|preset apply|preset compile|init|forge promote|sources update|import`, `--no-verify`, `core.hooksPath`, `disableAllHooks`, `claude plugin (disable|uninstall)`, `--settings`, y las variables y flags que apagan hooks en otros harnesses (fila anterior);
   - **binarios de otros harnesses** (`claude`, `codex`, `grok`, `gemini`, `qwen`, `copilot`, `cursor-agent`, `aider`, `opencode`, `kilo`, `amp`, `cline`, `junie`, `kiro-cli`, `droid`, `auggie`), salvo allowlist explícita del preset;
   - asignaciones de entorno inline (`VAR=… cmd`) que coinciden con interruptores de hooks.

   La heurística de escritura cubre POSIX (`>`, `>>`, `tee`, heredoc, `sed -i`, …) y PowerShell (`Set-Content`, `Out-File`, `Add-Content`, `New-Item -Value`, redirecciones). Permite el pre-check de solo lectura (`pregate check --stdin ...`). **[V]** `PowerShell` existe en Claude Code en Windows sin Git Bash y como opt-in en macOS y Linux; por eso está en el matcher desde el MVP. (A verificar: en Codex, una invocación `apply_patch <<EOF` por shell podría llegar como `Bash` y el guard la denegaría como heredoc; el perfil de Codex la reconoce y la normaliza como patch.)
4. **Diff del árbol de trabajo.**
   - **[MVP]** En Stop: `git diff` + `git status` contra la snapshot de sesión. Cubre shell, MCP, generadores y `run_in_background`: la verdad es el árbol, no el comando.
   - **[v1]** Snapshot puntual en el pre-tool del shell **solo si el comando coincide con la heurística de escritura**, y diff en el post del shell. Hacerlo en cada comando costaría 100 ms o más en repos grandes. Se usa `core.untrackedCache` y fsmonitor si están disponibles.
   - `bash.onWrite:"revert"` es opt-in, porque puede pisar ediciones humanas concurrentes. **Requiere git.**
5. **Gate en el fin de turno [MVP en Claude Code] / fin de subagente [v1].**
   - **[V]** En Claude Code, `decision:"block"` + `reason` en Stop hace que Claude siga trabajando. Claude Code tiene un tope de 8 continuaciones seguidas (`CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`). PREGATE usa su propio tope (`maxStopBlocks=2`) y respeta `stop_hook_active`.
   - `decision:block` solo para violaciones **introducidas en la sesión**. Las heredadas o de bajo impacto van por `additionalContext` (**[V]** feedback no-error).
   - SubagentStop evalúa solo los archivos que tocó ese `agent_id` (registrado en el estado).
   - Stop recorre **todas las raíces tocadas en la sesión** (registradas por los eventos Pre y de shell), incluidos los worktrees de `EnterWorktree` y de subagentes con `isolation: worktree`. La snapshot es por (sesión, raíz), creada en el primer contacto con cada raíz.
   - El `reason` de Stop incluye: "Do not remove functionality or tests to comply; if the fix exceeds the task, stop and report it to the user". [v1] Stop verifica además que no bajaron las aserciones (EVA-TEST-001) ni los exports públicos usados.
   - Otros harnesses con un evento equivalente (Stop en Grok, Codex, Qwen, Junie CLI, Kiro, Factory; `agentStop` en Copilot) reciben el mismo gate por su adaptador.
6. **Rutas protegidas.**
   - [MVP] `**/.pregate/**` a cualquier profundidad (salvo `.pregate/requests/**` de la raíz y los borradores del Forge vía MCP), las carpetas de reglas declaradas, `**/.claude/settings*.json`, `~/.claude/settings*.json`, el directorio de datos de PREGATE y `.pregate/git-hooks/**`. Comparación sin distinguir mayúsculas en volúmenes que no distinguen.
   - [v1] `~/.claude/plugins/**`, `.git/hooks/**`, la configuración de CI, `.codex/config.toml`, `~/.codex/config.toml` y los archivos de configuración de hooks de cada harness con adaptador instalado (los declara el perfil del adaptador).
   - `preset.json`: siempre `deny`; los cambios llegan como solicitud (§8.6).
7. **Hook `ConfigChange` [v1, Claude Code].** `decision:"block"` sobre cambios de configuración que apaguen hooks o el plugin. **[V]** ConfigChange usa el patrón `decision:block`; qué cambios concretos cubre está a verificar.
8. **Instalación inmune para equipos [v1/v2].**
   - **[V]** En Claude Code, `allowManagedHooksOnly` bloquea los hooks de user, project, local y plugins, salvo los plugins forzados en `enabledPlugins` de managed settings. Solo un `disableAllHooks` de managed settings apaga hooks managed.
   - **[V]** Un *mod* que engancha `tool.check` puede aprobar lo que bloqueó un PreToolUse, **salvo que el hook esté en managed settings**. Para la inmunidad frente a mods, el handler se declara **directamente en `hooks` de managed settings**. El plugin es el canal para devs individuales.
   - Equivalentes en otros harnesses: `/etc/grok/requirements.toml` con `allow_managed_hooks_only` (Grok Build), `requirements.toml` con `allow_managed_hooks_only` (Codex), políticas en `/etc/github-copilot/policy.d` (Copilot CLI), hooks enterprise de Cursor y de Factory. La guía de despliegue por harness llega con cada adaptador.
9. **Cierre de la garantía (U10).** `pregate check --staged --ratchet` en pre-commit **[MVP]** y `pregate check --ratchet` en CI **[MVP: plantilla mínima de GitHub Actions; v1: SARIF y otras plataformas]**, contra `HEAD` o el baseline, más CODEOWNERS sobre `.pregate/**`. Es la única red que cubre por igual a todos los harnesses, incluidos los que fallan abierto y los que no tienen hooks (§14.5).
   - El script del pre-commit vive commiteado en `.pregate/git-hooks/` (o en la config de lefthook/Husky si el repo ya los usa), porque `.git/hooks/` no se versiona y el resto del equipo no lo tendría. Cada clon lo activa con `core.hooksPath=.pregate/git-hooks` vía `pregate install --git-hook` o un script `prepare` del package manager. Como esa activación es local y se puede omitir, CI corre igual las mismas invariantes.
   - `--staged` evalúa el contenido del **índice** (`git show :<ruta>`) contra `HEAD`, no el árbol de trabajo.
   - Los dos fallan si el lock commiteado no coincide con el preset, o si la versión del motor no es la fijada.

### 10.3 Escape hatches con aprobación humana

- **Supresiones inline nuevas** (`// pregate-disable-next-line`): son una violación en sí mismas (EVA-SUP-001), salvo que coincidan con una excepción aprobada.
- **Archivo de excepciones** [v1] `.pregate/exceptions.json`, protegido:
  ```json
  {
    "exceptions": [
      {
        "fingerprint": "CC-FN-002|src/billing/report.ts|buildReport|-",
        "contentHash": "sha256:9f2c…",
        "reason": "Firma impuesta por una API externa",
        "approvedBy": "<usuario>",
        "approvedAt": "2026-10-01",
        "expires": "2027-01-01"
      }
    ]
  }
  ```
  - El fingerprint tiene los cuatro segmentos de §5.6 (`-` cuando no hay discriminador).
  - `contentHash` hace que la excepción caduque si el símbolo cambia.
  - `expires` es obligatorio solo con `suppressions.requireExpires:true` (perfil equipo). En el perfil individual es opcional.
- **Canales de creación:**
  - `pregate approve <fingerprint|--last>` (con flags, sin TTY obligatorio);
  - en un prompt `ask`, la opción "permitir y registrar excepción", si el harness la permite (a verificar);
  - si no, el humano corre `pregate approve --last` (a verificar si el modo `!` del prompt de Claude Code pasa por PreToolUse).
- **Honestidad: localmente, las excepciones son best-effort.**
  - Una TTY se falsifica (`script -q /dev/null …`) y una denylist por string se esquiva (`ap""prove`).
  - **Las excepciones solo tienen efecto en CI si el commit que las agrega tiene aprobación de CODEOWNERS.**
- **Canal legítimo para el agente:** puede escribir `.pregate/requests/<timestamp>.json` (validado por schema) con su justificación, o usar la tool MCP equivalente [v1].
  - Escribir una solicitud **no desbloquea nada ni cuenta como resolución**.
  - Stop las lista al humano por `systemMessage`, y cuentan en `evasion_rate`.
- **No hay escape hatch por MCP.** El servidor MCP no tiene tools para suprimir, desactivar ni editar reglas, ni para aprobar excepciones.

---

## 11. Experiencia de la IA

### 11.1 Formato del mensaje de denegación

**Principios**
- **Primera línea autosuficiente, de 256 caracteres como máximo.** Grok Build recorta el motivo a 256 caracteres **[V]**, y otros harnesses muestran solo el comienzo en la UI. La primera línea lleva lo esencial: ID del alias, archivo:línea, medido/límite y la corrección mínima. El resto del mensaje es detalle. El adaptador de cada harness decide cuánto del detalle entrega según el límite de su canal (§14.3).
- **Todas** las violaciones de la llamada a la vez. Las primeras `maxDetailedViolations` (5) van en detalle y el resto en **una línea cada una** (`ID archivo:línea medido/límite`), hasta un tope de 30 líneas. Si hay más: "+N more: run the pre-check to see them all".
- Orden: severidad, después línea.
- Cada violación detallada lleva:
  - ID (el alias ganador → check canónico);
  - ubicación;
  - medido contra límite;
  - valor al inicio de la sesión si hay ratchet;
  - porqué (`why` del alias);
  - cómo corregir (`fixHint` + **datos calculados por el motor**: rangos de líneas candidatos con pocas variables compartidas, rutas de capas tomadas del preset);
  - qué evitar (`avoid` + los contrapesos).
- **El mensaje es la salida real del binario.** Nunca propone identificadores ni hace juicios semánticos ("mezcla impuestos y formateo" sería una práctica de juicio, no una invariante).
- **Sanitización:**
  - los símbolos y specifiers se truncan a 80 caracteres, van entre backticks y solo pueden contener `[A-Za-z0-9@/._$-]`;
  - **nunca** se interpolan comentarios ni strings literales del código, para que un texto escrito por el agente no vuelva como "voz del hook".
- **Tamaño:** objetivo de unos 1.500 caracteres y tope duro de 4.000. **[V]** El límite de 10.000 caracteres está documentado en Claude Code para `additionalContext` y `systemMessage`; no hay límite documentado para `permissionDecisionReason` (a verificar). En Grok Build el tope es 256 **[V]**.
- **Idioma:** los mensajes al agente salen por defecto en inglés (`agentMessageLanguage: "en"`, así el catálogo se escribe una sola vez). Los mensajes al humano (`stopReason`, `systemMessage`, reason de `ask`) salen en `userMessageLanguage` ("es"). El efecto del idioma se mide en §16.
- **Contador:** "attempt n", sin mostrar el máximo (`showAttemptMax:false`), para no anunciar cuándo llega la escalada.
- **La línea sobre el shell** aparece solo después de detectar un intento de escritura por shell en la sesión, para no sugerir la idea (se mide con un A/B).

**Formato exacto** (ejemplo v1, salida del motor; en el MVP el mensaje tiene la misma forma pero sin los datos de `computedHints`, como los rangos de líneas candidatos, que exigen análisis de flujo de datos y llegan en v1):

```
PREGATE DENY CA-DEP-002 src/domain/invoice.ts:3 layer `entities` imports `@prisma/client` (banned). Fix: depend on a port in src/application/ports/**, implement it in src/infra/**. +1 more. Details: pregate explain CA-DEP-002

Preset billing-backend 1.0.0 (clean-code + effective-typescript + clean-architecture + ddd-tactical + philosophy-of-software-design) · lock 3f9a1c · attempt 2

1) CA-DEP-002 → core/dependencies/banned-imports · line 3
   Layer `entities` must not import framework/ORM packages; found `@prisma/client`.
   Why: domain rules must not depend on persistence details (Clean Architecture, ch. 22 & 32, paraphrased).
   Fix: declare the interface you need under layer `ports` (src/application/ports/**) using only domain
        types; implement it under layer `adapters` (src/infra/**). Name it with a glossary term.

2) CC-FN-001 → core/complexity/fn-max-lines · line 42 · `Invoice.calculateTotals`
   Measured 71 · limit 40 (resolve fn.size) · at session start 64 (legacy: keep it ≤ 64, do not grow it).
   Why: long functions mix levels of abstraction and are hard to change safely (Clean Code, ch. 3, paraphrased).
   Fix: extract a cohesive block. Candidate ranges with few shared variables: 55–68 (2 in, 1 out),
        70–80 (1 in, 1 out). Name the result after the domain concept it computes.
   Avoid: one-line helpers, pass-through functions, helpers called once with ≥4 params
          (checked at end of turn).

Rewrite until every listed violation is fixed. Do not resubmit the same edit and do not work around the rule.
If the task cannot be done within these invariants, or you believe this is a false positive, stop and tell the
user which rule blocks you (ID and line) and why. Do not trim the task.
If a rule conflicts with an explicit user instruction, ask the user.
Pre-check before writing: `pregate check --stdin --path <file> --format agent` (or the MCP tool `check`).
```

(La primera línea del ejemplo tiene 223 caracteres.)

**JSON emitido por el adaptador de Claude Code** (con `exit 2`):
```json
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny",
  "permissionDecisionReason":"PREGATE DENY CA-DEP-002 src/domain/invoice.ts:3 …"}}
```

**Variantes**
- **`warn`:** por el canal de contexto adicional del harness, en una o dos líneas por violación **introducida**, con el sufijo "informational; no action required for this task".
- **Post [v1]:** se emite solo si Pre no evaluó o hay un deny nuevo que Pre no informó. Empieza con "This write WAS ALREADY APPLIED. Fix forward with the edit tool; do not revert with git or the shell."
- **Stop:** el `reason` lista las violaciones introducidas en la sesión y la cláusula de no recortar la tarea.
- **Forma (`reconstruction: unknown | truncated`):** "PREGATE cannot evaluate this edit (<cause>). Resend it as an exact replacement or a full write."

### 11.2 Escalamiento: `stop` por defecto

- Escalar a `ask` premia la persistencia: el agente aprende que, después de N intentos, un humano hace clic.
- Además, **[V]** en Claude Code el agente no ve el motivo de un `ask`, así que si el humano rechaza, no aprende nada.
- Por eso el default es `loop.escalate: "stop"`: deny + detención del turno (`continue:false` + `stopReason` en Claude Code) para el humano, que interviene con contexto. En harnesses donde la detención no es confiable (por ejemplo Codex, donde `continue:false` hace fallar el hook y **la tool sigue** **[V]**), el adaptador emite solo `deny` con el texto de detención y bloquea el fin de turno si el harness tiene ese evento.
- `"ask"` es una opción explícita, válida solo en sesiones interactivas y en harnesses donde `ask` es confiable, y siempre acompañada del contexto con la violación.

### 11.3 Límite de reintentos y estado

**Estado:** `<datos de PREGATE>/state/<harness>/<session_id>/` como **eventos append-only**, un archivo por id de llamada escrito de forma atómica con rename. Los contadores se derivan al leer. Esto evita perder incrementos con hooks paralelos (**[V]** en Claude Code, PostToolUse corre de forma concurrente cuando hay llamadas en paralelo, y los PreToolUse que coinciden corren en paralelo).
- **Directorio de datos.** MVP (instalación por settings, sin plugin): `${CLAUDE_PLUGIN_DATA:-${XDG_STATE_HOME:-~/.local/state}/pregate}/<hash de la raíz del proyecto>/`. Desde v1, con el plugin, `${CLAUDE_PLUGIN_DATA}`. Está en las rutas protegidas desde el MVP.
- **Snapshot ausente** para una sesión ya registrada (por ejemplo, porque se borró el directorio): `failMode`, nunca un nuevo "primer contacto" que blanquee el ratchet.
- **Id de llamada.** `tool_use_id` o equivalente. Gemini, Kiro, Junie y Devin no mandan id: el adaptador usa un `callId` sintético = hash(sesión, tool, input normalizado, secuencia monotónica del proceso). Con él no se deduplican los reintentos idénticos; se documenta.
- **Límite de turno.** `prompt_id` en Claude Code (v2.1.196+), `turn_id` en Codex; si el harness no trae ninguno, el último evento de fin de turno registrado.

**Claves de los contadores:** `(harness, session_id, agent_id, archivo, ruleId)`. **Sin `symbolPath`**, porque renombrar o extraer no debe resetearlos. Un subagente no consume ni resetea el presupuesto del agente principal.

| Situación | Acción |
|---|---|
| 1.º y 2.º deny sobre (archivo, regla) | `deny` con el mensaje completo y "attempt n" |
| **Sin progreso**: el AST normalizado (sin trivia ni comentarios) coincide con un intento denegado, **o** el conteo de violaciones de (archivo, regla) no baja [MVP] / el vector `{fingerprint → valor medido}` no mejora [v1], en `noProgressLimit` (2) intentos seguidos | `deny` con "same edit as a denied one / no progress", y escalamiento anticipado |
| Se llega a `maxDenialsPerFileRule` (3) | `escalate` (default `stop`) |
| Se supera `maxDenialsPerTurn` (15) | **`deny` + detención del turno + aviso al humano**. Nunca se relaja la severidad |
| Fin de turno bloqueado `maxStopBlocks` (2) veces | Se permite terminar y se avisa al humano con lo pendiente y las solicitudes abiertas |
| TDD-DEL-001 (bajan las aserciones) | `ask` desde el primer intento en sesiones interactivas donde `ask` es confiable; si no, deny + detención. Exento si se borró también el símbolo de producción que cubría |
| `permission_mode` ∈ {`bypassPermissions`, `dontAsk`}, hay `agent_id`, `allowAsk:false`, sesión remota, sin señal de interactividad o harness sin `ask` confiable en ese modo | Nunca `ask`: deny + detención |
| `permission_mode: "auto"` (Claude Code) | **[V]** `ask` fuerza el prompt (permitido) |

### 11.4 Conflicto con instrucciones del usuario
Si cumplir el preset contradice una instrucción explícita del usuario, el cierre fijo del mensaje le pide al agente preguntar en lugar de vaciar la implementación. Se mide como `user_conflict_escalations`.

### 11.5 Fuera del sobre, solicitudes y falsos positivos
- El agente tiene dos salidas legítimas: **reescribir hasta cumplir**, o **declarar que la tarea no entra en el sobre y detenerse**, citando el ID de la regla y la línea. Se mide como `envelope_declarations`.
- Un falso positivo se trata igual: se cita ID y línea, se detiene la escritura de ese archivo y se reporta. Nunca se esquiva.
- La salida "dejé una solicitud" no cierra nada: Stop la reporta y cuenta en `evasion_rate`.

### 11.6 Pre-check e introspección para el agente
- **[MVP]** `pregate check --stdin --path <ruta> --format agent` es de solo lectura, está permitido por el guard y se menciona al iniciar la sesión.
- **[v1]** Las tools MCP `get_active_invariants(path)`, `check(...)` y `explain_rule(id)` dan lo mismo sin pasar por el shell (§12.2). Consultar no es negociar: el resultado es el mismo que daría el gate.
- Permite validar antes de escribir archivos grandes.
- Se acepta el riesgo de que funcione como oráculo: el propio deny ya lo es.
- Su efecto sobre las denegaciones por tarea se mide (brazo H, §16).

---

## 12. Rule Forge y MCP

### 12.1 Principio: primero se programa la invariante, después existe la regla (U2)

Si al usuario le falta una invariante, no "agrega una regla". Primero se programa cómo esa práctica se vuelve invariante (qué mira, cuándo falla, cómo se verifica), y recién cuando eso está demostrado la regla entra al catálogo local y puede activarse en el preset. **Sin prueba ejecutable no hay regla.**

El reparto de roles es fijo:

| Rol | Quién | Qué hace |
|---|---|---|
| **Parte creativa** | El agente del usuario (Claude Code u otro cliente MCP) | Traduce la práctica a un check (primitiva, patrón o checker) y escribe fixtures `pass`, `fail` y `trap` |
| **Juez determinista** | El servidor MCP de PREGATE | Scaffold, ejecución de fixtures, chequeo de determinismo, corpus estándar de trampas, admisión o rechazo con motivo |
| **Activación** | El humano, por la CLI | Revisa, promueve el borrador a una fuente de reglas y lo activa en el preset (`pregate forge promote --activate` o `pregate preset apply`) |

**PREGATE no necesita LLM ni API key propia.** Toda la inteligencia generativa la pone el agente que el usuario ya usa; PREGATE solo ejecuta y juzga. Motivo de la separación entre proponer y activar: **el agente restringido no puede ser quien escriba sus restricciones** (U4).

### 12.2 El servidor MCP de PREGATE [v1]

Un solo servidor (`pregate mcp serve`) con dos grupos de tools. Todas leen el mismo lock que el hook.

**Introspección (consultar no es negociar):**

| Tool | Entrada | Salida |
|---|---|---|
| `get_active_invariants` | `path` | Invariantes efectivas para ese archivo: alias, check, parámetros, severidad, fase, fuente, porqué corto, y la entrada del preset que resolvió cada conflicto |
| `check` | `path` + una de: `after` (archivo completo), `old`/`new` (reemplazo), `patch` (dialecto declarado) | Dry-run: la misma `Decision` que daría el gate (veredicto, violaciones, mensaje). No incrementa contadores de reintento; queda registrado como pre-check para las métricas |
| `explain_rule` | `id` (alias o check) | Fuente, porqué, cómo corregir, qué evitar, parámetros efectivos, fixtures `pass`/`fail` de ejemplo y familias de trampa cubiertas |
| `get_preset_summary` | — | El contrato en forma compacta ("la IA no podrá: …"), igual que `pregate preset show` |

**Forge:**

| Tool | Qué hace |
|---|---|
| `forge_list_primitives` | Primitivas built-in, sus parámetros y las capacidades de IR de cada language pack, para que el agente prefiera una primitiva o un patrón antes que un checker |
| `forge_list_candidates` | Candidatas del backlog que el conocimiento actual del preset (`glossary`, `layers`, `markers`) podría volver binarias |
| `forge_scaffold` | Crea un borrador en `.pregate/forge/drafts/<draftId>/` con `check.json` esqueleto, carpetas de fixtures, el alias propuesto y un checklist |
| `forge_write_file` / `forge_delete_file` | Escriben o borran archivos **solo dentro del borrador** (rutas relativas normalizadas, sin `..` ni symlinks) |
| `forge_run` | Corre las fixtures del borrador y devuelve el resultado por fixture |
| `forge_judge` | Corre el pipeline completo del juez (§12.4) y devuelve `admissible` o `rejected` con los motivos y un hash de reporte |
| `forge_propose_activation` | Registra una solicitud de activación en `.pregate/requests/`. No activa nada |

**Explícitamente descartado** (U4): tools para suprimir, desactivar o editar reglas; tools para editar el preset, el lock, el baseline o las excepciones; tools para cambiar `enforcement`; y el MCP como mecanismo de enforcement. El MCP es opcional: un agente puede no llamarlo nunca y el gate funciona igual.

**Permisos del MCP frente al hook.** Las llamadas a tools del MCP de PREGATE pasan por el pre-tool del harness como cualquier tool MCP (`mcp__pregate__*` en Claude Code). El adaptador las deja pasar sin evaluarlas como escrituras de código, porque el servidor solo escribe dentro de `.pregate/forge/drafts/` y `.pregate/requests/`, con rutas validadas.

### 12.3 Flujo del Forge

```
 Práctica en lenguaje natural ("los repositorios del dominio son interfaces")
   │
   ▼ agente → forge_list_primitives / forge_list_candidates
   ▼ agente → forge_scaffold { practice, area, proposedId, kind }
 .pregate/forge/drafts/<id>/   (cuarentena: nunca es fuente de reglas, nunca está en scope)
   ├─ check.json              escrito por el agente vía forge_write_file
   ├─ alias.json              alias propuesto: fuente, porqué, cómo corregir, qué evitar
   ├─ fixtures/{pass,fail,trap}/…
   └─ checker.*               solo si kind = custom, con customJustification
   │
   ▼ agente → forge_run (itera) → forge_judge
 Reporte del juez: admissible | rejected + motivos + evidencia (variante que gana la regla, fixture
                   que falla, diferencia de determinismo) + hash
   │  rejected → el agente endurece y vuelve a pedir juicio
   ▼  admissible → forge_propose_activation (opcional) → .pregate/requests/<ts>.json
 HUMANO:
   pregate forge show <id>        check, fixtures, checker, justificación y reporte, para revisión
   pregate forge promote <id>     vuelve a correr el juez (no confía en el reporte guardado),
                                 copia a .pregate/rules/checks/<área>/<nombre>/ y agrega el alias
                                 a un manifiesto local (p. ej. local/team-conventions)
   pregate forge promote <id> --activate   además agrega la metodología local al preset
   (o aplica la solicitud con `pregate preset apply`, o edita preset.json a mano; nunca el agente)
```

**Insumos en prosa.** Las reglas que un equipo ya tiene escritas en prosa (CLAUDE.md, AGENTS.md, `docs/north-star`, guías internas) **nunca se cargan como reglas** (U1). Son insumo del Forge: el agente lee una práctica, la traduce a check + fixtures y la somete al juez. Así se arma el pack `amarilla/` del piloto (U8). Las `arkrules` de ArkGate, que ya son reglas programadas, entran por el importador [v1] (`pregate import arkgate`), que también produce **borradores** del Forge: ninguna regla importada se activa sin pasar el juez (§15.0).

**Cuarentena de borradores.** Los borradores contienen, a propósito, código que viola reglas (las fixtures `fail` y `trap`). Por eso:
- se escriben solo por las tools del MCP; las herramientas de edición del harness siguen sin poder tocar `.pregate/**`;
- nunca son una fuente de reglas ni están en el scope de evaluación;
- `.pregate/**` está siempre fuera del scope de evaluación, e `install`/`init` lo agregan a los excludes de tsconfig, de los linters y del test runner; las fixtures llevan sufijo no ejecutable (§6.2);
- ningún archivo fuera de los borradores puede importarlos (EVA-FORGE-001, verificado en Pre y en Stop).

### 12.4 El juez

Pipeline de `forge_judge` (y de `pregate rules test` para el catálogo propio). Cada paso es determinista; el primer paso que falla rechaza con su motivo:

1. **Schema.** `check.json`, alias y `fixture.json` validan contra sus schemas. IDs y namespace válidos (`local/…` para borradores del repo).
2. **Forma del checker.** Si `impl.kind` es `custom`, exige `customJustification`. El reporte lo resalta para la revisión humana.
3. **Mínimos de fixtures.** Al menos dos `pass`, dos `fail` y una `trap` por cada familia del corpus aplicable según `observes` y el lenguaje (no solo las que declaró el autor), con los defaults del alias propuesto.
4. **Fixtures.** Cada una produce exactamente el veredicto y las violaciones esperadas.
5. **Determinismo.** Dos corridas, orden de archivos permutado, otro `cwd`, sandbox sin I/O ni reloj ni azar. Cualquier diferencia rechaza.
6. **Binariedad.** El resultado es un conjunto de violaciones; los umbrales son parámetros explícitos. No hay "puntajes" sin umbral.
7. **Corpus estándar de trampas.** Para cada fixture `fail` y cada familia aplicable (según `observes` y lenguaje), el juez aplica las transformaciones del corpus. Cada transformación declara qué **propiedad estructural preserva** (por ejemplo, "renombrar un símbolo preserva el grafo de dependencias y la masa de complejidad"; "pasar los parámetros a un objeto inline preserva la cantidad de información que entra a la función"; "importar por un barrel preserva la arista de dependencia"). Si una variante transformada **pasa** la regla, la propiedad preservada **no cambió** y esa propiedad **figura en `measures` del check**, la regla es **ganable sin mejorar la estructura**: se rechaza y el reporte muestra la variante como evidencia. Esa variante, una vez endurecida la regla, se agrega como fixture `trap/`. La condición sobre `measures` evita rechazar reglas legítimas: `trivial-extract` preserva la masa de complejidad total, pero `fn-max-lines` mide el tamaño **local** de la función (`fn.local-size`), así que extraer funciones sí mejora lo que mide; la fragmentación la vigilan los contrapesos en Stop, no el juez de la regla de tamaño.
8. **Estados intermedios de refactor** (solo si declara `phase: pre`). El juez corre un corpus de estados intermedios legítimos (módulo extraído antes de borrar el original, import hacia un archivo del mismo lote, ciclo transitorio). Si la regla los deniega, tiene que pasar a `phase: stop`.
9. **Presupuesto.** p95 de evaluación por archivo dentro del presupuesto de su fase (≤ 20 ms para `pre`). Si no, pasa a `stop` o se rechaza.
10. **Regresión** (si es una versión nueva de un check existente). Todas las fixtures anteriores siguen pasando.
11. **Satisfacibilidad** con las invariantes activas de la misma dimensión. Si no hay una fixture `pass` que las cumpla todas, es un warning en el reporte, no un rechazo.

Salida: `admissible | rejected`, la lista de motivos, la evidencia y un hash del reporte (check + fixtures + versión del corpus + versión del motor). El hash queda en la `provenance` del check promovido.

### 12.5 Corpus estándar de trampas

Lo mantiene PREGATE, versionado dentro de la fuente `core` (`corpus/`). Es independiente de las fixtures del autor: las fixtures que escribe el agente no alcanzan para admitir una regla (U4).

| Familia | Transformación | Propiedad que preserva |
|---|---|---|
| `rename` | Renombrar símbolos, archivos o paquetes para esquivar listas léxicas | Grafo de dependencias, masa de complejidad |
| `inline-object` / `options-bag` | Agrupar parámetros en un objeto inline o `opts: any` | Información que entra a la función |
| `trivial-extract` | Partir una función en helpers triviales llamados una vez | Masa de complejidad total y camino de llamadas |
| `dynamic-import` | `import()` o `require(variable)` en lugar de un import estático | Arista de dependencia |
| `barrel-reexport` | Importar por un barrel de una capa permitida que re-exporta | Arista de dependencia efectiva |
| `type-indirection` | Alias de tipo, `as unknown as`, `Record<string, any>` | Seguridad de tipos efectiva |
| `generated-marker` / `excluded-path` | Agregar `@generated` o mover a una ruta excluida | Código efectivamente escrito por el agente |
| `inline-suppression` | Comentario de supresión | Violación efectiva |
| `split-across-files` | Repartir la misma lógica en varios archivos | Concepto y acoplamiento |
| `assertion-weakening` | `toBe(5)` → `toBeDefined()`, `expect.anything()`, envolver en `try` | Fuerza de verificación del test |
| `literal-renaming` | `const ONE_HUNDRED = 100` | Literal mágico efectivo |

- Las transformaciones son deterministas y se implementan por lenguaje en cada language pack.
- **Crece con trampas reales.** Una evasión observada en uso (modo sombra, Stop, pre-commit, CI o un etiquetado humano) se agrega primero como fixture `trap/` del check afectado; si es generalizable, se convierte en una transformación nueva del corpus, y todas las reglas se vuelven a juzgar contra la versión nueva del corpus en el CI del catálogo.

### 12.6 Ubicación en el roadmap

**Recomendación: el Forge y el MCP llegan en v1, no en el MVP.** Motivos:
- El Forge congela el formato de reglas. Ese formato tiene que probarse primero con las 18 reglas del MVP, escritas por PREGATE con el mismo pipeline.
- El corpus de trampas necesita trampas reales, y las primeras aparecen en el piloto en modo sombra del MVP.
- Los checkers `custom` necesitan el sandbox determinista, que es trabajo de v1.
- El pre-check por CLI del MVP ya cubre la función de introspección para medir su efecto (brazo H).

**Qué entra en el MVP** porque el Forge lo reutiliza y el catálogo propio lo necesita igual: el formato de carpetas con `check.json` y fixtures, `pregate rules test` (fixtures, incluidas las `trap/` escritas a mano, determinismo y validación de schemas, IDs y namespaces) y la fuente `path` limitada a primitivas y patrones. El corpus estándar de transformaciones llega en v1 con el juez. El catálogo built-in se escribe desde el día 1 como si pasara por el Forge (dogfooding).

### 12.7 Límites honestos

- El corpus es finito. Una regla puede pasar el juez y seguir siendo ganable por una vía que nadie modeló. Mitigación: revisión humana al promover, ciclo de trampas reales y regresión obligatoria.
- El juez no evalúa "el espíritu" más allá de las propiedades que declara cada transformación. Lo que no se puede expresar como propiedad estructural preservada queda fuera de su alcance.
- Las fixtures del agente pueden estar sesgadas a su propio checker. Por eso el corpus es independiente y la promoción vuelve a juzgar.

---

## 13. Arquitectura técnica

### 13.1 Un core, tres caras

```
                     ┌───────────────────────── core PREGATE ─────────────────────────┐
  hook (enforcement) │ rules loader · preset compiler · reconstruct · language packs │
  ─ adaptadores ────►│ → IR · engine · ratchet · decision · feedback · state        │
                     │                                                              │
  CLI (humano) ─────►│ check · explain · preset · rules · forge promote · baseline  │
                     │                                                              │
  MCP (agente) ─────►│ introspección (dry-run) · forge (juez)                       │
                     └──────────────────────────────────────────────────────────────┘
```

Una sola implementación de cada regla y de cada decisión. Las caras solo traducen entrada y salida.

### 13.2 Contratos del core

```ts
interface ProposedChange {
  harness: { id: string; version?: string };            // "claude-code", "grok-build", "codex-cli", …
  tool: { native: string; form: "full" | "oldnew" | "insert" | "patch" };   // forma de la ENTRADA
  change: { kind: "create" | "modify" | "delete" | "move"; fromPath?: string };  // EFECTO del cambio
  path: string;                                         // absoluto: realpath del ancestro existente más profundo
                                                        // + segmentos restantes; base según profile.pathBase
  before: string | null;                                // contenido en disco al momento de la llamada (null = no existe)
  after: string | null;                                 // null SOLO si change.kind = "delete"; si no se pudo
                                                        // reconstruir, lo dice `reconstruction`, no `after`
  reconstruction: "exact" | "tool-will-fail" | "unknown" | "truncated";
  session: { id: string; agentId?: string; permissionMode?: string; interactive?: boolean };
                                                        // interactive: solo si el perfil tiene señal; si falta ⇒ no interactivo
  callId: string;                                       // tool_use_id o equivalente; sintético si el harness no lo manda (§11.3)
  batchId?: string;                                     // patch multiarchivo o lote paralelo
  projectRoot: string;                                  // primer .pregate/ hacia arriba, validado (§4.2, paso 3)
}
// `before` es el disco actual; el `before_sesión` del ratchet lo calcula el core desde la snapshot.

interface ProposedCommand {                            // guard de shell
  harness: { id: string; version?: string };
  session: ProposedChange["session"];
  callId: string;
  commands: string[];                                   // uno o varios (Cline `run_commands`)
  cwd: string; background?: boolean;                    // background: run_in_background, Monitor
  env?: Record<string, string>;                         // asignaciones inline detectadas (VAR=… cmd)
}

interface Decision {
  verdict: "allow" | "deny" | "ask";                    // allow = "sin objeción"; nunca se traduce a un allow nativo
  halt: boolean;                                        // detener el turno, si el harness lo soporta
  violations: Violation[];
  warnings: Violation[];                                // solo introducidas en esta llamada
  reasonCompact: string;                                // ≤ 256 caracteres, autosuficiente
  reasonFull: string;                                   // ≤ 4.000 caracteres
  lockHash: string;
}

interface Violation {
  aliasId: string; checkId: string; path: string; line: number; symbol?: string;
  measured?: number; limit?: number; atSessionStart?: number;
  severity: "deny" | "ask" | "warn"; why: string; fix: string; avoid?: string;
}
```

El adaptador traduce `Decision` con el perfil de capacidades del harness (§14.3): si el harness no soporta `ask` de forma confiable en ese modo, o no hay señal de interactividad, `ask` se vuelve `deny`; si no soporta detener el turno, `halt` se expresa como texto en el motivo y como bloqueo del fin de turno cuando existe.

### 13.3 Stack

- **MVP:** **TypeScript compilado con Bun** (`bun build --compile`) + `@ast-grep/napi` y tree-sitter (gramáticas TS, TSX y JS).
  - Criterio: tiempo hasta el primer valor.
  - Arranque estimado de 10 a 40 ms (a medir).
  - **El día 1 del spike se verifica** que los módulos nativos se empaquetan bien.
  - Ventaja adicional: los harnesses con plugins JS/TS in-process (opencode, Kilo, Amp, Cline, pi) pueden cargar el core como librería, sin lanzar un proceso por llamada [v2].
- **Desde el día 1, las reglas, las fixtures, la IR, el preset y los perfiles de harness son datos** (JSON + JSON Schema). El motor se puede reescribir sin tocar el catálogo.
- **v1:** si el p95 de §13.6 no se cumple, o el tamaño del binario impide incluirlo en el plugin, el motor migra a **Rust** (tree-sitter, `ast-grep-core`, `serde`, `globset`). Precedentes con ese stack: ast-grep, Ruff y Biome.
- **Plataformas:** MVP en macOS y Linux. Windows en v1.1. (El matcher y el guard incluyen `PowerShell` desde el MVP porque existe como opt-in también en macOS y Linux.)
- **El mismo binario** sirve para hook, pre-check, pre-commit, CI y servidor MCP.

### 13.4 Language packs e IR neutral

Un language pack trae: la gramática tree-sitter, los extractores hacia la IR neutral, el resolver de imports del ecosistema, las transformaciones del corpus de trampas para ese lenguaje y los checks idiomáticos (`checks/idiom-<lenguaje>/`).

```ts
interface LanguagePack {
  id: string;                                           // "typescript"
  extensions: string[];
  capabilities: IrCapability[];                         // qué partes de la IR provee
  parse(src: string): Tree;                             // tree-sitter
  extract(t: Tree, file: FileCtx): ModuleIR;
  resolve(i: RawImport, ctx: ProjectCtx): ResolvedPath | Unresolved; // relativos + tsconfig paths (MVP)
  trapTransforms: Record<TrapFamily, Transform>;        // corpus por lenguaje
}

type IrCapability =
  | "modules" | "imports.resolved" | "imports.dynamic" | "surface.exports"
  | "functions.params" | "functions.metrics"            // lines, nesting, cyclomatic, cognitive
  | "classes.members" | "calls.local" | "comments" | "tests.assertions";

interface ModuleIR {
  path: string; language: string;
  imports: { specifier: string; resolved: string | null; kind: "static" | "dynamic" | "type-only" | "re-export" | "require"; line: number }[];
  exports: { name: string; kind: string; line: number }[];
  symbols: { kind: "function" | "method" | "class" | "interface"; symbolPath: string; span: [number, number];
             visibility: "public" | "private" | "protected" | "module";
             params: { name: string; inlineMembers?: number }[];
             metrics: { lines: number; nesting: number; cyclomatic: number; cognitive: number };
             calls: string[] }[];
}
```

- **Reglas sobre la IR** (complejidad, parámetros, dirección de dependencias, ciclos, superficie pública, abstracción de un solo caller) son **portables**: funcionan en cualquier lenguaje cuyo pack provea las capacidades que el check declara en `ir`.
- **Reglas de patrón** (`impl.kind: "pattern"`) declaran un patrón por lenguaje; si falta el del lenguaje, el check queda `unimplemented` para ese lenguaje.
- **Reglas idiomáticas** viven en el pack del lenguaje.
- **Reglas de capas:** usan `imports.resolved` + globs del preset, y siguen re-exports hasta 3 saltos.
  - `import type` cuenta como arista en CA y HEX (configurable).
  - El `exports` de `package.json` en monorepos llega en v1.
- **MVP:** pack TS/JS (`.ts`, `.tsx`, `.js`, `.mjs`). **Siguientes, según demanda:** Python (v1.1), después Go, Java/Kotlin, C#, Rust. El piloto también tiene PLpgSQL, Python y C# (U7): hasta que exista su pack, esos archivos dentro de capas declaradas producen EVA-SCOPE-001 y quedan fuera de capas en el preset del piloto.

### 13.5 Componentes

```
pregate
├─ core/          evaluate(ProposedChange | ProposedCommand | SessionEnd) → Decision; sin I/O de harness
│  ├─ reconstruct/   formas full | oldnew | patch (dialectos: codex, unified; grok-hashline en v2)
│  ├─ engine/        evaluadores por impl.kind: primitive (metric | banned-import | layer-edge | graph |
│  │                 diff | surface) | pattern | custom (sandbox, v1)
│  ├─ ratchet/       conteos (MVP), fingerprints y emparejamiento (v1), baseline
│  ├─ decision/      severidad × enforcement × contadores × capacidades del harness
│  ├─ feedback/      formateador (línea compacta ≤ 256 + detalle), sanitización, i18n, truncado
│  └─ state/         eventos append-only por llamada; contadores derivados
├─ rules/         loader de fuentes (builtin | path | git | npm), namespaces, schemas, versiones, hashes
├─ preset/        compilador: extends, methodologies, scopes, conflictos → resolve obligatorio, lock
├─ lang/          language packs (TS/JS en MVP)
├─ adapters/      claude-code (MVP; perfil grok-build según pregunta 9); familia claude-wire, codex,
│                 gemini (v1); clase post-edit (v1.1); shims JS de plugins (v2)
│  └─ <harness>/  profile.json + contracts/<versión>/*.json
├─ forge/         juez: fixtures, determinismo, corpus, estados intermedios, satisfacibilidad, reporte
│                 (`rules test` en MVP; corpus, MCP y sandbox en v1)
├─ import/        importador de ArkGate: arkrules + ark.config → borradores del Forge y `coexist` (v1)
├─ mcp/           servidor MCP: introspección + forge (v1)
├─ catalog/       fuente core: checks/, methodologies/, backlog/, pairs.json, dimensions.v1.json, corpus/
└─ cli/           ver §13.8
```

### 13.6 Performance budget y fail mode

| Ruta | p50 | p95 | Watchdog interno | `timeout` configurado del hook |
|---|---|---|---|---|
| Pre-tool de edición (≤ 2.000 líneas) | ≤ 50 ms | ≤ 150 ms | 2 s | 10 s efectivos (`install` siempre lo fija de forma explícita, con la clave y la unidad de cada harness: ver abajo) |
| Pre-tool de shell (solo guard) | ≤ 15 ms | ≤ 50 ms | 1 s | 10 s |
| Pre-tool de shell con snapshot puntual [v1] | ≤ 80 ms | ≤ 300 ms | 1 s | 10 s |
| Post-tool [v1] | ≤ 80 ms | ≤ 250 ms | 3 s | 15 s |
| Fin de turno (archivos cambiados; grafo con caché en v1) | ≤ 2 s | ≤ 8 s | 45 s | 60 s |
| MCP `check` [v1] | ≤ 60 ms | ≤ 200 ms | 2 s | — |

**Unidades de timeout.** No son iguales entre harnesses [V]: Gemini, Augment y el file hook de Cline usan **milisegundos** (un `timeout: 10` ahí son 10 ms, fail-open en cada llamada); Qwen interpreta los valores ≥ 1000 como ms; Copilot usa la clave `timeoutSec`. El perfil declara `install.timeoutKey` y `install.timeoutUnit: "s" | "ms"`, y un test de contrato lee el archivo instalado y comprueba el timeout efectivo.

**[V] Hechos críticos:**
- En Claude Code, un PreToolUse que llega al timeout **no bloquea**: "don't count on a stalled hook to act as a gate". El timeout por defecto de `command` es de **600 s**. Exit 1 sin JSON es un error no bloqueante.
- En Grok Build el timeout por defecto es **5 s** y un timeout, un crash o una salida inválida dejan correr la tool. En Codex, Gemini, Qwen, VS Code, Devin, Junie, Kiro, Factory y Augment, los códigos de salida distintos del de bloqueo también fallan abierto (§14.5).

**Respuestas de diseño**
- **Watchdog interno** muy por debajo del `timeout`. Al vencer, se aplica `failMode`:
  - `closed` (**default**, U10): deny por el canal más robusto del harness, con "PREGATE could not evaluate: <cause>" y la instrucción de reportar al usuario. Los contadores evitan el bucle.
  - `ask` (opt-in): el mismo motivo, pero escala al humano; solo en sesiones interactivas de harnesses con `ask` confiable en ese modo. En cualquier otro caso se degrada a `closed`.
  - No existe un modo que deje pasar sin evaluar: el `open-with-recheck` del borrador se elimina porque rompe la garantía de U10.
- **Todo resultado distinto de "sin objeción" sale por el canal más robusto del harness** (en Claude Code, exit 2 + JSON).
  - Se captura toda excepción para emitir siempre una salida.
  - **Riesgo residual:** un abort, un OOM o un SIGKILL no se pueden atrapar. Esos casos los cubren el fin de turno, el pre-commit y CI.
- **Sin daemon en v1.**
  - A e integridad leen solo el archivo tocado. B-local además abre los archivos que siguen los re-exports (hasta 3 saltos) y `tsconfig`; esa lectura entra en el presupuesto, con una caché de resolución en disco.
  - B-global usa una caché de grafo en disco, invalidada por hash o mtime.
  - El daemon se agrega solo si las mediciones superan el p95.

### 13.7 Configuración e instalación del adaptador de Claude Code

**MVP:** `pregate install --harness claude-code` copia el launcher a `.pregate/bin/pregate` (commiteado), escribe los hooks en `.claude/settings.json` y, con `--git-hook`, el pre-commit en `.pregate/git-hooks/` (§10.2.9).
- **Shell form con ruta relativa al repo**, nunca una ruta absoluta de la máquina de quien instaló: `.claude/settings.json` se commitea y una ruta inexistente en la máquina de otro miembro del equipo deja el gate apagado en silencio [V]:
  ```json
  { "type": "command",
    "command": "\"${CLAUDE_PROJECT_DIR:-.}\"/.pregate/bin/pregate hook pre --harness claude-code", "timeout": 10 }
  ```
  El launcher commiteado busca el motor (instalado por `pregate install` o descargado) y **falla cerrado** si no lo encuentra. El `:-.` cubre a los harnesses que no exportan `CLAUDE_PROJECT_DIR` (Gemini y Qwen lo exportan [V]; Grok, Cursor, VS Code y Devin, a verificar con test de contrato) y que corren el hook con `cwd` en la raíz.
- **Invocación sin subcomando.** Grok Build ejecuta los hooks de Claude descartando `args` (su `RawHandler` solo tiene `type`, `command`, `url`, `timeout` y `env`, verificado en el código de `xai-grok-hooks`); por eso se usa shell form con el subcomando dentro de `command`. Además, el binario invocado **sin subcomando**, con stdin no-TTY que contiene un payload de hook (`hook_event_name`, `hookEventName` o la variable `GROK_HOOK_EVENT`), se comporta como `hook auto`: detecta el harness y el evento, y nunca imprime la ayuda ni sale con 0 o 1.
- **Salida de falla cerrada según el evento.** Pre: deny con exit 2. Stop: `decision:block` una sola vez y después `systemMessage` (exit 2 en cada Stop provocaría hasta 8 continuaciones seguidas con "binario no encontrado"). SessionStart: `systemMessage`.

**v1:** el plugin trae `<plugin>/hooks/hooks.json`:

```json
{
  "description": "PREGATE: invariantes de diseño por metodología",
  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/bin/pregate",
                     "args": ["hook", "session-start", "--harness", "claude-code"], "timeout": 15 } ] }
    ],
    "PreToolUse": [
      { "matcher": "Write|Edit|MultiEdit|NotebookEdit|Bash|PowerShell|Monitor",
        "hooks": [ { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/bin/pregate",
                     "args": ["hook", "pre", "--harness", "claude-code"], "timeout": 10,
                     "statusMessage": "PREGATE: validando invariantes…" } ] }
    ],
    "PostToolUse": [
      { "matcher": "Write|Edit|MultiEdit|NotebookEdit|Bash|PowerShell|Monitor",
        "hooks": [ { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/bin/pregate",
                     "args": ["hook", "post", "--harness", "claude-code"], "timeout": 15 } ] }
    ],
    "PostToolBatch": [ { "hooks": [ { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/bin/pregate", "args": ["hook", "post-batch", "--harness", "claude-code"], "timeout": 15 } ] } ],
    "ConfigChange":  [ { "hooks": [ { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/bin/pregate", "args": ["hook", "config-change", "--harness", "claude-code"], "timeout": 10 } ] } ],
    "Stop":          [ { "hooks": [ { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/bin/pregate", "args": ["hook", "stop", "--harness", "claude-code"], "timeout": 60 } ] } ],
    "SubagentStop":  [ { "hooks": [ { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/bin/pregate", "args": ["hook", "stop", "--harness", "claude-code"], "timeout": 60 } ] } ]
  }
}
```

**Notas [V]** (https://code.claude.com/docs/en/hooks y https://code.claude.com/docs/en/plugins-reference):
- **Placeholders.** Se sustituyen tanto en `command` como en cada elemento de `args`.
- **Exec form.** En exec form, `command` tiene que ser un ejecutable real (en Windows, un `.exe`).
  - En macOS y Linux, `bin/pregate` es un launcher POSIX mínimo que elige el binario por plataforma. **Si no lo encuentra, emite la salida de falla cerrada del evento** (deny + exit 2 en Pre; ver arriba), de modo que nunca falla abierto en silencio.
  - El plugin [v1] usa exec form con `args` porque solo lo carga Claude Code; la instalación por settings del MVP usa shell form porque la leen otros harnesses.
  - Windows [v1.1]: lanzador `.exe` nativo, o shell form con `"shell": "powershell"` (a verificar).
- **Matcher.** Un matcher que solo contiene `[A-Za-z0-9_\- ,|]` es una lista exacta. Con otros caracteres se evalúa como RegExp sin anclar.
- **Un solo handler** despacha por `tool_name`: los hooks que coinciden corren en paralelo y no conviene multiplicar procesos.
- **`if` solo sirve para optimizar**: la doc lo describe como *best-effort*.
- **Subagentes.** Los hooks de settings, managed y plugins **también corren dentro de los subagentes**, con `agent_id` y `agent_type`.
- **Rutas del plugin.** `${CLAUDE_PLUGIN_ROOT}` cambia con cada actualización. El estado y la caché van en `${CLAUDE_PLUGIN_DATA}`, que persiste.
- **`userConfig`.** `presetPath` (default `.pregate/preset.json`) llega como `CLAUDE_PLUGIN_OPTION_PRESETPATH` o como `${user_config.presetPath}` (este último solo en exec form).
- **Parseo de stdout.** Se parsea como JSON solo si empieza con `{` y termina con `}`. El exec form evita que se cuele ruido del shell profile.
- **Otros harnesses que leen este archivo.** Grok Build, Devin Local, Cursor (con Third-Party Imports) y VS Code (con `chat.useClaudeHooks`) pueden ejecutar estos hooks con **su propio** payload; también leen `.claude/settings.local.json`, así que instalar ahí no los evita. El argumento `--harness claude-code` hace que el adaptador detecte el desajuste: si PREGATE tiene un perfil para el harness real, lo usa; si no, aplica `failMode` (§14.1). En el MVP la detección es solo "el payload no coincide ⇒ `failMode`"; la autodetección del harness real llega con sus perfiles.
- **Doble instalación.** Cuando un harness que lee `.claude/settings*.json` tiene además su propia instalación PREGATE registrada (adaptador nativo, v1+), el handler instalado para Claude detecta ese harness y sale en silencio (exit 0), porque el nativo ya decide; así no hay decisiones ni contadores duplicados. Si la instalación nativa no está registrada o no responde, no hay silencio: aplica `failMode`. Para Grok Build, la alternativa es `[compat.claude] hooks=false` al instalar el adaptador nativo.
- **Devin** compara el matcher como regex contra nombres en minúscula (`write`, `edit`, `exec`); con `Write|Edit|…` el hook probablemente no se dispara nunca (a verificar con test de contrato). Hasta entonces, Devin queda cubierto solo por pre-commit y CI.

**Checklist de instalación (día 1 del spike):**
1. **MVP:** `pregate install --harness claude-code [--git-hook]` copia el launcher y el binario y escribe los hooks. **v1:** `claude plugin install pregate` (canal por definir). Si el plugin admite binarios por plataforma, van incluidos (a verificar). Si no, se descargan a `${CLAUDE_PLUGIN_DATA}` en SessionStart, y el launcher falla cerrado.
2. **Workspace trust [V]:** en una sesión interactiva, los hooks de settings no corren hasta aceptar el diálogo de trust. `doctor` lo detecta y lo informa. (Codex, Grok Build, Qwen, Copilot y VS Code tienen mecanismos de trust equivalentes.)
3. **Sin preset:** el hook avisa una vez por sesión y queda inactivo.
4. **`pregate doctor`** [v1, al iniciar sesión] verifica hook registrado, binario, preset, lock, fuentes, gramáticas, trust y versión del harness contra la matriz probada, y avisa al humano. **No reemplaza al fail-closed del launcher.**
5. **Definición de hecho:** "de cero al primer deny en menos de 5 minutos con un preset de ejemplo en `enforce`", medido en macOS y Linux (y en Windows en v1.1).
6. **Tests de contrato** contra la versión instalada de cada harness soportado, para cada "(a verificar)" de este documento (§14.7).

### 13.8 CLI

| Comando | Entrega | Qué hace |
|---|---|---|
| `pregate check [paths] [--stdin --path P] [--ratchet] [--staged] [--format agent\|json\|sarif\|text]` | MVP | Evaluación para el pre-check del agente, pre-commit y CI |
| `pregate explain <id>` / `--path <archivo>` | MVP | Fuente, porqué, fixtures y parámetros efectivos; o todas las invariantes que aplican a un archivo y de dónde vienen |
| `pregate preset show` / `compile` | MVP | El contrato en lenguaje humano; compilación con errores de conflicto; escribe el lock en disco. Solo el humano (el guard lo deniega al agente) |
| `pregate preset apply <solicitud>` | MVP | Aplica una propuesta de `.pregate/requests/` (JSON-patch) después de mostrarla: valida, compila y escribe preset y lock. Es el acto humano de activación (U4) |
| `pregate install [--git-hook] [--ci github]` | 0.2.0 | Repo pre-commit/CI only; removes legacy 0.1.0 hooks and launcher (MH-28) |
| `pregate setup` / `update [--version v \| --engine v]` / `uninstall [--purge]` | 0.2.0 | Global installation, explicit verified update, ownership-preserving removal (MH-27) |
| `pregate rules test [ruta]` | MVP | Corre fixtures (incluidas las `trap/`) y determinismo; valida schemas, IDs, namespaces y versiones de una fuente. En v1 suma el corpus estándar de trampas |
| `pregate capture --harness <id>` | v1 | Registra payloads reales del harness para fixtures de contrato (§14.7) |
| `pregate bench` | MVP (interno) | Benchmark de §16 sobre los repos fixture |
| `pregate packs [show <id>]` | v1 | Fichas de metodologías (§8.2) |
| `pregate init` (+ skill `/pregate:init`) | v1 | Asistente: lenguajes, metodologías, resolución confirmada de cada conflicto, capas por carpetas, glosario, ratchet, detección de ESLint y tsconfig. También con flags |
| `pregate preview --preset X` | v1 | Impacto sobre el repo actual antes de comprometerse |
| `pregate preset diff <ref>` | v1 | Diferencias de reglas, umbrales y resoluciones entre versiones |
| `pregate sources update [ns]` | v1 | Actualiza versiones de fuentes mostrando qué veredictos cambian |
| `pregate mcp serve` | v1 | Servidor MCP (introspección + Forge) |
| `pregate import arkgate` | v1 | Lee `arkrules/*.json` + `ark.config.json` y produce borradores del Forge (que tienen que pasar el juez) y la sección `coexist` propuesta; nunca reglas activas sin prueba (§15.0) |
| `pregate forge list \| show \| promote [--activate] \| reject \| suggest` | v1 | Revisión humana, promoción y activación de borradores; sugerencias desde el backlog |
| `pregate baseline` | v1 | Genera el baseline. Lo corre un humano; el guard lo deniega al agente |
| `pregate approve <fingerprint\|--last>` | v1 | Registra una excepción (best-effort local; efectiva en CI con CODEOWNERS) |
| `pregate report` / `label` | v1 | Solo calibración del instrumento: precisión por regla, lazos, evasiones, trampas reales, `net_catches`, corrección beneficiosa; etiquetado humano. **Sin burn-down ni reporte de deuda** (U10, territorio de ArkGate). En el piloto del MVP, el etiquetado se hace a mano sobre los registros de `state/` |
| `pregate doctor` | 0.2.0 | Versions, drift, Codex trust, PATH and canaries for all five adapters (MH-27) |

### 13.9 Escalabilidad y decisiones técnicas descartadas

**Escalabilidad del catálogo.** Las reglas son datos con su prueba. El CI del catálogo corre fixtures, determinismo, corpus de trampas, satisfacibilidad, tope de paráfrasis, contratos de harness y la validación de los ejemplos de preset con el compilador real.

**Descartado:**
- **`updatedInput` (o equivalente) para autocorregir.** **[V]** En Claude Code reemplaza el input completo y, con varios hooks, gana el último en terminar, de forma no determinista. Además, el humano perdería trazabilidad. En Qwen, `updatedInput` figura en la doc pero no se lee [V].
- **ESLint o Semgrep en la ruta síncrona.** Arrancan en 0,3 a 2 s. Quedan como adaptadores opcionales en Stop o CI [v2].
- **Juez LLM en el gate, o LLM propio dentro de PREGATE.** Ver §2 y §18.6.
- **MCP como enforcement**, y tools MCP para suprimir, desactivar o editar reglas o el preset (U4).
- **Reglas en markdown o prosa** (U1).
- **Precedencia implícita entre metodologías** ("gana el último", "gana el más estricto" por defecto).
- **`failMode: open-with-recheck`** y cualquier modo que deje pasar sin evaluar (U10).
- **`ask` sobre `preset.json`** como acto de activación: el agente no puede escribir el preset (U4).
- **`pregate export` a CLAUDE.md o AGENTS.md**: genera prosa y guía "antes", que es territorio de ArkGate (U1, U10).
- **Una tool MCP de edición validada como sustituto de `Edit`/`Write`** en harnesses sin hook pre-edit (la sugiere la investigación): el agente puede no usarla, y el MCP no es enforcement (U4).
- **Comparación automática de las paráfrasis contra los libros**, por copyright y logística.

---

## 14. Harnesses y adaptadores

### 14.1 Principios de los adaptadores (U6)

1. **El core no sabe de harnesses.** Cada adaptador traduce el evento nativo a `ProposedChange` / `ProposedCommand` y la `Decision` a la salida nativa.
2. **Nunca un allow nativo.** "Sin objeción" se expresa con el silencio del harness (exit 0 sin decisión, no lanzar, `action:"allow"` solo donde no existe otra forma de continuar y no saltea aprobaciones).
3. **Primera línea del motivo ≤ 256 caracteres, autosuficiente.**
4. **Lo que no se puede evaluar no pasa (U10).** `reconstruction: unknown | truncated`, payload desconocido o parser que falla ⇒ `failMode` (default `closed`), nunca "sin objeción".
5. **Perfil de capacidades por harness** (`profile.json`): nombres de tools y su forma, dialecto de salida, confiabilidad de `ask` y de la detención, límite del motivo, timeout por defecto, banderas de truncado, archivos de configuración a proteger.
6. **Detección explícita primero.** `install` fija `--harness <id>`. Si el payload no coincide con ese perfil (por ejemplo, Grok Build ejecutando hooks de `.claude/settings.json`), el adaptador intenta autodetectar el harness real por variables de entorno y forma del payload; si hay perfil, lo usa; si no, `failMode` con el motivo "harness payload not recognized" (configurable en `harnesses.unrecognizedPayload`).
7. **Contratos por versión.** Los payloads no documentados se capturan (`pregate capture`) y se fijan como fixtures de contrato por versión del harness antes de soportarlo (§14.7).
8. **pre-commit y CI son obligatorios como red.** Muchos harnesses fallan abierto, y algunos no tienen hooks.

### 14.2 Herramientas nativas y forma normalizada

| Harness | Archivo completo | old/new | Patch | Shell |
|---|---|---|---|---|
| Claude Code | `Write` | `Edit` (`MultiEdit` si llega) | — | `Bash`, `PowerShell` |
| Grok Build | `write` | `search_replace` (old vacío = crear); `edit` (agente opencode, claves a capturar) | `hashline_edit` (anclas), `apply_patch` {patch} (toolset codex) | `run_terminal_command`; `bash` (agente opencode) |
| Codex CLI / IDE | — | — | `apply_patch` (texto en `tool_input.command`; alias de matcher `Edit`/`Write`) | `Bash` (incluye `exec_command`) |
| Gemini CLI | `write_file` | `replace` (matching difuso) | — | `run_shell_command` |
| Qwen Code | `write_file` | `edit` (exacto; old vacío = crear) | — | `run_shell_command` (alias `Bash`) |
| Copilot CLI / cloud | `create` {path, file_text} | `edit` {path, old_str, new_str} | `apply_patch` (modelos Codex; forma a capturar) | `bash`, `powershell` |
| VS Code agent mode | `create_file` | `replace_string_in_file`, `multi_replace_string_in_file` | `apply_patch` {input}; `insert_edit_into_file` (**no reconstruible**) | `run_in_terminal` |
| Cursor | `Write` (payload a capturar) | `StrReplace` (evidencia comunitaria) | — | `Shell`, `beforeShellExecution` |
| Devin Local / CLI | `write` | `edit` | `apply_patch` | `exec` |
| Junie CLI | `Write` | `Edit` (probable) | — | `Bash` |
| Kiro | `fs_write`/`write` create | str_replace; insert / append (forma `insert`) | — | `shell`, `execute_bash` |
| Augment | `save-file` (a capturar) | `str-replace-editor` (pares numerados) | — | `launch-process` |
| Factory Droid | `Create` | `Edit` | `ApplyPatch` {input} | `Execute` |
| Cline | `editor` sin `old_text` (archivo nuevo) | `editor` {old_text, new_text}; `insert_line` (forma `insert`) | `apply_patch` {input} | `run_commands` (lista) |
| opencode / Kilo | `write` | `edit` | `apply_patch` {patchText} | `bash` |
| Amp | `create_file` | `edit_file` | `apply_patch` | `shell_command` |
| pi | `write` | `edit` {edits[]} contra el original | — | `bash` (y `user_bash`) |

### 14.3 Perfil de capacidades (ejemplo: Grok Build)

```jsonc
// adapters/grok-build/profile.json
{
  "$schema": "https://<dominio-a-definir>/schema/harness-profile.v1.json",
  "id": "grok-build",
  "dialect": "claude-wire",                       // familia que comparte forma de entrada y salida
  "detect": { "env": ["GROK_HOOK_EVENT", "GROK_SESSION_ID"], "payloadKeys": ["toolName", "toolInputTruncated"] },
  "events": { "sessionStart": "SessionStart", "preTool": "PreToolUse", "postTool": "PostToolUse", "turnEnd": "Stop" },
  "tools": {
    "write":                { "form": "full",   "path": "file_path", "content": "content" },
    "search_replace":       { "form": "oldnew", "path": "file_path", "old": "old_string", "new": "new_string",
                              "all": "replace_all", "match": "exact", "emptyOld": "create" },
    "apply_patch":          { "form": "patch",  "dialect": "codex", "field": "patch" },
    "hashline_edit":        { "form": "patch",  "dialect": "grok-hashline", "supported": false },  // v2 → unknown
    "edit":                 { "form": "oldnew", "keys": "a capturar", "supported": false },        // agente opencode → unknown
    "run_terminal_command": { "form": "shell",  "command": "command" },
    "bash":                 { "form": "shell",  "command": "command" }                               // agente opencode
  },
  "pathBase": "absolute",                         // absolute | cwd | project_path | plugin.directory
  "ask": { "modes": ["default", "auto", "plan"], "headlessSignal": null, "default": "deny" },
                                                  // -p y ACP no verificados; sin señal de interactividad ⇒ deny
  "output": { "deny": "json+exit2", "stderr": "reasonFull", "reasonMaxChars": 256,
              "haltReliable": null, "contextOnDeny": false },
  "unverified": ["halt", "ask.headless", "env.CLAUDE_PROJECT_DIR"],
  "limits": { "truncationFlag": "toolInputTruncated", "defaultTimeoutSec": 5,
              "failOpenOn": ["timeout", "crash", "malformed-output", "unknown-decision"],
              "ignoresArgs": true },                // RawHandler sin `args`: shell form obligatoria
  "install": { "path": ".grok/hooks/pregate.json", "timeoutKey": "timeout", "timeoutUnit": "s", "timeout": 10,
               "matcher": "write|search_replace|hashline_edit|apply_patch|edit|run_terminal_command|bash" },
  "protect": [".grok/hooks/**", ".grok/config.toml", "~/.grok/hooks/**", "~/.grok/config.toml"],
  "contracts": ["contracts/1.0.45/", "contracts/1.0.46/"]
}
```

### 14.4 Matriz de harnesses (resumen al 2026-10-01)

Fuente: `docs/research/harnesses-2026-10-01.json` y `harnesses-grok-2026-10-01.json` (verificación contra documentación oficial y código fuente; los JSON tienen las URLs).

| Harness | Evento pre-edit | Payload de edición | Bloqueo | Compatibilidad Claude | Confianza | Notas / caveats |
|---|---|---|---|---|---|---|
| **Claude Code** (v2.1.287) | `PreToolUse` | `Write` {file_path, content}; `Edit` {old_string, new_string, replace_all} | exit 2 + JSON deny; el reason lo ve el agente | nativo | alta [V] | Timeout y crash no bloquean; timeout default 600 s; `ask` solo en modos interactivos; `MultiEdit` no documentado |
| **Grok Build** (xAI, CLI `grok` 1.0.45/46) | `PreToolUse` (camelCase + alias snake_case) | `write` completo; `search_replace` old/new; `edit` (agente opencode); `hashline_edit` por anclas; `apply_patch` {patch} (toolset codex) | JSON deny (o `hookSpecificOutput`) o exit 2; el modelo ve "Hook denied: <reason>" | **Lee `.claude/settings*.json`** (usuario siempre; proyecto con folder trust) y `.cursor/hooks.json`; los matchers de Claude se expanden por alias, pero `tool_name` llega con el nombre nativo | alta | **Reason recortado a 256 caracteres. `toolInput` > 128 KiB llega truncado** (`toolInputTruncated`). **Timeout default 5 s.** Fail-open ante timeout, crash, salida inválida o decisión desconocida. `additionalContext` llega solo después de correr la tool. `edit`/`bash` del agente opencode no tienen alias. **Descarta `args` de los hooks de Claude** (shell form obligatoria) |
| **Codex CLI** (0.160; hooks estables desde 0.124) | `PreToolUse` (matcher `apply_patch`, alias `Edit`/`Write`) | `apply_patch`: texto crudo del patch (Add/Update/Delete/Move, multiarchivo, hunks por contexto) | exit 2 + stderr, o JSON deny (reason no vacío, sin claves extra) | formato parecido en archivos propios (`.codex/hooks.json`, `config.toml`); plugins reciben `CLAUDE_PLUGIN_ROOT` por compatibilidad | alta | **Fail-open** ante error, timeout o JSON inválido; **`ask`, `continue:false` y `stopReason` hacen fallar el hook y la tool sigue**. Requiere trust. Se observó bypass por `perl -pi`: el guard de shell es obligatorio. `write_stdin` no dispara PreToolUse |
| Codex IDE / Codex Cloud | IDE: igual que el CLI. Cloud: sin hooks de usuario | igual que el CLI | igual que el CLI | igual que el CLI | media | IDE: bug abierto de hooks que no corren en threads de VS Code (#33413) y trust que saltea en silencio. Cloud: solo CI sobre el PR |
| **Gemini CLI** (0.63) | `BeforeTool` | `write_file` completo; `replace` {old_string, new_string, instruction} | JSON {decision:"deny", reason} o exit 2 | formato propio (`.gemini/settings.json`); exporta `CLAUDE_PROJECT_DIR` | alta | `replace` busca exacto → flexible → regex → fuzzy: la reconstrucción exacta puede no coincidir. `ModifyWithEditor` cambia args después del hook. Otros exit: fail-open. stdout solo con el JSON |
| **Qwen Code** (0.24) | `PreToolUse` (acepta alias `Write`/`Edit`/`Bash`) | `write_file` completo; `edit` old/new exacto (old vacío crea) | `hookSpecificOutput` deny o exit 2 | **formato y nombres de Claude** en `.qwen/settings.json` | alta | **`allow` saltea la aprobación: no emitirlo.** Fail-open ante error o timeout. PreToolUse corre después de la aprobación del usuario (ve el input final). API cambiando |
| **GitHub Copilot CLI** (1.0.91; requerir ≥ 1.0.70) | `preToolUse` / `PreToolUse` | `create` {path, file_text}; `edit` {path, old_str, new_str}; `apply_patch` (forma no documentada) | JSON `permissionDecision: deny` o exit 2 | **acepta estructura y eventos PascalCase de Claude** (≥ 1.0.21) | alta (claves de args: media) | En camelCase, `toolArgs` es un string JSON. **Timeout fail-open (30 s)**; otros exit no cero fail-closed (≥ 1.0.57). Matcher respetado desde 1.0.36; subagentes desde 1.0.49 |
| Copilot cloud agent | `preToolUse` | igual que el CLI (inferido) | igual que el CLI | solo `.github/hooks/*.json` en la rama default | media | Solo el campo `bash`; termina en un PR, así que CI cubre |
| **VS Code agent mode** (Preview) | `PreToolUse` | `create_file` completo; `replace_string_in_file`; `multi_replace_string_in_file`; `apply_patch`; `insert_edit_into_file` (**no reconstruible**) | JSON deny o exit 2 | **lee `.claude/settings*.json`** con `chat.useClaudeHooks` | alta | **Ignora el matcher:** el script filtra por `tool_name`. Otros exit: fail-open. Timeout 30 s. Requiere workspace trust |
| **Cursor** (≥ 2.4) | `preToolUse` (matcher `Write`/`Delete`) | **Write sin payload documentado** (evidencia comunitaria contradictoria: `StrReplace` con `path`, `old_string`, `new_string`) | exit 2 o JSON `permission: deny` + `agent_message` | **importa hooks de Claude** con Third-Party Imports (mapea `Edit`→`Write`) | media | **Solo `deny` es efectivo** (`ask`/`allow` no se aplican; bug abierto). `failClosed:true` disponible. Capturar payload por versión |
| Devin Local / Devin CLI | `PreToolUse` (regex) | `edit`/`write`/`apply_patch` sin documentar | exit 2 o JSON `decision: block` | **lee `.claude/settings*.json`** por defecto | media | Fail-open en otros exit. Matcher regex contra nombres en minúscula: el matcher de Claude probablemente no dispara (a verificar). Windsurf Cascade (legacy) fue removido el 2026-09-08: no invertir |
| JetBrains Junie CLI (EAP) | `PreToolUse` | `Write` {file_path, content} (evidencia secundaria); `Edit` probable old/new | exit 2 o JSON `decision` | formato Claude en `~/.junie/config.json` (la config de proyecto se ignora) | media-alta | Timeout 10 s; fail-open; sin PostToolUse; los hosts ACP y server no invocan hooks |
| Kiro (IDE 1.x / CLI 3.x) | `PreToolUse` (`write`/`fs_write`) | sin documentar (ancestro: create \| str_replace \| insert \| append) | solo exit 2 + stderr | formato propio (`.kiro/hooks/*.json`) | alta (mecanismo) / baja (payload) | El IDE pasaba contexto vacío hasta ~1.0.116; la CLI con `--no-interactive` no carga hooks; exit 2 no bloqueaba en Windows (2.2.2) |
| Augment (Auggie CLI + IDE) | `PreToolUse` | `str-replace-editor` {path, old_str_1, new_str_1, …}; `save-file` sin documentar | exit 2 o JSON deny (solo `deny` soportado) | formato tipo Claude (`.augment/settings.json`) | alta | Hooks de proyecto solo en la CLI. PostToolUse trae `file_changes` completos (útil para re-evaluar) |
| Factory Droid | `PreToolUse` | `Create` {file_path, content}; `Edit` old/new (claves sin verificar); `ApplyPatch` {input} | exit 2 o JSON deny | formato casi idéntico a Claude (`.factory/hooks.json`) | alta | Fail-open en otros exit |
| Cline (VS Code 4.x, CLI 3.x, SDK) | file hook `PreToolUse` / plugin `beforeTool` | `editor` {path, old_text, new_text}; `apply_patch` {input} | file hook: `cancel` **detiene todo el run sin feedback**; plugin: `{skip:true, reason}` vuelve al modelo | no | alta | Usar el plugin, no el file hook. File hooks fail-open. `--yolo` apaga hooks. Plugins en VS Code sin confirmar |
| opencode (1.18) / Kilo Code (7.x) | plugin JS `tool.execute.before` | `write` {filePath, content}; `edit` {filePath, oldString, newString, replaceAll}; `apply_patch` {patchText} (con modelos `gpt-` solo patch) | `throw new Error(reason)` | no | alta | `opencode run` (headless) puede no disparar; la API v2 de plugins rompe handlers v1; sin `cwd`. Kilo: `KILO_PURE=1` apaga plugins |
| Amp (Neo) | plugin `tool.call` | `create_file` / `edit_file` / `apply_patch`: esquemas sin documentar | `{action:"reject-and-continue", message}` | no | media | En `amp -x` el turno puede arrancar antes de cargar plugins (`--plugin-ready-timeout`); orden entre plugins no definido |
| pi (earendil-works/pi; incluye pi-grok-cli) | extensión `tool_call` | `write` {path, content}; `edit` {path, edits[{oldText, newText}]} contra el original | `{block:true, reason}`; una excepción bloquea (fail-closed) | no | media-alta | `!cmd` del usuario va por `user_bash`; tools de extensiones con esquema propio |
| grok-cli comunitario (superagent, `grok-dev` 1.1.7) | `PreToolUse` **solo para `bash`** | `write_file`/`edit_file` sin hook | exit 2 (solo stderr llega al modelo) | formato tipo Claude en user settings; no lee `.claude/` | alta | Parcial: requiere un parche upstream (~10 líneas) o solo pre-commit |
| **Sin hook pre-edit**: Aider, Continue (infra sin cablear), Zed (solo `tool_permissions`), Roo Code (discontinuado), Junie en IDE / AI Assistant (ACP sin hooks), forks legacy de grok-cli, Codex Cloud | — | — | — | — | alta | **Solo pre-commit/CI.** En Aider, además, `lint-cmd = pregate check` devuelve el motivo al modelo después de escribir |

**Familias de dialecto.** `claude-wire` (Claude Code, Grok Build, Qwen, Factory, Copilot en PascalCase, VS Code, Devin, Junie CLI, Augment): mismo esquema de entrada y salida con nombres de tools y claves distintos, que el perfil traduce. `codex` y `gemini`: dialectos propios por comando. `js-plugin` (opencode, Kilo, Amp, Cline plugin, pi): shim JS/TS in-process.

### 14.5 Caveats y respuesta de diseño

| Caveat | Harnesses | Respuesta |
|---|---|---|
| **Fail-open** ante timeout, crash o salida inválida | Claude Code, Grok Build, Codex, Gemini, Qwen, VS Code, Devin, Junie, Kiro, Factory, Augment, Cline (file hooks), Copilot (solo timeout), Cursor (por defecto) | Watchdog interno muy por debajo del timeout; toda decisión sale por el canal más robusto; `failClosed:true` donde existe; `failMode: closed` por defecto; launcher fail-closed; **pre-commit y CI obligatorios desde el MVP** (U10); post-edit con revert donde no hay pre-edit [v1.1]; `doctor` con canario al iniciar sesión |
| **Timeout corto** | Grok 5 s, Junie 10 s, Copilot 30 s, VS Code 30 s | `install` fija un timeout explícito ≥ 10 s; p95 objetivo 150 ms |
| **Unidades y claves de timeout distintas** | Gemini, Augment, Cline file hook (ms); Qwen (≥ 1000 = ms); Copilot (`timeoutSec`) | `install.timeoutKey` + `install.timeoutUnit` en el perfil; test de contrato del timeout efectivo |
| **`args` descartados** | Grok Build ejecutando hooks de Claude | Shell form con subcomando en `command`; binario sin subcomando ⇒ `hook auto` (§13.7) |
| **Doble ejecución** | Grok, Cursor, VS Code y Devin con adaptador nativo además de `.claude/settings*.json` | El handler de Claude sale en silencio solo si la instalación nativa está registrada; Grok: `[compat.claude] hooks=false` |
| **Motivo recortado** | Grok Build (256 caracteres) | Primera línea autosuficiente ≤ 256; el detalle, por pre-check o `explain_rule` |
| **Input truncado** | Grok Build (> 128 KiB) | `file_path` extraído del prefijo con parser tolerante: fuera de scope ⇒ sin objeción; si no ⇒ `failMode` (deny), nunca "sin objeción". Mensaje: crear el archivo chico y extenderlo con `search_replace` de menos de 128 KiB |
| **`ask` no confiable o dependiente del modo** | Codex (`ask` falla abierto), Cursor (no se aplica), Augment (solo deny), Kiro (sin JSON), Qwen (modos default/plan/auto_edit/auto/yolo; en headless o ACP equivale a deny), Grok (`-p` y ACP sin verificar) | Perfil `ask: {modes, headlessSignal, default: "deny"}` por modo nativo; sin señal de interactividad ⇒ `deny` |
| **Detención del turno no confiable** | Codex (`continue:false` falla abierto) | `deny` con texto de detención + bloqueo en el fin de turno |
| **`allow` nativo saltea aprobaciones** | Qwen, Claude Code, Copilot, Factory | Nunca se emite |
| **Matcher ignorado** | VS Code | Un único handler; el adaptador filtra por `tool_name` |
| **`tool_name` nativo distinto del alias Claude** | Grok Build (`search_replace`…), Cursor (`Write` por `Edit`) | El perfil mapea nombres nativos; matchers con nombres nativos (o `*` + filtro) |
| **Payload no documentado** | Cursor (Write), Devin, Kiro, Amp, Copilot (`apply_patch`), Factory (claves de Edit), Augment (`save-file`) | `pregate capture` + fixtures de contrato por versión; hasta tener contrato, `unknown` ⇒ `failMode` |
| **Matching difuso del harness** | Gemini `replace` | Si el match exacto falla ⇒ `unknown` ⇒ deny de forma ("resend as exact replacement"); re-evaluación en `AfterTool` [v1] |
| **Args o contenido modificables después del hook** | Gemini (`ModifyWithEditor`; `write_file` hace unescape con modelos no Gemini 2/3) | `mayRewrite` en el perfil; re-evaluación obligatoria en `AfterTool` + fin de turno + pre-commit |
| **Codex: exit 2 ignora stdout y JSON rechaza claves extra** | Codex, Qwen (exit 2) | Perfil de Codex: exit 2 + stderr con el motivo, stdout vacío |
| **Bloqueo sin feedback al modelo** | Cline file hooks | Adaptador como plugin (`beforeTool` → `skip` + `reason`) |
| **Hooks que no disparan en algunos modos** | `opencode run`, Kiro `--no-interactive`, Codex IDE (#33413), Junie ACP, Amp `-x` | Canario en `doctor`; pre-commit y CI |
| **Interruptores de apagado** | `disableAllHooks`, `GROK_CLAUDE_HOOKS_ENABLED`, `KILO_PURE`, `--yolo`, `chat.useHooks`, archivos de hooks | Rutas protegidas por perfil + guard de shell (§10) |

### 14.6 Plan de adaptadores por fase

| Fase | Adaptadores | Por qué |
|---|---|---|
| **0.2.0** | **Claude Code, Codex CLI, Cursor CLI, Grok Build, Antigravity (`agy`)** | Captured payload contracts; pure adapters, strict Codex patch parser, one registration per harness and dialect-specific denies (MULTI-HARNESS MH-01–14). Real CLI §6.3 verification is required before installation on the user's machine |
| **v1 (ola 1)** | Gemini CLI, Qwen Code, Copilot CLI | Enter with captured and verified pre-edit contracts |
| **v1.1 (ola 2)** | Factory Droid, Augment, VS Code agent mode, Devin Local/CLI, Junie CLI, Kiro | Enter with captured and verified contracts; post-edit with revert where pre-edit is unavailable |
| **v2 (ola 3)** | Plugins in-process: opencode, Kilo, Amp, Cline (plugin), pi. `hashline_edit` de Grok. Copilot cloud agent. Codex IDE cuando se resuelva #33413 (mientras tanto, post-edit con revert) | Requieren shim JS/TS (aprovecha el core en TS) y APIs de plugins con cambios activos |
| **Siempre** | pre-commit y CI [MVP] para todos, incluidos los harnesses sin hook. Aider: guía de `lint-cmd` [v1] | Es la red común frente a fail-open y ausencia de hooks, y parte de la garantía (U10) |

### 14.7 Contratos por versión y captura

- `pregate capture --harness <id>` instala un hook de solo registro (sin decisión) que guarda los payloads reales en el directorio de datos de PREGATE. Los payloads incluyen código, así que quedan locales.
- Un caso capturado se convierte en **fixture de contrato**: `adapters/<harness>/contracts/<versión>/<caso>.json` con el payload crudo, el `ProposedChange` esperado y la salida nativa esperada para un deny. El CI de PREGATE los corre en cada cambio.
- `doctor` compara la versión instalada del harness con las versiones probadas. Una versión sin contrato produce un aviso; un payload que no coincide con el perfil produce `failMode`.
- Los "(a verificar)" de cada adaptador se cierran con un contrato, no con lectura de documentación.

### 14.8 Harnesses sin hook pre-edit: post-edit con revert y red de commit

Aider, Continue, Zed, Roo Code, Junie dentro del IDE y Codex Cloud no tienen un punto de bloqueo pre-edit programable. Otros lo tienen pero sin payload reconstruible en algunas tools (Cursor `Write`) o con hooks que no corren en algunos modos (Codex IDE, #33413).

**Clase de adaptador post-edit (revert + feedback) [v1.1] (U6).** Donde hay un evento post-edit programable pero no un pre-edit utilizable, el adaptador evalúa **después** de escribir: si hay violación, **revierte** el archivo a `before` (snapshot tomada en el pre-tool si existe, o la de sesión) y devuelve el motivo al modelo con "This write was reverted: …". Es más débil que el pre-edit (el archivo existió en disco unos milisegundos y otro proceso pudo leerlo), así que pre-commit y CI siguen siendo obligatorios.

| Harness | Evento post-edit | Revert | Feedback al modelo | Fase |
|---|---|---|---|---|
| Cursor | `afterFileEdit` {file_path, edits} | Sí (snapshot o git) | `agent_message` | v1.1 |
| Codex IDE (mientras #33413 siga abierto) | `PostToolUse` | Sí | `decision: block` + reason | v2 |
| opencode / Kilo / Amp | `tool.execute.after`, `file.edited` | Sí | según la API de plugins | v2 (si el pre-edit no alcanza) |
| Aider | `lint-cmd` después de escribir | **No** (solo feedback; `/undo` lo decide el usuario) | sí | v1, guía |
| Continue, Zed, Roo Code, Junie en IDE, Codex Cloud | ninguno programable | No | No | — |

Para los harnesses de la última fila, y para todos como red, PREGATE cubre con:
- **pre-commit** (`pregate check --staged --ratchet`) [MVP];
- **CI** (`pregate check --ratchet`) [MVP plantilla mínima; v1 SARIF y plantillas];
- de forma cooperativa, el MCP de introspección, que el agente puede consultar pero no está obligado a usar (no es enforcement, U4).

Se descarta exponer una tool MCP de edición validada como sustituto de `Edit`/`Write`: el agente puede no usarla. La documentación del producto lo dice sin rodeos: en estos harnesses, PREGATE no es un gate de pre-escritura sino un gate de commit.

---

## 15. Prior art y diferenciación

### 15.0 ArkGate: la generación anterior (U9, U10)

ArkGate (npm `arkgate`) es del mismo autor y está en producción en amarilla-platform como hook PreToolUse. No es prior art de terceros: PREGATE es su evolución. Las dos herramientas pueden convivir, con responsabilidades distintas:
- **ArkGate:** ciclo de vida completo. Antes (explorar, planificar, ubicar), durante y después (fix, coverage, CI, explicar, reportes de deuda).
- **PREGATE:** una sola responsabilidad, que el código que viola el preset nunca se escriba. Autosuficiente y componible.

| | Qué |
|---|---|
| **Se hereda** (lo que funcionó en producción) | Hook PreToolUse que deniega antes de escribir; ratchet de warnings sobre legado; los ~240 tests de arquitectura y ratchet de `src/test/lint` como fuente de invariantes ya programadas y de fixtures; capas declaradas en configuración |
| **Se generaliza** | Capas y `arkrules` → presets por metodología con checks canónicos y aliases; un harness → core sobre `ProposedChange` con adaptadores; un lenguaje → language packs con IR neutral; reglas escritas a mano → Forge con juez determinista y corpus de trampas |
| **Se descarta en PREGATE** (queda en ArkGate) | Reportes, burn-down, coverage, guía previa en prosa y flujos de ciclo de vida. PREGATE solo conserva la verificación de las mismas invariantes en pre-commit y CI, como parte de la garantía |

**Convivencia sin doble enforcement.** Un mismo invariante lo hace cumplir una sola herramienta, declarado en `coexist.arkgate.ownedByArkgate` (§8.3, §8.5 regla 12). En el MVP la lista es manual; en v1, `pregate import arkgate` lee `arkrules/*.json` + `ark.config.json`, propone las invariantes equivalentes como borradores del Forge (que tienen que pasar el juez, U2) y detecta superposiciones: si alguna no tiene dueño, el preset no compila. El hook de ArkGate se reemplaza cuando todas sus reglas tienen equivalente admitido en PREGATE (pregunta abierta sobre el calendario, §19).

**Pack del piloto (U8).** El pack `amarilla/` se arma con el Forge tomando como insumo `docs/north-star`, CLAUDE.md, AGENTS.md y las `arkrules`; la prosa nunca se carga como regla (U1). Las eslint-rules con warning-ratchet del repo son candidatas a adaptarse como checks o a convivir (pregunta abierta).

### 15.1 Otras herramientas

| Herramienta | Qué hace | Relación con PREGATE |
|---|---|---|
| ESLint (+ sonarjs), Biome, Ruff, PMD, Error Prone | Lint por archivo con miles de reglas | Referencia de semántica y umbrales. Adaptadores en Stop o CI y exportación de configuración [v2]. No están organizados por metodología |
| dependency-cruiser, import-linter, ArchUnit/ArchUnitTS | Capas y ciclos sobre el grafo completo | Inspiración y exportación [v2]. La arista local se resuelve en casa (barato, en Pre); los ciclos, en Stop o CI. Una configuración de capas vacía falla cerrado |
| ast-grep / tree-sitter | Motor estructural multilenguaje con reglas YAML | **Se reutiliza como motor**; los patrones se embeben en `check.json` |
| SonarQube (plugin para Claude Code) | Analiza **después** de escribir (PostToolUse), es pago, y su gate "for Agentic AI" relaja a propósito la mantenibilidad | Diferenciación directa: PREGATE bloquea antes y prioriza mantenibilidad |
| CodeScene CodeHealth MCP | Métrica única, no-regresión, vía MCP | **Se copia la idea del ratchet.** Diferencia: metodologías elegibles y un enforcement que el agente no decide si invoca (el MCP de PREGATE es opcional y no es enforcement) |
| Semgrep (Guardian), Codacy Guardrails | Foco en seguridad, con hooks o MCP | Complementarios; un pack `secure` podría delegar en ellos |
| TDD Guard (hoy Probity, multi-harness) | PreToolUse que bloquea violaciones de TDD validando con LLM | Prueba que "deny y autocorrección" funciona y que el patrón se lleva a varios harnesses. PREGATE lo hace de forma determinista y para N metodologías |
| Archie | Reglas inferidas del repo por LLM, hooks previos a la edición | El competidor conceptual más cercano. PREGATE usa reglas trazables a libros, con prueba ejecutable, presets combinables y determinismo |
| Factory ESLint plugin | Reglas "agent-native" para JS y TS | Reutilizable como pack opcional |
| rulesync, Cursor rules, AGENTS.md | Reglas en prosa en el prompt, sin enforcement | PREGATE no genera esos formatos (U1, U10): hace cumplir. La prosa existente sirve como insumo del Forge |
| Qlty, Trunk, MegaLinter | Orquestación de linters en CI | No resuelven la ruta caliente del hook ni el feedback para LLMs |

### 15.2 La alternativa casera: "¿por qué no ESLint + un hook de 30 líneas?"

Es el competidor real: un `eslint --stdin` en PreToolUse que deniega con su salida.

| Eje | ESLint + hook casero | PREGATE |
|---|---|---|
| Reglas que solo existen como metodología (capa de entidades sin ORM, VO inmutable, caso de uso con un solo método, core sin reloj) | Hay que escribir plugins propios o dependency-cruiser aparte; sin noción de metodología | Manifiestos elegibles; dos presets bloquean cosas distintas |
| Combinar metodologías con conflictos | Configuración manual sin detección de conflictos | Dimensiones, resolución explícita obligatoria, lock con procedencia |
| Reglas nuevas | Código de plugin sin prueba obligatoria | Forge: check + fixtures + corpus de trampas + juez determinista |
| Legado | Bloquea por deuda heredada, o hay que mantener supresiones masivas | Ratchet contra la sesión y el baseline |
| Mensaje para el LLM | Texto para humanos, de a una regla; sin contrapesos ni control de bucle | Todas las violaciones, línea compacta ≤ 256, cómo corregir, qué evitar, contadores, escalamiento |
| Anti-evasión | Ninguna | Pack de integridad, guard de shell, fin de turno contra la snapshot, pre-commit |
| Varios harnesses | Un script por harness, cada uno con su payload | Un core, perfiles por harness, contratos por versión |
| Hook y CI | Configuraciones separadas | Un binario y un lock |

**Si el benchmark muestra que PREGATE no supera a esta alternativa (brazo E, §16), se cambia de rumbo antes de v1.**

### 15.3 Diferenciadores
1. Metodologías elegibles y combinables en un preset JSON, con conflictos resueltos de forma explícita por el humano y trazabilidad hasta el libro.
2. Bloqueo determinista antes de escribir, dentro de un presupuesto de latencia.
3. Reglas como datos con prueba ejecutable, y un Forge donde el agente propone y PREGATE juzga sin LLM propio.
4. Mensajes diseñados para que el LLM se corrija, con control del bucle.
5. Ratchet contra la sesión, que lo vuelve adoptable en repos legados.
6. Anti-evasión explícita.
7. El mismo preset y las mismas decisiones en varios harnesses, y una sola fuente para hook, pre-commit y CI.

### 15.4 Reusar o reimplementar
- **No** se reimplementan parsers ni matching estructural: se usan tree-sitter y ast-grep. El parser del patch de Codex se porta del crate open source.
- **Sí** se escriben en casa:
  - las reglas, como datos con fixtures;
  - la IR neutral y sus extractores;
  - el chequeo de capas local;
  - el ratchet;
  - los adaptadores de harness;
  - el juez y el corpus de trampas.

  Todo lo que corre en Pre tiene que entrar en menos de 150 ms y con la semántica de sesión.
- ESLint, Ruff y Semgrep llegan en v2 como adaptadores en Stop o CI y como exportación.

### 15.5 Evidencia empírica (a verificar antes de citarla en público)
- arXiv 2605.02741 reporta que el deterioro de calidad del código generado no se mitiga con más prompting.
- arXiv 2510.03029 encuentra más *code smells* a medida que crece la complejidad de la tarea.
- **Contraevidencia:** ResearchGate 393853113 encuentra menos smells en el código de LLMs para la mayoría de los tipos de problema.
- **Implicancia:** posicionar PREGATE por **coherencia arquitectónica y contrato de diseño**, no por estilo.

---

## 16. Métricas de éxito y validación

### 16.1 Calidad del instrumento (definiciones operacionales)

| Métrica | Definición | Objetivo |
|---|---|---|
| **Precisión por regla `deny`** | Denegaciones reales etiquetadas por humanos (`pregate label`) como correctas, sobre el total | ≥ 90 %; si no, la regla **sale del catálogo** (vuelve al backlog con `status: forging`) o se parte en una regla más chica. No queda como `warn` |
| **Corrección beneficiosa por regla** | Pares (contenido denegado, contenido aceptado finalmente en el mismo archivo), evaluados a ciegas: ¿el aceptado es más mantenible? | ≥ 70 % de pares mejores y ≤ 15 % peores; si no, la regla sale del catálogo o se parte, aunque tenga buena precisión: es ganable sin mejorar la estructura |
| **Corrección en un intento** | Después de un deny, la siguiente escritura del mismo archivo elimina las violaciones denegadas, no introduce nuevas y **no dispara ningún detector EVA, de shell ni de scope** | ≥ 70 % |
| **Lazo** | 3 o más denegaciones sobre (archivo, regla) sin progreso | < 5 por cada 100 denegaciones, y reportado por sesión |
| `evasion_rate` | Detecciones de EVA, shell, scope y solicitudes por cada 100 denegaciones | Debe bajar entre versiones |
| `real_trap_rate` | Trampas reales nuevas (que una regla no detectó y luego se agregaron como fixture `trap/`) por cada 100 denegaciones | Debe bajar entre versiones de cada regla |
| `envelope_declarations` | Veces que el agente declaró que la tarea no entra en el sobre y se detuvo, y cuántas el humano confirmó como correctas | Informativo; alto + confirmadas = preset demasiado estricto para el repo |
| `abandonment_rate` | Tareas en las que el agente se detiene sin declarar sobre ni falso positivo | A calibrar |
| `task_shrink` | Tests ocultos que fallan solo en el brazo con gate | ≈ 0 |
| `thrash_ratio` | Tamaño del diff después del deny / tamaño de la edición denegada | A calibrar (un valor alto indica reescritura en pánico) |
| `net_catches` | Violaciones que llegaron a pre-commit o CI sin haber sido denegadas en el hook, por harness | Debe tender a 0 en harnesses con adaptador; mide fail-open y bypass reales |
| Paridad entre harnesses | Fixtures de contrato en verde y misma `Decision` para el mismo cambio en todos los harnesses soportados | 100 % |
| Forge | Tasa de admisión, motivos de rechazo, reglas promovidas que después recibieron una trampa real | Informativo; la última debe bajar con cada versión del corpus |
| Tokens por deny resuelto | — | A calibrar |
| `user_conflict_escalations` | Veces que el agente preguntó ante un conflicto entre el preset y una instrucción | Informativo |
| Latencia | p50 y p95 de §13.6 en los repos fixture | Se cumple |

### 16.2 Valor: ¿mejora la mantenibilidad?

**Benchmark**
- 30 a 50 tareas en repos fixture de TS: greenfield, legado con violaciones, bugfixes y **refactors en varios pasos**.
- Entre 3 y 5 corridas por tarea y brazo.
- **Al menos 2 modelos** (uno de gama alta y uno de gama baja), porque la tendencia a hacer trampas cambia entre modelos.
- [v1] Un subconjunto se repite en un segundo harness (Grok Build o Codex) para medir paridad.

| Brazo | Configuración |
|---|---|
| A | Harness sin modificar |
| **B** | Reglas del preset **solo en CLAUDE.md / AGENTS.md**. Control crítico: si B logra el 80 % del beneficio, el valor del gate es el 20 % restante y hay que demostrarlo |
| C | Gate sin inyección de contexto |
| D | Gate + resumen del preset al iniciar sesión y en CLAUDE.md (generado por `pregate bench` solo para el experimento; el producto no exporta prosa) |
| **E** | **ESLint + dependency-cruiser con umbrales equivalentes + hook casero de unas 30 líneas** (§15.2) |
| F | Mismas reglas solo como contexto adicional, sin deny (informar contra bloquear) |
| G | Mismas reglas en el post-tool con bloqueo, estilo Sonar (antes contra después) |
| H | D + pre-check (CLI en MVP; MCP `check` en v1) |

**Variables experimentales:**
- idioma del mensaje al agente (en/es);
- presencia de la línea sobre el shell;
- contador con o sin máximo;
- [v1] mensaje completo contra solo la línea compacta de 256 caracteres (simula Grok Build).

**Qué se mide:**
- completitud (tests ocultos), tokens, costo y tiempo;
- todas las métricas de §16.1;
- deltas de las métricas proxy y de sus contramétricas:
  - complejidad cognitiva y ciclomática, frente a la proporción de funciones triviales llamadas una vez;
  - tamaño, frente a la profundidad de indirección;
  - violaciones de capa y ciclos, frente a abstracciones con una sola implementación;
  - duplicación;
  - profundidad de módulos (APoSD).

**Prueba del costo del cambio siguiente** (la prueba real de mantenibilidad). Sobre la salida de cada brazo, un agente nuevo **y** desarrolladores humanos hacen una segunda tarea de modificación. Se mide éxito, tiempo, tamaño del diff y defectos introducidos.

**Evaluación humana a ciegas:** al menos 3 desarrolladores senior comparan por pares A contra D y E contra D.

**Set de regresión de evasión:** tareas diseñadas para tentar cada familia del corpus de trampas. Se corre en cada versión nueva del modelo, del harness o del corpus.

**Criterios definidos antes de correr (a calibrar):**
- **D contra A:** caída de completitud ≤ 5 pp, costo ≤ +30 %, mejora significativa en el costo del cambio siguiente, preferencia humana ≥ 60 %.
- **D contra B y contra E:** mejora significativa en violaciones de capa y de metodología, **sin** aumento de fragmentación.

### 16.3 Go/no-go del MVP
Con los brazos **A, B, D y E**, 10 a 15 tareas y 2 modelos, el MVP pasa si:
- D supera a B **y** a E en violaciones de capa y de metodología;
- la corrección en un intento es ≥ 70 %;
- los lazos son < 5 por cada 100 denegaciones;
- el p95 es ≤ 150 ms;
- `task_shrink` ≈ 0.

Si D no supera a E, se cambia de rumbo antes de v1.

### 16.4 Adopción
Son métricas de **calibración del instrumento**, no de gestión de deuda (el burn-down es territorio de ArkGate, U10).
- **Locales** (`pregate report`, sin telemetría):
  - excepciones por cada 1.000 denegaciones (si es alta, hay reglas mal calibradas);
  - tiempo en `shadow` antes de pasar a `enforce`;
  - reglas locales promovidas por el Forge y su tasa de trampas reales.
- **Con telemetría opt-in** (si se aprueba, §19): repos activos a 30 días y precisión entre usuarios.
- Si no hay telemetría, se reemplazan por entrevistas a los usuarios del piloto.

---

## 17. Riesgos y mitigaciones

| # | Riesgo | Severidad | Mitigación |
|---|---|---|---|
| R1 | **Goodhart:** la IA cumple los umbrales fragmentando o con pass-through y el código empeora | Crítica | Contrapesos declarados obligatorios y evaluados en Stop [v1]; en el MVP, texto `Avoid:`. `avoid` en cada mensaje. Corpus de trampas (familia `trivial-extract`). Corrección beneficiosa medida. Contramétricas en el benchmark |
| R2 | **Evasión barata** (marcadores de generado, `exclude`, imports dinámicos, casts, debilitar tests) | Crítica | Pack de integridad siempre activo. Fixtures `trap/` y corpus estándar. Set de regresión de evasión |
| R3 | **Blanqueo del ratchet:** lo que se escapa se vuelve base | Alta | `before` = snapshot de sesión o HEAD; nunca el disco de la llamada anterior. pre-commit contra HEAD y CI contra el baseline |
| R4 | Bloquear estados intermedios legítimos de un refactor | Alta | Criterio Pre/Stop (§5.2); el juez prueba las reglas `pre` contra un corpus de estados intermedios; ciclos, duplicación y contrapesos solo en Stop |
| R5 | Bypass por shell, MCP o editando settings y estado | Alta | Defensa en capas (§10). Fin de turno contra la snapshot. ConfigChange. Hook en managed settings. pre-commit y CI |
| R6 | Lazos de reintento | Alta | Todas las violaciones a la vez. Contadores por (archivo, regla). Detección de "sin progreso". Escalamiento `stop`. Detención del turno |
| R7 | **Fallo silencioso del gate** (timeout, crash, ruta mal escrita **[V]**, ruta absoluta de otra máquina, `args` descartados por otro harness) | Alta | Watchdog. Canal de bloqueo más robusto. `failMode: closed` por defecto. Launcher commiteado con ruta relativa y fail-closed; binario sin subcomando ⇒ `hook auto`. `doctor`. Fin de turno. pre-commit y CI |
| R8 | `ask` sin humano, o en un harness donde `ask` falla abierto, equivale a aprobar | Alta | `ask` solo en modos interactivos verificados por perfil y con señal de interactividad; en los demás, deny + detención. Nunca `ask` sobre rutas protegidas |
| R9 | Fricción que lleva a desinstalar | Alta (comercial) | `shadow` como modo explícito de calibración (el piloto lo usa 2 semanas). Presets curados con resoluciones propuestas que se confirman en un paso. Reglas heurísticas en `warn` hasta medir. Ratchet. Solicitudes de cambio al preset que el humano aplica con un comando. **No** se relaja la garantía para bajar fricción: el default sigue siendo `enforce` + `failMode: closed` |
| R10 | Falsos positivos de heurísticas en `deny` | Media-alta | `heuristic` arranca en `warn`. Precisión ≥ 0,9 para subir |
| R11 | Carreras de estado con hooks paralelos | Media | Eventos append-only con rename atómico. Contadores derivados. Ediciones concurrentes revisadas en Stop |
| R12 | Latencia acumulada | Media | Binario compilado. Sin evaluación global en Pre. Snapshot de shell solo si hay heurística. Migración a Rust si no se cumple el p95 |
| R13 | Cambios en el contrato de hooks (en Claude Code, MultiEdit ya no está y `continueOnBlock` cambió en v2.1.210; en otros harnesses, cambios casi semanales) | Media-alta | Adaptadores delgados con perfiles como datos. Fixtures de contrato por versión. `doctor` con matriz de versiones |
| R14 | **Fricción de configuración por conflictos explícitos**: el usuario combina metodologías y el preset no compila hasta resolver | Media | `init` propone cada resolución con su porqué y el humano confirma con un paso. Presets curados ya resueltos. Mensaje de error con el JSON exacto para pegar |
| R15 | Resolución de imports TS imprecisa (paths, monorepos, barrels) | Media | Un solo lenguaje en MVP. Re-exports hasta 3 saltos. Un import no resoluble en una capa `core`/`port` es deny de forma; fuera de capas se re-evalúa en Stop. Falsos positivos medidos en el piloto |
| R16 | Contenido del agente reflejado en el mensaje (inyección) | Media | Sanitización; nunca se interpolan comentarios ni strings |
| R17 | Copyright y **marcas**: títulos de libros como nombres de manifiesto | Media | Paráfrasis de 300 caracteres como máximo, sin citas, con revisión humana. Revisión legal de los IDs antes de un registro público; alternativa: IDs descriptivos con el libro en `source` |
| R18 | Costo de escribir el catálogo (400 a 900 h para v1) | Media | 4 manifiestos completos en v1 y el resto en preview. Reglas como datos con prueba; el Forge abre la contribución [v2] |
| R19 | **Doble enforcement con ArkGate** en el piloto: los dos hooks deniegan lo mismo con mensajes distintos o contradictorios | Alta (piloto) | `coexist.arkgate.ownedByArkgate` con dueño único por invariante; en v1, el importador detecta superposiciones y el preset no compila si alguna no tiene dueño. Piloto en `shadow` hasta calibrar |
| R20 | **Fail-open en la mayoría de los harnesses** (timeout, crash, salida inválida) | Alta | Watchdog, canal robusto, `failClosed` donde existe, `failMode: closed` por defecto, pre-commit y CI obligatorios desde el MVP, post-edit con revert donde no hay pre-edit, `net_catches` como métrica |
| R21 | **Payloads no documentados o que cambian** (Cursor, Devin, Kiro, Amp, Copilot `apply_patch`) | Alta | `pregate capture` + contratos por versión; sin contrato, `unknown` ⇒ `failMode`; esos harnesses entran en olas tardías |
| R22 | **Motivo truncado** (Grok Build: 256 caracteres) o input truncado (> 128 KiB) | Media | Línea compacta autosuficiente; `truncated` ⇒ deny salvo ruta extraíble fuera de scope |
| R23 | **El Forge admite una regla ganable** porque el corpus no modeló esa trampa | Media | Revisión humana al promover; trampas reales → fixtures `trap/` → endurecimiento; corpus versionado y re-juicio del catálogo |
| R24 | **Checkers custom de packs compartidos** como ejecución de código de terceros | Media-alta | Sandbox sin I/O; hash fijado en el lock; revisión humana; opción de permitir solo primitivas y patrones en fuentes externas (§19) |
| R25 | **El Forge como vía de bypass** (código de producción en borradores, reglas "más débiles") | Media | Cuarentena, EVA-FORGE-001, escritura solo por MCP, promoción y activación humanas, regresión obligatoria |
| R26 | **MCP como oráculo** para sondear huecos | Baja | Aceptado: el deny ya es un oráculo. Las consultas quedan registradas |
| R27 | **Costo de mantener 20+ adaptadores** | Media-alta | Familias de dialecto (`claude-wire`, `codex`, `gemini`, `js-plugin`), perfiles como datos, olas por confianza, pre-commit/CI como cobertura universal |
| R28 | Un harness ajeno lee `.claude/settings*.json` (Grok, Cursor, VS Code, Devin; también `settings.local.json`) y el hook del MVP **falla cerrado** (payload ajeno ⇒ `failMode`) o **falla abierto en silencio** (Devin con matcher que no dispara; un harness que no expande `CLAUDE_PROJECT_DIR` y corre con otro `cwd`) | Media-alta | Shell form con `${CLAUDE_PROJECT_DIR:-.}`; binario sin subcomando ⇒ `hook auto`; perfil acotado de Grok en el MVP (pregunta 9); tests de contrato por harness; pre-commit y CI como red |
| R29 | **Secuestro de la raíz o de rutas protegidas** (`.pregate/` anidado, variantes de mayúsculas, snapshot borrada) | Alta | `**/.pregate/**` protegido a cualquier profundidad; raíz anidada aceptada solo si preexistía o la declara el preset raíz; comparación sin distinguir mayúsculas; snapshot ausente ⇒ `failMode` |
| R30 | **El MVP crece más allá del spike** | Media | MVP partido en spike (demo) y evaluación (go/no-go y piloto); `computedHints`, `capture`, corpus estándar, autodetección de harness e importador de ArkGate, en v1 |

---

## 18. Roadmap

**Actualización 2026-10-03:** las fases siguientes conservan la visión histórica,
no describen el inventario actual ni versiones prometidas. El roadmap vigente
está en [ROADMAP.md](ROADMAP.md), con requisitos y evidencia en
[PRODUCT-WORK.md](PRODUCT-WORK.md). Ya existen cinco adaptadores, init/doctor,
distribución Windows, packs Git fijados y shadow por regla. La entrega en revisión
añade auditoría completa, propuestas de composición de packs y reportes de issues;
su release sigue condicionado a las verificaciones allí enumeradas.

### 18.1 MVP: spike (4 a 6 semanas, una persona) + evaluación (2 a 3 semanas)

**Spike, criterio de demo: "dos presets, dos comportamientos".**
- **Core** agnóstico sobre `ProposedChange` → `Decision` desde el día 1, aunque solo haya un adaptador.
- **Adaptador:** Claude Code. `Write` y `Edit` (más `MultiEdit` ⇒ `unknown`), guard de `Bash`/`PowerShell`/`Monitor` (POSIX + cmdlets de PowerShell, binarios de otros harnesses, asignaciones de entorno inline) y gate de `Stop` contra la snapshot de cada raíz tocada. Payload que no coincide ⇒ `failMode`. Instalación en shell form con ruta relativa y binario sin subcomando ⇒ `hook auto`. Sin NotebookEdit, Post, PostToolBatch ni SubagentStop. Perfil acotado de Grok Build si la pregunta 9 lo confirma.
- **Cierre de la garantía (U10):** pre-commit versionado en `.pregate/git-hooks/` (`pregate check --staged --ratchet`, contenido del índice contra HEAD) y plantilla mínima de CI (`pregate check --ratchet`), con el mismo binario y el mismo lock en disco.
- **Language pack:** TypeScript/JavaScript (`.ts`, `.tsx`, `.js`, `.mjs`). Imports relativos + `paths` de tsconfig + re-exports. Nodos `ERROR` en el rango cambiado ⇒ deny de forma.
- **Plataformas:** macOS y Linux. Motor en TS/Bun con reglas como datos.
- **Formato de reglas definitivo** (U1, U5): una carpeta por check con `check.json` y fixtures `pass`/`fail`/`trap` (escritas a mano, con sufijo no ejecutable); manifiestos de metodología con `conflicts[]`; `$schema` de todo. `pregate rules test` (fixtures, determinismo, schemas, IDs y namespaces).
- **Fuentes:** `builtin` + `path` (`.pregate/rules` y packs locales como `amarilla/`), solo primitivas y patrones, con `rules test` obligatorio al compilar (§5.4 regla 9). `engine` y versión de `core` verificadas contra el binario.
- **18 invariantes en 6 manifiestos embebidos**, para que la combinación de metodologías se note:
  - genéricas (`clean-code`): CC-FN-001 `fn-max-lines`, CC-FN-002 `fn-max-params`, CC-ER-002 sin `catch` vacío ni solo-log;
  - `clean-architecture`: CA-DEP-001 dirección de capas, CA-DEP-002 sin framework ni ORM en el núcleo, CA-UC-001 caso de uso con un solo método público;
  - `ddd-tactical`: DDD-VO-001 VO inmutables, DDD-ENT-001 sin setters públicos (rutas pasadas como parámetro);
  - `functional-core-imperative-shell`: FCIS-IO-001 core sin módulos con efectos, FCIS-IO-002 core sin reloj, random ni env;
  - `tdd`: TDD-FOCUS-001 sin `.only` ni `.skip`, TDD-DEL-001 aserciones que no bajan (`ask` donde es confiable; si no, deny + detención);
  - `pregate-integrity`: EVA-GEN-001, EVA-GEN-002, EVA-SUP-001, EVA-DYN-001, EVA-CAST-001, EVA-SCOPE-001.
- **Preset JSON:**
  - `engine`, `sources`, `methodologies`, `overrides` con parámetros, `layers`, `scope`, `enforcement` (default `enforce`), `ratchet`, `loop`, `failMode` (default `closed`), `coexist.arkgate.ownedByArkgate`;
  - `resolve` para conflictos de umbral o severidad; **todo conflicto sin resolver hace fallar la compilación** (probado con un manifiesto local de fixture);
  - **lock en disco**; `pregate preset apply` para las solicitudes del agente; `preset.json` siempre `deny` para el agente;
  - **3 presets de ejemplo** (`backend-clean-ddd`, `functional-ts`, `legacy-safe`) con resoluciones propuestas que se confirman.
- **Ratchet** `no-new`: violaciones sobre símbolos nuevos sin compensación + conteo (regla, archivo) para los preexistentes, contra `before_sesión`. Archivos nuevos en `strict`.
- **Modo `shadow`** explícito, con registro en `state/` para etiquetar precisión a mano y capturar trampas reales.
- **Mensajes** con la forma de §11.1 (línea compacta ≤ 256 + detalle; salida real del motor), **sin `computedHints`**. Contadores por (archivo, regla) en eventos append-only. "Sin progreso" = AST normalizado igual a un intento denegado o conteo que no baja. Escalamiento `stop`. Detención del turno.
- **Robustez:** exit 2 + JSON + stderr en todo deny, watchdog, `failMode: closed`, launcher fail-closed con salida por evento, snapshot ausente ⇒ `failMode`.
- **Protección:** `**/.pregate/**` a cualquier profundidad, carpetas de reglas, `**/.claude/settings*.json`, `~/.claude/settings*.json`, directorio de datos; comparación sin distinguir mayúsculas donde corresponde. Comandos administrativos y binarios de otros harnesses denegados en el shell.
- **CLI:** `install` (`--git-hook`, `--ci github`), `check` (incluye el pre-check `--stdin --format agent`), `explain` (con `--path`), `preset show`/`compile`/`apply`, `rules test`, `bench` (interno).

**Criterio de demo del spike:** sobre un **repo fixture**, el preset `backend-clean-ddd` y el preset `functional-ts` bloquean cosas visiblemente distintas, y cada deny se corrige en un intento.

**Evaluación (2 a 3 semanas después del spike).**
- **Benchmark:** brazos A, B, D y E con 2 modelos y el go/no-go de §16.3.
- **Piloto en amarilla-platform (U7):** `enforcement: shadow` explícito durante 2 semanas, con el pack `amarilla/` escrito a mano desde `docs/north-star`, CLAUDE.md, AGENTS.md y las `arkrules` (U8), y `coexist.arkgate` declarando qué invariantes siguen siendo de ArkGate. Se etiqueta precisión a mano sobre `state/` y se capturan trampas reales como fixtures `trap/`. Al cierre, las reglas no heurísticas que pasaron la calibración quedan en `enforce`; las que no, salen del catálogo o se parten.

**Fuera del MVP:** MCP (introspección y Forge), corpus estándar de trampas, checkers `custom`, fuentes `git`/`npm`, `computedHints`, `capture`, autodetección del harness real, otros adaptadores (salvo el perfil acotado de Grok, si se confirma), importador de ArkGate, fingerprints por símbolo, `extends`, `scopes`, `markers`, `glossary`, `init`, `doctor`, plugin, Post, PostToolBatch, ConfigChange, SubagentStop, excepciones, baseline commiteado, SARIF, `report`/`label`, Windows, Python.

### 18.2 v1: "contrato de diseño adoptable, en varios harnesses"
- **Catálogo:** **4 manifiestos completos** (`clean-code`, `clean-architecture`, `ddd-tactical`, `tdd`) + `pregate-integrity` completo; entre 60 y 120 reglas `deny` con precisión y corrección beneficiosa medidas. Manifiestos **en preview**: `philosophy-of-software-design`, `functional-core-imperative-shell`, `ddd-strategic`, `solid`, `refactoring-smells`, `effective-typescript` y `hexagonal`. En preview, las reglas **con precisión medida conservan `deny`** (FCIS-IO-001/002 desde el MVP) y el resto queda en `warn`; `preset show` e `init` avisan "esta metodología hoy no bloquea N de M invariantes". Así elegir una metodología en preview enciende un bloque real, aunque incompleto. Backlog de candidatas publicado.
- **Rule Forge y servidor MCP** (§12): introspección (`get_active_invariants`, `check`, `explain_rule`, `get_preset_summary`), tools del Forge, juez completo, corpus estándar de trampas versionado, sandbox para checkers `custom`, `pregate forge show|promote|reject|suggest`.
- **Fuentes:** packs compartidos por `git` y `npm`, versiones fijadas, `pregate sources update`.
- **Preset completo:**
  - lock (ya en disco desde el MVP) con `confirmedBy` por resolución heredada;
  - `extends`, `scopes` (aditivos), `resolve` para posturas, `dimensions.v1.json`, `pairs.json` como sugerencias, `markers`, `glossary`;
  - techos de severidad (superarlos es error de compilación);
  - importador `pregate import arkgate` y detección automática de superposiciones con ArkGate;
  - incompatibilidades verificadas contra los archivos reales.
- **UX de selección:** `packs`, `preview`, `init` y `/pregate:init` (con confirmación de cada resolución), detección de conflictos con ESLint y tsconfig, `doctor`.
- **Adaptadores, ola 1:** Grok Build, Codex CLI (parser de `apply_patch`), Gemini CLI, Qwen Code, Copilot CLI. Contratos por versión.
- **Ratchet:** `no-worse` con fingerprints por símbolo, emparejamiento de renombres y movimientos, `boy-scout` opt-in, opciones WELC, baseline commiteado (sin burn-down: U10).
- **Hooks de Claude Code:** PostToolUse con dedupe, snapshot puntual de shell y diff, PostToolBatch, ConfigChange, SubagentStop por `agent_id`, reinyección después de compactar, contrapesos B-global en Stop.
- **Excepciones:** `approve` y `exceptions.json` (efectivas en CI con CODEOWNERS); `report` (solo calibración) y `label`.
- **CI:** sobre la plantilla mínima del MVP, salida SARIF y plantillas (GitLab, lefthook/Husky). Guía de `lint-cmd` para Aider.
- **`capture`** y autodetección del harness real por perfil; `computedHints` en los mensajes.
- **Distribución:** plugin de Claude Code; guía de managed settings por harness (handler declarado directamente en managed para la inmunidad frente a mods en Claude Code; `requirements.toml` en Grok Build y Codex).
- **Benchmark** completo (brazos A–H), prueba del costo del cambio siguiente y subconjunto de paridad en un segundo harness.
- **Stack:** se decide la migración a Rust según las mediciones.

### 18.3 v1.1
- **Language pack de Python**, manifiestos `effective-python` y `pragmatic-programmer`.
- **Adaptadores, ola 2:** Factory Droid, Augment, VS Code agent mode, Devin Local/CLI, Junie CLI, Kiro, Cursor (solo deny).
- **Clase de adaptador post-edit** (revert + feedback) para harnesses sin pre-edit utilizable (§14.8), empezando por Cursor `afterFileEdit`.
- NotebookEdit en `warn`.
- **Windows** (lanzador nativo).

### 18.4 v2
- Catálogo de unas 400 entradas sobre unos 265 checks.
- Más language packs: Go, Java/Kotlin (delegando a Error Prone o PMD), C#, Rust (clippy).
- **Adaptadores, ola 3:** plugins in-process (opencode, Kilo, Amp, Cline, pi), `hashline_edit` de Grok, Copilot cloud agent, Codex IDE.
- Adaptadores hacia ESLint, Ruff y Semgrep en Stop o CI; exportación a `eslint.config`, `.dependency-cruiser.cjs`, `.importlinter` y `sgconfig.yml`.
- Registro público de packs, con verificación de fixtures y corpus, precisión publicada y revisión legal de nombres.
- Daemon, solo si las mediciones lo justifican.

### 18.5 Ubicación del Forge
Ver §12.6: formato y `rules test` en el MVP; MCP, juez completo, corpus y sandbox en v1.

### 18.6 Fuera de alcance (futuro, separado del producto de invariantes)
- **Revisiones semánticas con LLM.** Fuera del producto (U3, decidida). No son invariantes, no están en el catálogo y no bloquean.
- **Ciclo de vida** (U10): reportes y burn-down de deuda, coverage, exploración, planificación, guía previa en prosa (exportar a CLAUDE.md o AGENTS.md) y flujos de "después" distintos de verificar las mismas invariantes. Es territorio de ArkGate.
- **LLM propio dentro de PREGATE.** Descartado: la parte generativa del Forge la aporta el agente del usuario.

---

## 19. Preguntas abiertas para el usuario

### Bloquean el MVP
1. **Convivencia con ArkGate en el piloto.** ¿Qué invariantes siguen siendo de ArkGate durante el piloto (`ownedByArkgate`) y cuáles pasan a PREGATE desde el día 1? ¿El hook de ArkGate se apaga cuando todas sus reglas tengan equivalente admitido en PREGATE, o conviven indefinidamente con dueños separados?
2. **Importador de `arkrules`.** La spec lo pone en v1 y, en el MVP, el pack `amarilla/` se escribe a mano desde `docs/north-star`, CLAUDE.md, AGENTS.md y las `arkrules`. ¿Lo necesitás ya en el MVP?
3. **Combinaciones y pack `amarilla/`.** Además del pack propio del piloto, ¿qué metodologías de `core` activarías en amarilla-platform el primer día ("Clean Architecture + Clean Code + TDD", por ejemplo)? Eso define el preset del piloto y valida los 6 manifiestos del MVP.
4. **eslint-rules con warning-ratchet del piloto.** ¿PREGATE adopta sus umbrales como overrides, las convierte en checks del pack `amarilla/` por el Forge, o conviven sin tocarse?
5. **Escalamiento.** Después de N rechazos, ¿preferís que la IA se detenga y te avise (`stop`, el default propuesto) o que te pregunte en el momento (`ask`)?
6. **`failMode: ask` como opt-in.** U10 fija `closed` por defecto. ¿Querés conservar `ask` como opción explícita para sesiones interactivas (un humano decide si deja pasar algo que PREGATE no pudo evaluar), o eliminarlo del todo?
7. **Stack.** ¿Confirmás TypeScript/Bun para el MVP, con migración a Rust solo si la latencia lo exige?
8. **Calibración en el piloto.** La spec usa `shadow` explícito 2 semanas en amarilla-platform (por la convivencia con ArkGate y para medir precisión) y `enforce` como default en todo lo demás. ¿Te sirve, o querés bloquear en el piloto desde el día 1?
9. **Grok Build en el MVP.** Grok lee `.claude/settings.json`: sin perfil propio, el hook del MVP le falla cerrado en todas las ediciones. ¿Alguien del equipo del piloto usa Grok Build? Si sí, la spec recomienda incluir en el MVP un perfil acotado (`write`, `search_replace` y shell; el resto ⇒ `failMode`). Lo mismo aplica, sin perfil en el MVP, a Cursor, VS Code y Devin.
10. **U2, interpretación operativa.** ¿Confirmás el Forge tal como lo describe §12 (agente propone vía MCP, juez determinista con corpus de trampas, humano promueve y activa por CLI) y su llegada en v1, con el formato de reglas y `rules test` ya en el MVP?

### Para v1 en adelante
11. **Usuario objetivo después del piloto.** El piloto es un repo de empresa con equipo. ¿v1 apunta a equipos (CODEOWNERS, managed settings) o sigue priorizando al dev individual?
12. **Quién escribe el catálogo** (de 400 a 900 h para v1): vos, un equipo, la comunidad, o una combinación.
13. **Orden de la ola 1 de adaptadores.** La propuesta es Grok Build, Codex CLI, Gemini CLI, Qwen Code y Copilot CLI. ¿Cuál usa tu equipo, para priorizarlo?
14. **Excepciones.** ¿Quién las aprueba en tu contexto? ¿`expires` obligatorio u opcional?
15. **Bypass por shell.** ¿`flag` (bloquear y avisar) o `revert` (deshacer automáticamente las escrituras por shell que violen reglas)?
16. **Checkers de terceros.** ¿Los packs compartidos pueden traer checkers `custom` (en sandbox), o solo primitivas y patrones?
17. **Borradores del Forge.** ¿Se commitean (para revisarlos en un PR) o quedan fuera de git?
18. **Telemetría opt-in** con denegaciones anonimizadas para medir precisión entre usuarios: ¿sí o no?
19. **Licencia y modelo de negocio:** open source (MIT o Apache) con catálogo comunitario, open core o producto pago. ¿Cambia algo por la relación con ArkGate?
20. **Nombres de manifiestos.** ¿Usamos títulos de libros (`clean-code`) o IDs descriptivos (`small-functions`, `dependency-rule`) con el libro como fuente? Afecta el riesgo legal.
21. **Dominio del `$schema`** y canal de distribución del plugin (marketplace propio o público).

(El idioma de los mensajes al agente no se pregunta: se mide en el benchmark, §16.2. Ya no se preguntan, porque están decididos: la reformulación de "100 % mantenible" (la fija la visión), el catálogo solo determinista (U3), el lenguaje inicial (TS, U6), la necesidad de multi-harness (U6), si la IA puede activar reglas (U4), el repo piloto (U7), el alcance solo-prevención con pre-commit/CI como parte de la garantía (U10) y el tagline (U11).)

---

## Apéndice A. Decisiones del usuario (U1–U11)

Mandan sobre el resto del documento. En `docs/inputs/decisiones-usuario.md` figuran como D1–D11; acá se renombran para no chocar con las decisiones de diseño.

| # | Decisión | Texto | Estado | Dónde se aplica |
|---|---|---|---|---|
| **U1** | Las reglas son JSON, no markdown | Los usuarios no escriben reglas en prosa (estilo CLAUDE.md o Cursor rules). Arman reglas en JSON | **Decidida** (2026-10-01) | §2, §5.4, §6, §7.3, §12.3 |
| **U2** | Rule Forge: primero se programa la invariante, después existe la regla | Si al usuario le falta una invariante, una herramienta de PREGATE lo ayuda a escribirla. Primero se programa cómo la práctica se vuelve invariante (qué mira, cuándo falla, cómo se verifica) y recién cuando eso está demostrado la regla entra. Sin prueba ejecutable no hay regla | **Decidida.** Interpretación operativa propuesta en §12, **a confirmar** (pregunta 10) | §5.4 (regla 9), §6, §12 |
| **U3** | Solo invariantes deterministas | El catálogo contiene solo reglas binarias deterministas. Las prácticas de juicio (ex nivel C) quedan fuera del catálogo, en un backlog de candidatas que el forge intenta volver verificables | **Decidida** (2026-10-01): opción A | §1, §2, §5.2, §5.5, §18.6 |
| **U4** | MCP de PREGATE: autoría + introspección, nunca enforcement | El Forge vive como MCP: el agente pone la parte creativa y el MCP el juez determinista. PREGATE no necesita LLM ni API key. Introspección: `get_active_invariants(path)`, `check(diff)`, `explain_rule(id)`. El agente puede proponer reglas, nunca activarlas; activar en el preset es un acto humano (CLI). El hook protege `.pregate/` (preset, catálogo local, excepciones). Las fixtures del agente no alcanzan: corre además un corpus estándar de trampas y la admisión muestra al humano fixtures y checker. Descartado: tools MCP para suprimir, desactivar o editar reglas o el preset, y el MCP como enforcement. Un core, tres caras: hook, CLI, MCP | **Decidida** | §2, §8.1, §8.6, §10, §12, §13.1 |
| **U5** | Dónde viven las reglas y en qué formato | Una carpeta por regla con `rule.json` (+ `$schema`), `fixtures/{pass,fail,trap}/` y `checker.*` opcional. Agrupación por área. Metodología = manifiesto que referencia IDs + defaults + conflictos conocidos. Fuentes en capas declaradas en el preset (built-in → packs compartidos path/git/npm → `.pregate/rules/`). IDs con namespace; sin sombreado silencioso (overrides explícitos o ID propio). Editar = nueva versión semver con regresión de fixtures; trampas reales → `trap/` y endurecimiento. Versiones fijadas en el preset. Carpetas de reglas protegidas | **Decidida** (propuesta del usuario incorporada). **Desviación documentada:** la "regla" de U5 es el check canónico (`check.json` + fixtures); el alias de metodología vive en el manifiesto, con fixtures propias opcionales (§5.3, §6.2). Los "conflictos conocidos" son `conflicts[]` del manifiesto, solo como sugerencias | §5.3, §5.4, §6, §8 |
| **U6** | Multi-lenguaje y multi-harness; empezar por TS | Core agnóstico de harness y de lenguaje sobre `ProposedChange` → `Decision`. Adaptadores de harness (Claude Code primero); harness sin pre-edit hook: fallback post-edit (revert + feedback) y, como red universal, pre-commit y CI con el mismo core. Language packs con tree-sitter + extractores hacia una IR neutral; reglas sobre la IR portables; idiomáticas en el pack. MVP: pack TS/JS + adaptador Claude Code | **Decidida** | §4, §13, §14 (post-edit en §14.8), §18 |
| **U7** | Repo piloto | `Amarilla-David/amarilla-platform` (privado): TypeScript mayoritario, además JS, PLpgSQL, Python, C# y HTML. Repo grande y vivo: el ratchet para legado es crítico | **Decidida** | §1, §3, §8.4 (ejemplo 4), §9, §18.1 |
| **U8** | Pack personalizado del piloto | Las reglas que ya viven en el piloto (`docs/north-star`, CLAUDE.md, AGENTS.md, `arkrules`) sirven para armar el pack `amarilla/`. El repo ya usa ArkGate como PreToolUse, tiene eslint-rules con warning-ratchet y ~240 tests de arquitectura | **Decidida** | §6.5, §12.3, §15.0, §18.1 |
| **U9** | PREGATE es la evolución de ArkGate | ArkGate es la generación anterior, no prior art de terceros. Se documenta qué se hereda, qué se generaliza y qué se descarta. Migración: importador `arkrules/*.json` + `ark.config.json`; coexistencia temporal sin doble enforcement hasta reemplazar el hook de ArkGate | **Decidida** | §8.3 (`coexist`), §8.5 (regla 12), §13.8, §15.0 |
| **U10** | PREGATE es solo prevención; fail-closed | Una sola responsabilidad: que el código que viola el preset nunca se escriba. Autosuficiente y componible con ArkGate. Fail-closed por defecto; input no verificable (truncado, payload desconocido, parser que falla) ⇒ deny, nunca allow. Sin reportes, burn-down, coverage ni ciclo de vida (territorio de ArkGate). **Confirmado:** el cierre en pre-commit/CI corre exactamente las mismas invariantes, con el mismo binario y el mismo preset/lock, como parte de la garantía | **Decidida** (2026-10-01) | §1, §2, §4.4, §6.5, §8.3, §9, §10, §13.6, §18 |
| **U11** | Tagline | "A prevention gate for bad code and bad architecture. If it breaks your invariants, it never gets written." Alternativa: "Bad code and bad architecture don't get written. Not reviewed later — never written." | **Decidida** (en inglés) | Encabezado |

---

## Apéndice B. Registro de decisiones de diseño (DD)

DD-01 a DD-46 conservan la numeración del borrador v1 (ex D1–D46). Las marcadas **(actualizada)** cambiaron para alinearse con U1–U11 y la visión. DD-47 en adelante son nuevas; DD-66 en adelante vienen de la revisión v2.1.

| # | Decisión | Por qué |
|---|---|---|
| DD-01 **(actualizada)** | La garantía es hook fail-closed + pre-commit + CI con el mismo binario y el mismo lock; el hook es el enforcement primario | U10. Varios harnesses fallan abierto y el agente tiene permisos locales, así que el hook solo no alcanza; contra un adversario con permisos locales, la red es CI con CODEOWNERS |
| DD-02 **(actualizada)** | El catálogo contiene solo reglas binarias y deterministas; las prácticas de juicio van a un backlog de candidatas; las revisiones LLM quedan fuera del producto | "Una regla que el agente puede ganar sin mejorar la estructura no se queda". Los LLM no son deterministas, admiten inyección y premian reintentar sin cambios. U3 (decidida) |
| DD-03 **(actualizada)** | Checks canónicos (una carpeta por check, agrupados por área) referenciados por aliases dentro de manifiestos de metodología | El 35 % de las reglas se repite con otro umbral; un check puede pertenecer a varias metodologías (U5) |
| DD-04 | Los parámetros pertenecen al check; una regla efectiva por (check, scope, instancia) | Evita nombres de parámetros inconsistentes y violaciones duplicadas por el mismo hecho |
| DD-05 **(actualizada)** | Dimensiones en un enum cerrado; **todo conflicto (umbral, postura o severidad) exige resolución explícita en el preset o no compila**; `pairs.json` y `conflicts[]` solo sugieren; las resoluciones heredadas se confirman | "Si dos metodologías discrepan, el preset lo dice y el usuario resuelve; no se deja que el agente elija el lado más fácil". Se elimina el default `precedence` |
| DD-06 **(actualizada)** | Orden de precedencia explícito (overrides de scope > overrides globales > resolve > único alias) sin precedencia implícita entre metodologías; un override que supera un techo de severidad es error de compilación | Predecible y auditable en el lock; el orden de `methodologies` no decide nada y nada se recorta en silencio |
| DD-07 **(actualizada)** | Fuentes con versiones exactas fijadas en el preset y hash en el lock; sin rangos | Reproducibilidad entre sesiones, agentes y harnesses (U5) |
| DD-08 | El "antes" del ratchet es la snapshot de sesión o HEAD, no el disco anterior | Con el disco, cualquier escape se blanquea y la tolerancia se acumula |
| DD-09 **(actualizada)** | MVP con ratchet por símbolos nuevos sin compensación + conteo (regla, archivo) para los preexistentes; fingerprints en v1 | El conteo puro dejaba pasar una función nueva compensada por una legada, justo el caso crítico del piloto (U7) |
| DD-10 | Fingerprints emparejados por símbolo y por hash de cuerpo normalizado | Un renombre legítimo no puede verse como una violación nueva |
| DD-11 | Contadores por (harness, sesión, agente, archivo, regla), sin símbolo | Renombrar o extraer no debe resetear el tope de reintentos |
| DD-12 | Escalamiento por defecto `stop` (deny + detención); `ask` opcional | `ask` premia la persistencia y el agente no ve su motivo |
| DD-13 **(actualizada)** | `ask` solo en modos interactivos verificados por perfil y con señal de interactividad; nunca sobre rutas protegidas; en los demás, deny + detención | En bypass, dontAsk, `-p`, subagentes o harnesses como Codex, `ask` podría equivaler a aprobar |
| DD-14 | El cortacircuitos detiene el turno y nunca relaja a `warn` | Relajar premiaba al agente más trabado con un pase libre |
| DD-15 **(actualizada)** | Todo deny sale por el canal más robusto del harness (en Claude Code, exit 2 + JSON + el mismo motivo en stderr; en Codex, exit 2 + stderr con stdout vacío) | **[V]** Exit 2 bloquea aun con JSON inválido, y entonces el motivo sale de stderr; exit 0 con JSON truncado deja pasar |
| DD-16 **(actualizada)** | Launcher commiteado, invocado en shell form con ruta relativa al repo, que falla cerrado (con salida por evento) si falta el binario; binario sin subcomando ⇒ `hook auto` | **[V]** Una ruta rota o un exit 127 apagan el gate en silencio; una ruta absoluta no existe en otra máquina; Grok descarta `args` |
| DD-17 **(actualizada)** | `failMode: closed` por defecto; `ask` opt-in solo donde es confiable; `open-with-recheck` eliminado | U10: input no verificable ⇒ deny, nunca allow |
| DD-18 | Guard de shell y gate de fin de turno dentro del MVP | Sin ellos, el gate se esquiva en una línea y el MVP no puede medir nada |
| DD-19 | Snapshot de shell solo si coincide la heurística; la defensa robusta es el fin de turno | `git status` en cada comando rompe el presupuesto en repos grandes |
| DD-20 **(actualizada)** | Pack de integridad siempre activo; las evasiones conocidas son fixtures `trap/` y familias del corpus estándar | Las evasiones baratas aparecen al primer deny; las fixtures reemplazan a `knownEvasions` (U5) |
| DD-21 **(actualizada)** | Marcadores de generado y `exclude` cuentan solo si ya existían, y nunca eximen una edición del agente sobre ese archivo (EVA-GEN-002) | Si no, el agente se exime a sí mismo, o escribe lógica de dominio en un archivo generado que ya estaba |
| DD-22 **(actualizada)** | Contrapesos en Stop [v1], como delta de sesión, nunca deny por llamada; en el MVP solo como texto `Avoid:` | Necesitan el grafo de llamadas y contradicen el propio Extract Function |
| DD-23 **(actualizada)** | Satisfacibilidad probada con fixtures `pass` en el catálogo y en el juez; warning en el compilador (no error) | Una combinación imposible garantiza bucles, pero fallar bloquearía umbrales personalizados legítimos |
| DD-24 | Mensajes sin identificadores propuestos y con rangos calculados por el motor | Un motor determinista no puede inventar nombres de dominio |
| DD-25 | Todas las violaciones listadas (5 detalladas, el resto en una línea) | No se puede pedir "corregí todas" si no se ven todas |
| DD-26 | Sanitización de lo que se refleja en el mensaje | Un identificador o string escrito por el agente podría hablar con "la voz del hook" |
| DD-27 | `warn` solo para violaciones introducidas | Avisar sobre deuda heredada empuja a cambios fuera de alcance |
| DD-28 | Estado en eventos append-only por llamada | **[V]** Los hooks corren en paralelo; leer-modificar-escribir pierde incrementos |
| DD-29 | Capas decididas por la ruta resuelta, siguiendo re-exports; import dinámico denegado en el núcleo | Cierra los barrels y el `import()` como bypass, y funciona con archivos que aún no existen |
| DD-30 **(actualizada)** | `enforce` por defecto; `shadow` solo como modo explícito de calibración (piloto, convivencia con ArkGate) | U10 (“sí o sí”). Las reglas no heurísticas son `deny` por construcción; el ≥ 90 % aplica a las heurísticas y, como monitoreo, a todas |
| DD-31 | Agente: mensajes en inglés por defecto; humano: en su idioma | El catálogo se escribe una vez; el efecto real del idioma se mide |
| DD-32 | MVP en TS/Bun con reglas como datos; Rust condicionado a la latencia | Tiempo al primer valor; las reglas sobreviven a un cambio de motor; los harnesses con plugins JS pueden cargar el core in-process |
| DD-33 | MVP con 18 reglas (12 de metodología, 6 de integridad), mayormente de metodología, no genéricas | 6 de los 8 checks de una versión anterior ya estaban en ESLint; el valor es la combinación de metodologías |
| DD-34 | Brazo E (ESLint + hook casero) en el go/no-go | Es el competidor real; si no se lo supera, no hay producto |
| DD-35 | v1 con 4 manifiestos completos y el resto en preview | Más manifiestos completos no entraban en 60–120 reglas ni en el costo de escritura |
| DD-36 | Usuario primario del MVP: dev individual o equipo chico en TS | Es quien pidió la herramienta; lo organizacional se difiere |
| DD-37 **(actualizada)** | `preset.json` es siempre `deny` para el agente; propone cambios como JSON-patch en `.pregate/requests/` y el humano los aplica con `pregate preset apply`. Lock, baseline, excepciones y carpetas de reglas: nunca | U4: activar es un acto humano por CLI. No está verificado que `ask` fuerce el prompt en todos los modos, y un clic en mitad de la tarea sería negociar la regla |
| DD-38 | Excepciones locales best-effort; efectivas en CI solo con CODEOWNERS | TTY y denylists se falsifican localmente; hay que ser honestos |
| DD-39 | Inmunidad frente a mods en Claude Code solo con el handler declarado en managed settings | **[V]** La excepción documentada es "hook in managed settings", no un plugin forzado |
| DD-40 **(actualizada)** | ConfigChange y rutas de configuración de hooks de cada harness protegidas | `disableAllHooks`, desactivar plugins o editar archivos de hooks apagaban el gate sin tocar el código |
| DD-41 | SubagentStop evalúa solo los archivos de su `agent_id` | Un subagente no debe quedar bloqueado por cambios ajenos |
| DD-42 | Post emite solo lo no informado y pide corregir hacia adelante | Evita feedback duplicado y reversiones en pánico por git o shell |
| DD-43 **(actualizada)** | Las solicitudes (`.pregate/requests/`, o la tool MCP equivalente) no cuentan como resolución ni activan nada | Era una salida más barata que corregir |
| DD-44 **(actualizada)** | Nunca se reescribe el input de la tool (`updatedInput`, `modifiedArgs`, mutar `args`) en ningún harness | **[V]** En Claude Code reemplaza el input entero y el ganador entre hooks no es determinista; en otros harnesses tiene bugs documentados |
| DD-45 | `MultiEdit` en el matcher de Claude Code solo por compatibilidad | **[V]** No figura en las herramientas actuales; incluirlo no rompe nada |
| DD-46 | Paráfrasis con revisión humana, sin comparación automática contra los libros | Procesar los textos completos sería en sí un problema de copyright |
| DD-47 | Core agnóstico sobre `ProposedChange` → `Decision` **desde el MVP**; multi-harness se diseña desde el día 1 aunque el MVP solo traiga el adaptador de Claude Code | U6. Reemplaza "otros harnesses en v2" del borrador |
| DD-48 | El adaptador nunca emite un allow nativo; "sin objeción" es silencio | En Qwen, Claude Code y Copilot, `allow` saltea la aprobación del usuario |
| DD-49 | Primera línea del motivo ≤ 256 caracteres y autosuficiente | **[V]** Grok Build recorta el motivo a 256 caracteres |
| DD-50 | `reconstruction: unknown \| truncated` nunca produce "sin objeción" | **[V]** Grok trunca inputs > 128 KiB; Gemini aplica matching difuso; VS Code usa placeholders |
| DD-51 | Perfiles de harness como datos + fixtures de contrato por versión + `pregate capture` | Los payloads cambian casi semanalmente y varios no están documentados |
| DD-52 **(actualizada)** | pre-commit versionado y plantilla mínima de CI dentro del MVP, con lock en disco | U10: el cierre en pre-commit/CI con el mismo binario y el mismo lock es parte de la garantía |
| DD-53 | Adaptadores por olas según confianza: v1 Grok Build, Codex, Gemini, Qwen, Copilot CLI; v1.1 los de formato Claude en preview; v2 los plugins in-process | Bloqueo confiable y payloads verificados primero; cubren las tres formas de edición |
| DD-54 | Una carpeta por check con `check.json` + fixtures `pass`/`fail`/`trap`; metodologías como manifiestos; agrupación por área | U1, U5. La regla viaja con su prueba |
| DD-55 | Fuentes en capas con namespaces; sin sombreado silencioso; cambios por `overrides` explícitos o un check nuevo con `derivedFrom` | U5. El orden de capas no resuelve choques |
| DD-56 | Versionado semver por check y manifiesto; fixtures append-only; regresión obligatoria | Debilitar una regla sin que se note es imposible por construcción |
| DD-57 | Corpus estándar de trampas con propiedad estructural preservada por transformación | Vuelve verificable "ganable sin mejorar la estructura" de forma determinista |
| DD-58 | Forge vía MCP: el agente propone, el juez decide, el humano promueve y activa; sin LLM propio | U2, U4 |
| DD-59 **(actualizada)** | Forge, MCP y corpus estándar en v1; formato de reglas, `rules test` y fixtures `trap/` escritas a mano en el MVP | El formato se prueba primero con el catálogo propio; las trampas reales aparecen en el piloto; el MVP no puede crecer más allá del spike |
| DD-60 | Borradores del Forge en cuarentena, escritos solo por tools del MCP; EVA-FORGE-001 | Contienen código que viola reglas a propósito y no pueden ser una vía de bypass |
| DD-61 | Checkers `custom` solo con justificación y en un sandbox determinista sin I/O | Determinismo y seguridad frente a código de terceros |
| DD-62 | El MCP no tiene tools para suprimir, desactivar o editar reglas o el preset, y no es enforcement | U4 |
| DD-63 | `methodologies` separado de `extends`; `overrides` solo sobre invariantes activas; invariantes sueltas vía manifiesto local | "El usuario no elige reglas sueltas"; toda regla activa conserva fuente |
| DD-64 | Language packs con IR por capacidades; reglas sobre la IR portables, idiomáticas en el pack | U6 |
| DD-65 | Toda invariante activa llega por un alias con `source` | "La regla tiene cuatro cosas", y una es de qué fuente sale |
| DD-66 | `tool-will-fail` ⇒ deny de forma sin consumir contador; `emptyOld` declarado por perfil | Denegar no cuesta nada (la tool iba a fallar) y cierra el TOCTOU y el caso de `old_string` vacío que crea archivos |
| DD-67 | Nodos `ERROR` en el rango cambiado ⇒ deny de forma; import no resoluble en capa `core`/`port` ⇒ deny de forma | U10 (parser que falla ⇒ deny); cierra la evasión por código que tsc acepta y tree-sitter no parsea |
| DD-68 | `**/.pregate/**` protegido a cualquier profundidad; raíz anidada aceptada solo si preexistía o la declara el preset raíz; comparación sin distinguir mayúsculas en volúmenes que no distinguen | Un `.pregate/` anidado escrito por el agente secuestraba la raíz de su subárbol |
| DD-69 | Toda fuente no builtin necesita prueba al compilar: reporte del juez (v1) o `rules test` en verde (MVP) | U2: sin prueba ejecutable no hay regla; un hash es integridad, no prueba |
| DD-70 | `engine` exacto en el preset; versión de motor o de `core` distinta ⇒ `failMode` y exit ≠ 0 en `check` | U10: mismo binario, mismo lock |
| DD-71 | `measures` en `check.json`: una transformación del corpus cuenta como trampa solo si preserva una propiedad que el check mide | Sin esto, `trivial-extract` rechazaba las propias reglas de tamaño |
| DD-72 | Fixtures con sufijo no ejecutable; `.pregate/**` siempre fuera de scope y en los excludes del proyecto | Las fixtures `fail`/`trap` contienen código violatorio (un `.only` enfocaba toda la suite) |
| DD-73 | La integridad absorbe al alias de metodología sobre el mismo check (severidad máxima, una sola violación); toda otra diferencia de severidad es conflicto | La integridad no se puede bajar; el resto lo decide el preset |
| DD-74 | Convivencia con ArkGate por `coexist.arkgate.ownedByArkgate` (MVP manual; v1 por importador con detección de superposiciones) | U9, U10: componible, sin doble enforcement ni dueño elegido en silencio |
| DD-75 | Sin `export` a prosa, sin burn-down ni reportes de deuda; `report` solo calibra el instrumento | U1, U10: territorio de ArkGate |
| DD-76 | Clase de adaptador post-edit (revert + feedback) en v1.1 para harnesses sin pre-edit utilizable; se descarta la tool MCP de edición como sustituto | U6; el MCP no es enforcement (U4) |
| DD-77 | Unidades y claves de timeout por perfil (`timeoutKey`, `timeoutUnit`) con test de contrato | Un `10` en ms son 10 ms: fail-open en cada llamada |
| DD-78 | `ask` modelado por modo nativo y señal de interactividad (`ask.modes`, `ask.headlessSignal`) en lugar de un booleano | La confiabilidad de `ask` depende del modo y de si la sesión es headless |
| DD-79 | Snapshot por (sesión, raíz); Stop sobre todas las raíces tocadas; re-evaluación con tareas en background; snapshot ausente ⇒ `failMode` | Worktrees y procesos en background escapaban del Stop; borrar la snapshot blanqueaba el ratchet |
| DD-80 | Guard de shell también sobre `Monitor`, binarios de otros harnesses y asignaciones de entorno inline | Un agente podía lanzar otro agente sin hooks |
| DD-81 | MVP partido en spike (demo en repo fixture) y evaluación (go/no-go y piloto en `shadow`) | El alcance había crecido para el mismo plazo; el piloto real no encaja en los presets de demo |

---

## Apéndice C. Cambios respecto del borrador v1

1. **Frase-resumen y marco de la visión** al inicio; "100 % mantenible = 100 % conforme al preset"; "el agente no negocia la regla"; "el preset viaja con el proyecto"; las cuatro cosas de una regla mapeadas a campos JSON.
2. **Nivel C fuera del catálogo** (U3, decidida): backlog de candidatas en JSON; revisiones LLM fuera del producto.
3. **Formato y layout de reglas** (U1, U5): carpeta por check, fixtures `pass`/`fail`/`trap` que reemplazan a `examples` y `knownEvasions`, manifiestos de metodología, fuentes en capas con namespaces, versionado y regresión. Nueva §6.
4. **Conflictos:** se eliminan `conflictPolicy` y el default `precedence`; todo conflicto exige `resolve` o el preset no compila; `pairs.json` solo sugiere. Ejemplos de preset reescritos.
5. **Preset:** `methodologies` separado de `extends`; `sources`; `overrides` en lugar de `rules`; sin `severityByLevel` para C ni `reviews`.
6. **Rule Forge y MCP** (U2, U4): nueva §12, en v1, con juez determinista y corpus estándar de trampas.
7. **Multi-harness y multi-lenguaje desde el diseño** (U6): `ProposedChange`/`Decision`, tres formas de edición, language packs con IR por capacidades. Nueva §14 con la matriz de harnesses, caveats y plan por olas.
8. **pre-commit mínimo en el MVP** como red frente a fail-open.
9. **Numeración:** U1–U11 (Apéndice A) y DD-01… (Apéndice B); preguntas abiertas actualizadas.

### Cambios de la revisión v2.1 (críticas de fidelidad, técnica de harnesses y coherencia)

10. **Decisiones del usuario completas:** U3 pasa a decidida; se incorporan U7 (repo piloto), U8 (pack `amarilla/`), U9 (evolución de ArkGate), U10 (solo prevención, fail-closed, pre-commit/CI como parte de la garantía) y U11 (tagline). Nueva §15.0 sobre ArkGate y convivencia sin doble enforcement (`coexist`).
11. **Fail-closed (U10):** `failMode: closed` por defecto, `open-with-recheck` eliminado, errores de sintaxis en el rango cambiado e imports no resolubles en capas núcleo ⇒ deny de forma, `tool-will-fail` ⇒ deny de forma, `enforce` como default y `shadow` solo explícito.
12. **Activación humana (U4):** `preset.json` siempre `deny`; solicitudes JSON-patch + `pregate preset apply`.
13. **Prueba obligatoria (U2):** toda fuente no builtin pasa `rules test` o trae reporte del juez; reglas que no alcanzan la calidad salen del catálogo en lugar de quedar en `warn`; IDs con cara de juicio reescritos o movidos a candidatas.
14. **Sin ciclo de vida (U10):** fuera `export` a prosa, burn-down y reportes de deuda.
15. **Endurecimiento técnico:** instalación en shell form con ruta relativa, binario sin subcomando ⇒ `hook auto`, protección de `**/.pregate/**` y sin distinguir mayúsculas, `Monitor` y binarios de otros harnesses en el guard, estado y snapshot del MVP definidos y protegidos, `engine` fijado, lock en disco desde el MVP, `measures` en el juez, fixtures no ejecutables, contrato `ProposedChange` corregido (`change.kind`, `insert`, `pathBase`, `callId` sintético), unidades de timeout, `ask` por modo, post-edit con revert (v1.1), worktrees y tareas en background en Stop, pre-commit versionado.
16. **Coherencia:** UC7 en v1, contrapesos en v1, ejemplos de preset corregidos y consistentes (más un ejemplo del piloto), MVP de 18 reglas partido en spike + evaluación, ratchet del MVP sin compensación para símbolos nuevos, FCIS-IO-001/002 en `deny` también en v1.
