# PREGATE en cinco harnesses, instalado una vez

**Current implementation references:** [commands/options](CLI.md),
[approval routes](features/approval-in-harness.md), [capability guarantees](features/harness-and-shell-guarantees.md)
and [delivery status](STATUS.md). The dated protocol/design and acceptance records
below describe their specific candidates. Current proposals can be reviewed and
approved with an exact human `!` command inside supported harness shell input;
they do not require an external-terminal round trip. Replay/native smoke is
distinct from current real harness interaction evidence.

**Estado:** diseño para construir (2026-10-02), revisado por dos revisiones adversariales (fail-open y simplicidad; §9 dice qué se aplicó y qué se descartó). Implementa D20: Codex CLI, Claude Code, Cursor (`cursor-agent`), Grok Build y Antigravity (`agy`), con instalación global, sin configuración por repo, con update y uninstall.

**Fuentes de verdad.** Los contratos verificados en vivo hoy: `docs/research/harness-{codex,cursor,grok,agy}-live.md` y `test/payloads/{codex,cursor,grok,agy}/`. El patrón de distribución: `docs/research/distribution-patterns.md`. El MVP: `docs/ARCHITECTURE.md` (§10, O1–O41) y `docs/SPEC.md` §14. Si este documento contradice a `distribution-patterns.md`, gana este, porque se escribió con los contratos en vivo. Ejemplos: Grok no lee `~/.cursor/hooks.json` en 1.0.48, agy usa un plugin y no `~/.gemini/config/hooks.json`, y Cursor y Grok leen `~/.claude/settings.json` siempre, con su payload nativo.

0.2.4 update: Release 0.2.4 verifies multi-platform execution across macOS, Linux, and Windows,
compiles Windows without bytecode to resolve runtime setup crashes, decouples Git/GitHub
dependencies for standalone folder operation (O72), and incorporates 300+ invariant rules
across 8 library packs and normative INVARIANTS catalogs (O73).
Under [D29/O60](ARCHITECTURE.md), human commands prompt on /dev/tty (or CONIN$ on Windows);
interactive Claude Code and agy use enforced native permissions. Codex, Cursor,
Grok and headless sessions deny contract edits and direct the human to
`pregate approve` for the expiring validated proposal. OS dialogs are removed.

**Marcas.** Las marcas **[V]**, **[C]**, **[D]** y **[S]** significan lo mismo que en los relevamientos. **[E2E]** marca algo que no está verificado y que la prueba real de §6.3 tiene que confirmar antes de la instalación en la máquina del usuario. Mientras no esté confirmado, se usa la opción que no depende de ello.

**Estándar.** D16 y D17: cero dependencias de runtime, núcleo puro y una abstracción solo si tiene dos usos reales. Cada decisión de abajo dice qué requisito la exige.

---

## 0. Forma general en una pantalla

- **Tres registros para cinco harnesses.** `~/.claude/settings.json` sirve a Claude Code, Cursor y Grok, porque Cursor y Grok lo leen siempre y le pasan su payload nativo [V]. `~/.codex/hooks.json` sirve a Codex, y un plugin global sirve a agy. Cada harness ejecuta **exactamente un** registro de PREGATE, así que no hay doble evaluación que deduplicar (MH-04).
- **Un comando registrado, congelado entre versiones** (MH-22): un guard inline que hace `exec` del launcher global. Si falta el launcher, deniega solo si hay un preset.
- **Launcher global** `<DATA>/bin/pregate` = el mismo `assets/launcher.sh` con `version=<x>`. Supervisa al motor y convierte toda falla en exit 2 + stderr, que bloquea en los cinco [V] (MH-15).
- **El motor elige el perfil por sniff** (MH-03), decodifica, y si el lock del repo fija otro motor, sale con exit 3 para que el launcher lo reejecute (MH-19).
- **Fuera de un repo con preset:** sin estado, sin git y sin WASM. Solo corren las protecciones de máquina, que impiden apagar PREGATE desde cualquier repo (MH-17).

---

## 1. Contrato de adaptador

**MH-01. Un módulo por harness, con funciones puras y su perfil como constantes. No hay `profile.json` ni intérprete.**
- `src/claude.ts` pasa a `src/harness/claude.ts`. Se suman `codex.ts`, `cursor.ts`, `grok.ts` y `agy.ts`. Lo que hoy es privado de `claude.ts` y comparten varios módulos (`parse`, `isObject`, `keys`, `absolute`, `json`) se mueve a `src/harness/wire.ts`.
- Cada módulo exporta lo mismo (las firmas exactas están en §10.1):
  ```ts
  decode(event: HookKind, raw: string, env: HookEnv): HookEvent | Rejected | null   // null: evento que se ignora
  encode(kind: HookKind, d: Decision, stop: StopState | null): Emission
  VERIFIED: string                                   // versión del CLI con contrato en test/payloads/<h>/
  ```
- `Rejected` reemplaza al `fallback` separado: cuando el decode falla, el mismo parse devuelve el canal del deny (`kind`, `reentry`) y los directorios del sobre que sirven para ubicar la raíz (`dirs`, MH-06). Es un parse por llamada en vez de dos.
- **Por qué no se toman los datos de A17.** La extracción a datos estaba pensada para el segundo adaptador. Con cinco, lo que varía de uno a otro es estructural: un patch multiarchivo (Codex), protojson sin nombre de evento (agy), claves camelCase con alias snake (Grok) y `cursor_version` (Cursor). Un perfil declarativo no lo expresa sin volverse un lenguaje (DD-51 ya lo descartó). Lo que sí es dato (nombres de tools, matchers, timeouts, límites) queda como constantes al principio de cada módulo. Ese es el "perfil" de SPEC §14.1.5. Se reemplazan A17 y el principio 8 de ARCHITECTURE en lo que toca a "no existe un registry de harnesses": el mapa `HARNESSES = { "claude-code", codex, cursor, grok, agy }` vive en `main.ts`, y lo usan `main` y `doctor` (dos usos).
- La registración (archivo, eventos, matcher, timeouts) no vive en los adaptadores, porque tres harnesses comparten un registro: vive en `src/register.ts` (MH-22).

**MH-02. IDs y flag.** Los IDs son `claude-code`, `codex`, `cursor`, `grok` y `agy`. Todo registro global lleva `hook <evento> --harness <id>`, donde el evento es `pre`, `stop` o `session-start`. El registro compartido de `~/.claude/settings.json` lleva `--harness claude-code`, y Cursor y Grok se reconocen por sniff (MH-03). agy no manda el nombre del evento en el payload, así que lo único que lo identifica es argv [V]. `hook auto` sigue para §13.7.

**MH-03. Detección: primero el sniff, después el flag.** El perfil que decodifica se elige así:
1. **Grok**, si `GROK_HOOK_EVENT` no está vacío **y** el payload tiene la clave de primer nivel `hookEventName`. `GROK_HOOK_EVENT` es la señal que Grok reserva y siempre pisa [V]. Exigir también la clave cubre el caso en que la variable se filtre a otro proceso. Ni "cualquier `GROK_*`" (lo que hace hoy `main.ts`) ni `CLAUDECODE` cuentan, porque los harnesses heredan el entorno del padre [V en Codex, Grok y agy].
2. **Cursor**, si el payload tiene la clave de primer nivel `cursor_version`. Se comprueba después de `JSON.parse` y nunca con un grep: un `Write` de Claude cuyo contenido incluya `"cursor_version"` no puede cambiar el perfil. `CLAUDE_PROJECT_DIR` no sirve, porque Cursor también la define [V].
3. En otro caso, el `--harness` del registro. Codex y agy se identifican **solo** por flag: el payload de Codex tiene la forma del de Claude, y el de agy no trae el evento.

**MH-04. Una sola evaluación por llamada, por construcción.** Cada harness ejecuta un solo registro de PREGATE:

| Harness | Registro que ejecuta | Cómo se descarta el resto |
|---|---|---|
| Claude Code | `~/.claude/settings.json` | MH-28 saca los hooks por repo de 0.1.0 |
| Cursor | `~/.claude/settings.json` importado [V] | PREGATE no escribe `~/.cursor/hooks.json` |
| Grok | `~/.claude/settings.json` [V] | PREGATE no escribe `~/.grok/hooks/` |
| Codex | `~/.codex/hooks.json` | no lee hooks de Claude [V] |
| agy | plugin `pregate` | no lee hooks de Claude [V] |

- **Qué se pierde y por qué se acepta** (U-6):
  - En Cursor, `failClosed:true`: las entradas importadas lo llevan forzado a `false` [C]. Lo que `failClosed` cubría además del launcher es que el propio `sh` inline no pueda ejecutarse (exit 126/127) o que el launcher no responda dentro de los 30 s del harness. El launcher ya convierte el crash y el cuelgue del motor en exit 2 + stderr, que Cursor respeta [V]. Es el mismo residuo que Claude Code tiene desde el MVP.
  - En Grok, la independencia del interruptor de compatibilidad con Claude (`GROK_CLAUDE_HOOKS_ENABLED=0`, `[compat.claude] hooks=false`, el toggle de `/hooks`). El agente no puede tocarlos (MH-17, MH-29). `doctor` y el pre-commit avisan si están apagados (MH-27).
- **Qué se gana:** no se escribe en `~/.cursor/hooks.json`. Ese archivo es de Orca, y un error de esquema lo invalida entero [C], apagando también los hooks del usuario. Desaparecen la sonda "registro nativo presente", el concepto de llamada importada, la deduplicación por `callId` y dos de cinco merges.

**MH-05. Sesión por harness.**

| | `Session.id` | `turnId` | `agentId` | `callId` | Raíz o cwd |
|---|---|---|---|---|---|
| claude-code | `session_id` | `prompt_id` | `agent_id` | `tool_use_id` | `cwd` |
| codex | `session_id` | `turn_id` [V] | `agent_id` (subagente) [V] | `tool_use_id` + `~` + `H(tool_input.command)` (code mode comparte `exec-<uuid>` entre llamadas [V]) | `cwd` |
| cursor | `session_id` | `generation_id` (cambia también por followup; Stop cuenta la continuidad de la sesión hasta terminar el turno, ver §6.4) | null (subagente = sesión propia [V]) | `tool_use_id` | Shell: `cwd` absoluto, o `workspace_roots[0]` si `cwd` es `""` y hay **una** raíz; el resto, `workspace_roots[0]` (MH-06) |
| grok | `sessionId` | null (Pre no trae `promptId` [V]) | null (el subagente tiene `sessionId` propio [V]) | `toolUseId` | `cwd` |
| agy | `conversationId` | null | null (sesión propia [V]) | `String(stepIdx)` | `run_command.Cwd`; el resto, `workspacePaths[0]` |

- El estado se indexa por `<id>:<Session.id>`, para que dos harnesses no compartan una sesión por casualidad.
- `interactive` es `false` en todo harness que no sea Claude Code. Así `decide` nunca emite `ask` donde no se puede confiar en él: Codex lo trata como fail-open [D], Cursor no lo aplica [D], Grok lo aprueba con `--always-approve` [V] y agy en headless no tiene a quién preguntarle [S].

**MH-06. `decode` devuelve `HookEvent | Rejected | null`.**
- `null` es un evento que se reconoce y se ignora, con salida neutra: hoy, solo la Stop de cierre de Grok (`reason:"shutdown"`) [V].
- `Rejected` es un sobre o una tool que no se reconoce (`payload-unrecognized`), o un caso que se reconoce pero no se puede juzgar (`BAD`). Lleva `dirs`: los directorios del sobre (`cwd`, `workspace_roots`, `workspacePaths`, `workspaceRoot`, el project dir del entorno).
- **Un cambio de contrato no rompe la máquina.** `main` responde "sin objeción" a un `Rejected` si **ninguno** de sus `dirs` alcanza una raíz y la sesión no registró ninguna. En otro caso, deniega. Si el sobre no es JSON o no trae ningún directorio, deniega siempre. Sin esto, un `cursor-agent update` que cambia el payload denegaría toda escritura en todos los repos de la máquina.
- **Directorio ambiguo ⇒ `BAD`:** Shell de Cursor con `cwd:""` y `workspace_roots` vacío o con más de un elemento; un `cwd` no vacío que no es absoluto; un `run_command` de agy sin `Cwd` y con `workspacePaths` vacío. Hoy esos casos se resolverían contra el cwd del hook (`~/.claude`) y pasarían sin raíz.

---

## 2. Formas de edición nuevas

**MH-07. Cambios mínimos de tipos (`types.ts`).**
```ts
type Edit =
  | { form: "full"; content: string }
  | { form: "append"; text: string }                                           // agy Append
  | { form: "oldnew"; old: string; neu: string; all: boolean; lines: [number, number] | null }  // lines: agy StartLine/EndLine
  | { form: "hunks"; hunks: Hunk[] }                                           // Codex *** Update File
  | { form: "delete" }                                                         // Codex Delete, Cursor Delete
  | { form: "unknown"; cause: string };
interface Hunk { anchor: string | null; old: string[]; neu: string[]; eof: boolean }
interface ProposedChange { session; callId; tool; path; edit; from: string | null }   // from: origen de un Move
type HookEvent = … | { kind: "pre-edit"; changes: ProposedChange[] }                  // ≥ 1, una llamada
```
A16 se extiende solo con lo que hoy produce algún adaptador. No se agregan `batchId`, `before` ni `after` al tipo.

**MH-08. Patch de Codex: parser propio, estricto y puro, dentro de `codex.ts`.**
- Gramática que se acepta [V en las capturas; D para `@@ ctx` y `*** End of File`]:
  ```
  patch  := "*** Begin Patch" NL op+ "*** End Patch" [NL]
  op     := "*** Add File: " P NL ("+" L NL)*
          | "*** Delete File: " P NL
          | "*** Update File: " P NL ["*** Move to: " P NL] chunk+
  chunk  := ("@@" | "@@ " CTX) NL ((" " | "-" | "+") L NL)* ["*** End of File" NL]
  ```
- **Rutas: solo absolutas.** Una ruta relativa ⇒ `unknown`, y el deny dice "resend the patch with absolute paths". Todas las capturas eran absolutas [V], y una relativa es ambigua: Codex la resuelve contra el `workdir` del shell, que el payload no trae [V]. Un segmento `.`, `..` o vacío ⇒ `unknown`.
- Qué produce cada operación:
  - Add ⇒ `full`, con el contenido = las líneas unidas por `\n` y un `\n` final [S; el E2E de §6.3 lo verifica por igualdad con el disco].
  - Delete ⇒ `delete`.
  - Update ⇒ `hunks`.
  - Update + Move ⇒ dos cambios: `{path: origen, delete}` y `{path: destino, hunks, from: origen}`. El "actual" del destino es el texto del origen.
- Se aplica con `reconstruct.apply`: cada hunk busca su secuencia `old` (las líneas `" "` y `"-"`) **exacta**, desde el final del hunk anterior y después del `anchor` si lo tiene, y al final del archivo si lleva `eof`.
- **No se porta la cascada difusa de Codex** (trim, normalización Unicode). Un hunk que no aparece exacto, o que no tiene líneas `old` (inserción pura, cuya semántica no está verificada), da `cannot-reconstruct`: un deny de forma que dice "resend the patch with exact context lines". El error queda del lado seguro, porque nunca se juzga un texto distinto del que Codex escribiría. El costo es algún falso deny cuando el contexto difiere en espacios; se mide en §6.3 y en el piloto, y se porta la cascada solo si aparece.
- Lo que no entra en la gramática (patch envuelto en heredoc, falta `@@`) ⇒ `unknown("patch-grammar")` ⇒ `cannot-reconstruct`. Es un deny que el agente puede resolver, no `payload-unrecognized`.

**MH-09. Varios archivos por llamada: se evalúan todos y basta un deny.** `gate.onPreEdit(changes)` hace lo siguiente:
1. Reconstruye todos los `after`.
2. Juzga cada archivo con un `Read` **superpuesto**: los demás archivos del mismo patch se ven con su `after`, o como inexistentes si se borran. Sin esto, un patch que crea `a.ts` y lo importa desde `b.ts` daría `unresolvable-import` en `b.ts`.
3. Registra un `CallEvent` por archivo (el `callId` es compartido y el `fileH` distinto).
4. Combina con `merge(decisions)`, una función pura en `decide.ts`:
   - primero la que tiene `halt`; si no, el primer deny; `ask` solo si todas las que bloquean son `ask`;
   - el `full` de la elegida suma una línea por cada otro archivo bloqueado (su `compact`), dentro de `TEXT_MAX`.

Un patch de un solo archivo sigue exactamente el camino de hoy.

**MH-10. Borrado (Delete de Codex y de Cursor).** Se aplican solo las protecciones del paso 5 (y MH-17). El resto lo juzga Stop sobre el árbol, igual que un `rm` por shell (§4.2: "la verdad es el árbol"). Por eso un borrado de `.pregate/**` o de `.git/**` se deniega, y un `rm`-equivalente de un archivo en scope pasa a Stop, pre-commit y CI. Un Move aplica esto al origen y la evaluación completa al destino. Residuo: Cursor `-p` no tiene Stop [V], así que ahí un Delete en scope llega a pre-commit y CI.

**MH-11. Formas de agy.**
- `write_to_file`: sin `Append`, es `full` (`TargetFile` y `CodeContent`) [V]. Con `Append: true`, es `append` y `after = actual + CodeContent`, o `CodeContent` si el archivo no existe [V].
- `replace_file_content` es `oldnew`, con `lines = [StartLine, EndLine]` (1-indexed e inclusivo) y `all = AllowMultiple`. Se busca `TargetContent` exacto **dentro del rango**.
  - Si no aparece, o aparece más de una vez sin `AllowMultiple`, es `cannot-reconstruct`: agy podría hacer matching difuso [S], así que no se afirma que la tool vaya a fallar.
  - Si falta el rango, se busca en todo el archivo.
- Claves con lista cerrada: además de las requeridas, se aceptan `Overwrite`, `Description`, `Instruction`, `TargetLintErrorIds`, `ArtifactMetadata`, `toolAction` y `toolSummary`. Cualquier otra ⇒ `unknown`, porque puede cambiar lo que se escribe (el mismo criterio que con Claude).
- `multi_replace_file_content` ⇒ `unknown`: no existe en 1.2.14 [V] y su forma es [D]. Entra cuando haya captura.
- `run_command` es un comando (`CommandLine`, con `Cwd` como cwd). `send_command_input` ⇒ `shell-write`: manda stdin a un proceso que no se puede analizar.

**MH-12. Formas de Grok.**
- **Antes que la tool:** `toolInputTruncated` distinto de `false` (también ausente) ⇒ `cannot-reconstruct` en **cualquier** tool, con el deny "write the file in pieces under 128 KiB" o "split the command" (SPEC §14.5). Un `run_terminal_command` truncado puede esconder la parte que escribe.
- `write` ⇒ `full`.
- `search_replace` ⇒ `oldnew`. `replace_all` es opcional y su ausencia vale `false` [V]. Claves cerradas: `file_path`, `old_string`, `new_string` y `replace_all`.
- `hashline_edit` ⇒ `unknown`, y el deny dice "resend the change with `write` and the whole file". `write` existe en los dos toolsets [V], así que el agente siempre tiene salida. Tampoco hace falta reimplementar las anclas: el toolset hashline no viene activo por defecto.
- `apply_patch`, `edit` y `bash` (preset codex y agente opencode) ⇒ `unknown` hasta capturarlos. `apply_patch` usará el parser de MH-08 (segundo uso) cuando haya contrato.
- `run_terminal_command` ⇒ comando, leyendo solo `command`.

**MH-13. `old_string` vacío sobre un archivo que no existe crea el archivo.** Pasa en Claude Code [V, `pre-edit-empty-old.json`] y en Grok [V, `pre-search-replace-create.json`]. `apply` lo reconstruye como `after = neu`, y esto reemplaza a O11 en ese caso. Con el archivo existente, sigue siendo `unknown`.

Cursor no necesita formas nuevas. Toda edición llega como `Write` con el archivo completo, o como `Delete` [V]. Las claves son cerradas: `file_path` y `content`.

---

## 3. Salida por harness

**MH-14. Tabla de encode.** Ningún harness emite nunca `allow` (A14). Lo verifica un test sobre todas las salidas.

O57 supersedes the historical SessionStart column and MH-25 below: consenting
Claude and Codex sessions receive `hookSpecificOutput.additionalContext`;
Cursor registers native `sessionStart` with `additional_context` (shared delivery
stands aside); agy registers flat `PreInvocation` with
`injectSteps: [{ephemeralMessage: summary}]` only at `invocationNum == 0`.
These are contract-tested against captured payloads, not new live model runs.
Grok 1.0.48's bundled hooks guide explicitly says passive SessionStart stdout is
ignored; its session briefing remains unavailable. `/pregate` can load the contract.

| Harness | Pre: deny | Sin objeción | `ask` | Halt | Stop que bloquea | Señal de reingreso a Stop | SessionStart |
|---|---|---|---|---|---|---|---|
| claude-code | igual que hoy: JSON `permissionDecision:"deny"` + stderr, exit 2 | `""` exit 0 (más `additionalContext` si hay warns) | igual que hoy | `continue:false` + `stopReason` | `{"decision":"block","reason"}` exit 2 | `stop_hook_active` | igual que hoy |
| codex | **stdout vacío, stderr = `full`, exit 2** [V] | `""` exit 0 | ⇒ deny (MH-05) | **nunca**: `continue:false` hace fallar el hook y la tool corre [V]. Lo reemplaza el texto del deny | `{"decision":"block","reason":full}` exit 0, **sin otras claves** [V] | `stop_hook_active` [V] | `""`: ningún canal verificado [E2E: `additionalContext`] |
| cursor | `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":full}}` exit 0: el formato de Claude, verificado en un hook nativo **y** en uno importado [V] | `""` exit 0 (sin `failClosed`, el vacío es "sin decisión" [C]) | ⇒ deny | no existe | `{"followup_message":full}` exit 0 [V nativo; E2E importado] | `loop_count > 0` [V]: alimenta `stop.reentry` en `decide`, que solo es neutro para causas humanas; el tope lo da `maxStopBlocks` | `""` |
| grok | JSON `hookSpecificOutput` deny con razón = `compact` en una línea, stderr igual, exit 2 [V] | `""` exit 0 | ⇒ deny | se ignora [V], no se emite | `{"decision":"block","reason"}` exit 0 [V comportamiento; E2E exit] | `stopHookActive` [V]; `reason:"shutdown"` ⇒ `null` | `""` |
| agy | `{"decision":"deny","reason":full}` exit 0 [V] | `""` exit 0: neutro verificado, porque en la corrida 4 el sistema de permisos siguió decidiendo [V] | ⇒ deny | no existe | `{"decision":"continue","reason":full}` exit 0 [V] | `executionNum > 0` [V] | no se registra (MH-25) |

- La columna de reingreso es la **señal**, no la salida: en los cinco, el reingreso entra a `decide` como `stop.reentry`. Un reingreso nunca es neutro por sí solo.
- `Decision.notice`, el texto para el humano, solo tiene canal propio en Claude Code (`systemMessage`). En los demás, el texto del deny de una causa humana ya termina en "report it to the user: run …", y eso llega al humano a través del agente.
- `{"decision":"allow"}` de agy no se emite: saltea el prompt de permisos [D]. Por eso el neutro de agy es el stdout vacío, que en la corrida 4 dejó actuar al sistema de permisos [V]. §6.3 lo vuelve a comprobar sin `--dangerously-skip-permissions`.

**MH-15. Fail-closed del launcher.**
- **Pre, en los cinco: exit 2 + una línea de stderr no vacía de ≤ 256 caracteres, con el stdout vacío** ("PREGATE could not evaluate: <why>; report it to the user"). Bloquea en todos [V]: Claude, exit 2; Codex, exit 2 con stderr no vacío; Cursor, "Hook blocked with message: <stderr>"; Grok, la primera línea de stderr; agy, falla del hook. Como la salida es una sola, Pre no necesita detectar el dialecto. Claude pierde el `continue:false` del fail-closed actual: con la instalación rota, cada Pre siguiente también deniega, así que el agente no avanza igual.
- **Invariante: todo exit 2 lleva stderr no vacío.** Codex deja correr la tool con exit 2 sin stderr [V]. Por eso:
  - el trap de `TERM`/`HUP` (el harness canceló el hook) escribe "PREGATE was cancelled before deciding; report it to the user" en fd 4 antes del `exit 2`;
  - si el motor sale con exit 2 y su stderr está vacío, el launcher aplica `fail_closed`.
- **Stop:** bloquea solo en Claude Code (flag `claude-code` y sin `GROK_HOOK_EVENT` ni `CURSOR_VERSION` en el entorno [V: Cursor la define]), con la salida de hoy. En los demás, exit 0 neutro: Pre ya bloquea, y pre-commit y CI cubren el resto.
- **SessionStart:** en Claude, `systemMessage`; en los demás, neutro.
- **El motor de su propia `version` no está** (o está vacío: `[ -x ] && [ -s ]`): deniega siempre, con "run `pregate setup`". El update escribe el motor antes que el launcher (MH-27), así que esto solo pasa si alguien borró el motor, que es una ruta protegida.
- **PATH propio.** El launcher usa `PATH=/usr/bin:/bin` para sus comandos (`sleep`, `mktemp`, `cat`, `sed`, `grep`, `rm`) y le pasa al motor el PATH original (el motor llama a `git`, que puede estar en `/opt/homebrew/bin`). Sin esto, un PATH raro del harness deja al launcher sin `sleep`, es decir, sin plazo.

**MH-16. Límites de longitud.**

| Harness | Límite verificado | Qué se manda |
|---|---|---|
| Claude | — | `full` ≤ 4.000 (`TEXT_MAX`) |
| Codex | íntegro hasta ~20 KB; después corta cabeza y cola, y agrega `. Command: <patch>` [V] | `full` ≤ 4.000; la primera línea, autosuficiente |
| Cursor | ~12 KB llegaron completos [V, `user_message`]; [E2E] el mismo largo por `permissionDecisionReason` | `full` |
| Grok | **256 caracteres y solo la primera línea** [V] | `compact` sin `\n` (≤ 256), que termina con el pre-check `pregate explain`. [E2E] si `additionalContext` llega en un deny: si llega, va `full` ahí |
| agy | íntegro hasta 28 KB [V] | `full` |

`message.ts` ya garantiza `compact` ≤ 256. Lo que se agrega es que en Grok se reemplacen los saltos de línea.

**MH-17. Fuera de un repo con preset: silencio y costo mínimo, pero la máquina protegida.**

Con la instalación global, el hook corre en **todo** repo. Hoy eso tiene tres efectos que D20 no admite: SessionStart avisa "no-preset" en cada sesión; Pre y Stop escriben estado en cada llamada; y las protecciones y el guard de shell objetan en cualquier repo (por ejemplo, `.git/**` u otro harness como comando).

- **Cuándo una llamada "no alcanza ninguna raíz":** ni su cwd ni **ninguna** de las rutas que toca alcanza una raíz, y la sesión no registró ninguna (`state.roots(sid)` vacío). Para un comando, las rutas son todas las rutas literales que extrae el guard, no solo el cwd: `cd /tmp && echo x > /repo/src/a.ts` alcanza `/repo`.
- **En ese caso:** no se escribe estado, no se llama a git, no se carga WASM y SessionStart queda en silencio. Objetivo: p50 ≤ 25 ms.
- **Pero siempre corren dos cosas, porque son puras y baratas:**
  1. **Rutas protegidas de máquina** (`paths.machineGlobs`), con o sin raíz:
     - el registro: `~/.claude/settings*.json` (y `${CLAUDE_CONFIG_DIR}/settings*.json`), `${CODEX_HOME:-~/.codex}/{hooks.json,config.toml,requirements.toml}`, `${GROK_HOME:-~/.grok}/{config.toml,hooks/**,hooks-paths,managed_config.toml,requirements.toml}`, `~/.gemini/config/{hooks.json,config.json,plugins/pregate/**}`;
     - la instalación propia: `<DATA>/**`, `<STATE>/**`, `~/.local/bin/pregate`;
     - `**/.pregate/**`: el agente no crea raíces (A20);
     - además, el **realpath** de cada uno de esos archivos: con dotfiles en symlink, `canonical()` resuelve al destino y la glob literal no lo cubriría.
  2. **El guard de shell, restringido** a `protected-path` y a `hook-switch`: `pregate setup|update|uninstall`, `agy plugin disable|uninstall pregate`, `GROK_CLAUDE_HOOKS_ENABLED`, `CODEX_HOME`, `GROK_HOME`, `CLAUDE_CONFIG_DIR`, `--ignore-user-config`, `--setting-sources`, `--settings`, `disableAllHooks`, `features.hooks`.
- **Lo que no corre sin raíz:** `.git/**`, `.claude/settings*.json` de proyecto, las fuentes de reglas, las causas de scope, `shell-write` y `shell-admin` (otro harness como comando, `--no-verify`, `core.hooksPath`, `HUSKY`…). Correr `codex exec` desde un repo sin preset no es una fuga: ese Codex también tiene a PREGATE. Solo es fuga si lo lanza sin la config de usuario, y eso es `hook-switch`.
- **Por qué siempre.** Un agente que apaga hooks no necesita haber sido bloqueado antes: un subagente de Cursor, Grok o agy es una sesión nueva con el estado vacío [V], y una sesión abierta en `~` no tiene raíz. Borrar el `trusted_hash` de PREGATE en `~/.codex/config.toml` apaga Codex en silencio y para siempre [V: un hook `modified` no corre].
- **Costo para el usuario** (U-5): ningún agente puede editar esos archivos de configuración global en ningún repo. Los edita el humano, o el humano corre el comando que el agente le propone.

---

## 4. Instalación global

**MH-18. Layout.**
```
${XDG_DATA_HOME:-~/.local/share}/pregate/      = <DATA>, resuelto y escrito por setup
├── 0.2.0/pregate            motor inmutable (uno por versión; conviven)
└── bin/pregate              LAUNCHER GLOBAL: launcher.sh con version=<x>, reescrito atómicamente
~/.local/bin/pregate  ->  <DATA>/bin/pregate     CLI en el PATH
${XDG_STATE_HOME:-~/.local/state}/pregate/
├── …                       estado de hooks (layout de hoy)
└── codex-trust.json        {"<key>":"sha256:…"}: el trust que setup otorgó (MH-24, MH-27)
```
- El launcher es **un solo asset** (`assets/launcher.sh`) con una sola instalación: la global. `version=<x>` señala al motor; el update escribe el motor nuevo y después reescribe el launcher (MH-27). No hay symlink `current`, ni `install.json`, ni `install.lock`: el uninstall reconoce lo propio por marcador, las escrituras son atómicas e idempotentes, y setup lo corre un humano.
- El motor deriva `engineHome()` de su propio ejecutable (`dirname(dirname(process.execPath))`) y no de `XDG_DATA_HOME`. El entorno del hook (GUI frente a terminal, `.zshenv`) puede diferir del de setup, y así el motor y las rutas protegidas son siempre las de la instalación que corre.
- Lo que no puede cambiar es el **texto del comando registrado** (MH-22). El contenido del launcher se actualiza en su lugar.

**MH-19. El motor lo elige el lock de cada repo, sin que el update rompa repos.**
- Se mantiene la regla `lock.engine === VERSIONS.engine` (`freshness`): el lock fija la semántica.
- **Hooks.** El launcher corre su `version`. El motor decodifica, localiza la raíz del **objetivo** de la llamada (archivo, cwd o raíz del evento) y lee `"engine"` de su lock. Si coincide, evalúa. Si no, escribe la versión en la primera línea de stdout y sale con **exit 3**: para el launcher, exit 3 significa "corré este motor". En Pre explícito devuelve después de esa línea el stdin original; así el camino normal no espera una copia antes de iniciar el motor.
  - El launcher valida `^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$` sobre la primera línea y reejecuta `<DATA>/<v>/pregate` con el mismo stdin, **una sola vez** y dentro del mismo plazo. Para Pre explícito extrae el resto de stdout y rechaza replay ausente o sin comienzo de objeto JSON. Stop, SessionStart y auto conservan la captura inicial porque la necesitan para interpretar eventos/fallos.
  - Un segundo exit 3, una versión inválida o un motor ausente terminan en la salida fail-closed, con el motivo "engine <v> is not installed: run `pregate update --engine <v>`".
  - **Por qué no lo resuelve el `sh` solo:** la raíz depende del payload. El cwd del hook es `~/.claude` en Cursor y la carpeta del plugin en agy [V], en un monorepo la raíz puede estar debajo del project dir, y un patch de Codex toca varios archivos. El motor ya sabe localizarla.
  - Costo: un spawn más (~15 ms), y solo en repos fijados a otra versión.
  - Stop y SessionStart usan la raíz del cwd del evento. Si en una sesión hay otra raíz fijada a otra versión, Stop da `version-mismatch` (deny más aviso), y el resto lo cubren pre-commit y CI.
- **CLI.** `check`, `explain` y `preset show` aplican la misma regla, pero desde TS: si el lock de la raíz pide otro motor, el motor hace spawn de `<DATA>/<v>/pregate` con los mismos argumentos y stdio heredado, **antes de leer stdin**, y sale con su código. Si ese motor no está, sale con 1 y "run `pregate update --engine <v>`". `preset compile` y `rules test` nunca redirigen: `compile` es justamente cómo un repo pasa al motor nuevo.

**MH-20. Piso de motor (`FLOOR`).** Una constante en `main.ts`, hoy `FLOOR = "0.2.0"`. Si el lock fija un motor anterior a `FLOOR`, no se redirige y se deniega con `lock-stale` ("this repo's lock pins engine <v>, below the safe floor: run `pregate preset compile`"). Cubre dos casos: los motores 0.1.0 no conocen a los harnesses nuevos (sin esto, darían un `payload-unrecognized` que confunde), y un fail-open de adaptador arreglado en una versión nueva no puede seguir vivo en los repos fijados. Se sube cuando se corrige un fail-open de adaptador.

**MH-21. Formato del estado.** Los motores de distintas versiones comparten `stateDir()`. La versión que cambie el formato de `CallEvent`, de la snapshot o de los nombres pasa a un subdirectorio nuevo (`v2/`), para que un motor viejo no lea registros que no entiende. No se crea `v1/` por adelantado. El checklist de release lo pregunta.

**MH-22. Registro.** `<CMD ev h>` es este texto, congelado entre versiones:
```sh
f='<DATA>/bin/pregate'; [ -x "$f" ] && [ -s "$f" ] && exec "$f" hook <ev> --harness <h>; for d in "${CLAUDE_PROJECT_DIR:-}" "${CURSOR_PROJECT_DIR:-}" "${GROK_WORKSPACE_ROOT:-}" "$PWD"; do while [ -n "$d" ] && [ "$d" != / ]; do [ -f "$d/.pregate/preset.json" ] && { printf '%s\n' 'PREGATE could not evaluate: its launcher is missing; report it to the user' >&2; exit 2; }; d=$(dirname "$d"); done; done; exit 0
```
- `<DATA>` es la ruta absoluta resuelta en el `setup`. La rama `exit 2` existe solo en `pre`; en `stop` y `session-start`, el bloque del `for` es `exit 0` directo.
- `[ -s ]`: un launcher vacío o truncado haría que `exec` termine, ante ENOEXEC, ejecutándolo como script vacío, es decir, exit 0 sin salida: allow en Codex, Grok, agy y Claude.
- **Corrección de aceptación real (2026-10-02):** el registro compartido ejecuta la ruta literal, sin la variable local `f`. Grok expande `$VAR` antes del shell y omite comandos con locales todavía sin definir. El fallback se conserva, pero sus dólares se decodifican con `printf '%b'` solo cuando falta el launcher. Los bytes vigentes están en `test/fixtures/hook-command.txt`; el comando de Codex conserva sus bytes y trust. El camino normal no agrega procesos.
- **agy** (su `PWD` es el directorio del plugin y no hay variables de proyecto [V]): en `pre`, los candidatos se reemplazan por `workspacePaths[0]`, leído del stdin con `p=$(cat); w=$(printf '%s' "$p" | sed -n 's/.*"workspacePaths":\["\([^"\\]*\)".*/\1/p')`. Si el payload contiene `"workspacePaths"` pero `w` sale vacío (una ruta con escapes), deniega.
- Es válido en `sh`, dash y zsh [E2E: Cursor ejecuta con `$SHELL`, `/bin/zsh` en la máquina del usuario]. El **marcador** de lo propio es la igualdad exacta de `command`, `timeout` y `matcher` con lo que escribe setup. Un grupo que contiene `<DATA>/bin/pregate'` sin ser igual se considera **una versión vieja nuestra** y se reemplaza, pero nunca recibe trust automático (MH-24).
- **Timeouts.** Pre: **30 s** en los tres registros. El plazo de 5 s del launcher sigue gobernando, y los 30 s del harness solo cubren un launcher que tarda en arrancar (carga, sueño de la máquina, swap). Codex, Grok y Claude fallan abiertos al vencer [V]. Stop: 60 s. SessionStart: 15 s.

| Registro | Archivo (respeta la reubicación) | Entradas (solo agrega o reemplaza las propias) | Notas |
|---|---|---|---|
| compartido (Claude Code, Cursor, Grok) | `~/.claude/settings.json`, y además `${CLAUDE_CONFIG_DIR}/settings.json` si esa variable está definida y apunta a otro lado (Cursor y Grok leen el de `HOME` [V]) | `PreToolUse` `Write\|Edit\|MultiEdit\|NotebookEdit\|Bash\|PowerShell\|Monitor\|Delete\|apply_patch\|edit\|bash\|write\|search_replace\|hashline_edit\|run_terminal_command`, 30; `Stop` 60; `SessionStart` 15; `--harness claude-code` | Se registran también los nombres nativos de Grok: sus alias de Write no cubren `write`. Delete de Cursor verificado; los tres literales de Grok no fueron ofrecidos (§6.4). |
| codex | `${CODEX_HOME:-~/.codex}/hooks.json` (nunca `config.toml`) | `PreToolUse` `^(apply_patch\|Bash)$`, 30; `Stop` 60; `SessionStart` 15. Grupos **al final** | El default es 600 s y falla abierto [V], así que el timeout es explícito. Trust: MH-24 |
| cursor, Stop nativo | `~/.cursor/hooks.json` | `version:1`, `hooks.stop`, comando plano, timeout 60, `loop_limit:null`, `--harness cursor` | El TUI no entra al dispatcher de Stop si solo existe el importado. El Stop compartido se omite cuando esta instalación posee el nativo; los followups comparten el contador aunque cambie `generation_id`. |
| agy | plugin `pregate-global` (MH-25) | `PreToolUse` `^(write_to_file\|replace_file_content\|multi_replace_file_content\|run_command\|send_command_input)$`, 30; `Stop` 60 | No se escribe en `~/.gemini/config/hooks.json`, que lo administra Orca [V] |

- **Listas cerradas de tools.** Un matcher anclado no ve una tool de escritura nueva que traiga un update del CLI (Cursor y Grok se actualizan solos). Lo que se descartó (matcher `*` con allowlist en el launcher) costaba un spawn en cada lectura de la máquina. Lo que se hace: `doctor` compara la versión de cada CLI con `VERIFIED` y avisa si difiere; el E2E de §6.3 inventaría las tools en cada versión nueva antes de subir `VERIFIED`. Las tools MCP que escriben archivos quedan fuera del gate en los cinco, igual que en el MVP; las ven Stop, pre-commit y CI.

**MH-23. Merge.** `src/register.ts` generaliza `mergeHooks` y `mine` de `install.ts` como funciones puras:
- Se parsea el archivo, se reemplazan **en su lugar** los grupos propios y se agregan al final los que faltan. El orden y las claves ajenas no se tocan (Orca, ArkGate, cmux y cualquier otro).
- Si el archivo no es un objeto JSON, o un evento no es un array, error y **no se escribe nada**.
- Se escribe **solo si cambian los bytes**, con escritura atómica (tmp + fsync + rename). Si el archivo es un symlink (dotfiles), se escribe su destino.
- La primera vez que se modifica un archivo ajeno se guarda un backup en `<archivo>.pregate.bak`, una sola vez.

Correrlo dos veces deja los mismos bytes y el mismo mtime. `JSON.stringify` reformatea el archivo: lo ajeno queda igual en contenido, no necesariamente en espacios. En `~/.codex/hooks.json` eso puede importar para el trust ajeno [E2E: reformatear los espacios y medir `trustStatus`]. Si importa, el merge de Codex empalma el texto (agrega dentro del array) en lugar de reescribirlo. La transacción de MH-24 lo hace seguro en los dos casos.

**MH-24. Trust de Codex por app-server, en una transacción.** Codex no ejecuta un hook de usuario sin trust, y uno modificado o corrido de índice deja de correr en silencio [V].
1. `setup` lanza `codex app-server` (JSON-RPC por stdio), manda `initialize` y `hooks/list` (`cwds:[]`), y guarda la foto: qué keys estaban `trusted`.
2. Escribe `hooks.json` (MH-23).
3. Vuelve a pedir `hooks/list`. A las keys cuya definición es **exactamente** la que setup escribió (`command`, `timeout` y `matcher`), con `trustStatus ∈ {untrusted, modified}`, les escribe el trust: `config/batchWrite {keyPath:"hooks.state", mergeStrategy:"upsert", value:{<key>:{trusted_hash:<currentHash>}}}` [V].
4. Verifica con un tercer `hooks/list` que las propias están `trusted` y que **toda key ajena que estaba `trusted` en la foto lo sigue estando**. Si no, restaura los bytes previos de `hooks.json` (volver al texto original restaura el trust [V]), sale con 1 y lista las keys afectadas.
5. Guarda `{key: trusted_hash}` de las propias en `codex-trust.json`, para la detección de deriva (MH-27).
- Como el comando no cambia entre versiones, un update no invalida el trust. Para no mover índices ajenos, los grupos propios se agregan al final y se reemplazan en su lugar.
- **Uninstall:** saca los grupos propios. Como van al final, solo se corren los índices de grupos ajenos que alguien agregó después. Esas keys se listan y se le pide al usuario que las apruebe en `/hooks`: PREGATE no otorga trust a hooks ajenos (D20 cubre los de PREGATE).
- Sin el binario `codex`, el registro igual se escribe, `setup` avisa y `doctor` falla.

**MH-25. Plugin de agy.**
- `setup` genera el plugin en un directorio temporal, con `plugin.json` (`{"name":"pregate-global"}`) y un `hooks.json` con un único named hook `"pregate-global"` que tiene `enabled:true` y las entradas de MH-22. Después corre `agy plugin install <dir>`, que lo copia a `~/.gemini/config/plugins/pregate-global/`, y verifica que `plugins.pregate-global.enabled` no sea `false` en `~/.gemini/config/config.json`. La identidad distinta evita que un plugin de proyecto llamado `pregate` anule al global (§6.4).
- Es idempotente: si el `hooks.json` instalado es byte a byte igual, no se reinstala. El uninstall es `agy plugin uninstall pregate-global`, verificado en §6.4; se borra solo el directorio propio.
- **Sin SessionStart:** agy no lo tiene [V]. La snapshot se toma en el primer Pre que alcanza una raíz. La aceptación de un preset sin commitear sigue la regla general de A20 revisada (MH-33).
- **Sin PostToolUse que bloquee** [D]. El matching difuso de `replace_file_content` lo cubren Stop, pre-commit y CI.

**MH-26. Detección de harnesses** (patrón de orderfield): un harness cuenta como presente si existe su home o si su binario está en el PATH.

| Harness | Home | Binario | Registro |
|---|---|---|---|
| claude-code | `~/.claude` | `claude` | compartido |
| cursor | `~/.cursor` | `cursor-agent` o `agent` | compartido |
| grok | `$GROK_HOME` o `~/.grok` | `grok` | compartido |
| codex | `$CODEX_HOME` o `~/.codex` | `codex` | `hooks.json` |
| agy | `~/.gemini/antigravity-cli` | `agy` | plugin |

El registro compartido se escribe si está presente cualquiera de los tres que lo leen, aunque Claude Code no esté instalado. No hay `--harness` en setup: los tests usan un `HOME` temporal.

---

## 5. CLI, `install.sh` y releases

**MH-27. Comandos de máquina.** Son actos humanos: el guard de shell los deniega al agente, con o sin raíz (MH-17).

| Comando | Qué hace |
|---|---|
| `pregate setup` | Instala el motor que corre en `<DATA>/<v>/` si falta (copia + warm-up, como `firstRun`), escribe el launcher global (tmp + rename), el symlink de `~/.local/bin`, los registros (MH-22, MH-23), el trust de Codex (MH-24) y el plugin de agy (MH-25). Es idempotente |
| `pregate update [--version v \| --engine v]` | Consulta el último tag con `gh`, baja el tar de la plataforma y `SHA256SUMS`, verifica y extrae el motor **al lado** de los otros, hace el warm-up y recién entonces reescribe el launcher con la versión nueva y vuelve a correr `setup` (normalmente sin cambios). **No toca los locks.** `--engine v` instala un motor sin cambiar el launcher: es para el lock que lo pide |
| `pregate uninstall [--purge]` | Saca lo propio en orden inverso: registros por marcador (MH-24 para Codex), el plugin de agy, el symlink (solo si apunta a lo nuestro), el launcher y los motores. `--purge` borra también el estado. **Nunca toca `.pregate/` de los repos.** Los backups quedan, y el comando dice dónde |
| `pregate doctor` | Por harness: el binario y su versión contra `VERIFIED` (embebida en cada adaptador), la deriva (abajo), el trust de Codex por `hooks/list` (la única forma de ver un gate apagado, porque Codex no avisa [V]), el plugin de agy habilitado, el PATH y `gh auth`. Hace un **canario**: corre el comando registrado **literal a través de `$SHELL -c`** con un payload fixture por harness sobre un repo temporal con preset, y espera un deny en el dialecto correcto (eso detecta un `.zshenv` que imprime y rompería Cursor). Sale con 1 si algo falla |

- **Deriva** (`register.drift`, pura, dos usos: `doctor` y `check --staged`, que corre en el pre-commit). Lista problemas en lenguaje humano, sin cambiar el código de salida del pre-commit:
  - de la máquina: las entradas propias faltan o difieren de las esperadas en `~/.claude/settings.json`, `~/.codex/hooks.json` o el plugin de agy; `plugins.pregate.enabled = false`; `[compat.claude] hooks = false` en `~/.grok/config.toml`; el `trusted_hash` de las keys propias en `~/.codex/config.toml` difiere de `codex-trust.json`, o la key ya no apunta a nuestro grupo (índice corrido);
  - del repo: `disableAllHooks` en `.claude/settings*.json`, `[features] hooks = false` en `.codex/config.toml`, y un plugin de proyecto o un `plugins.json` que nombran `pregate` en `.agents/`.
  - El pre-commit es el único canal hacia el humano que existe en los cinco harnesses, y también funciona cuando el que se apagó es el hook de Codex, cuyo SessionStart tampoco corre sin trust.

**MH-28. `pregate install` (por repo) deja de registrar hooks y de commitear un launcher.** Queda para lo que pertenece al repo: `--git-hook` y `--ci github`.
- El pre-commit llama a `pregate check --staged --ratchet` del PATH (`command -v pregate || "$HOME/.local/bin/pregate"`). Si no está, falla el commit con "instalá PREGATE". Por MH-19, corre el motor que pide el lock.
- La plantilla de CI lee `"engine"` del lock y baja esa versión, verificada contra `SHA256SUMS` (`sha256sum -c --ignore-missing`).
- Si encuentra en `.claude/settings.json` grupos propios de 0.1.0, o un `.pregate/bin/pregate` commiteado, los saca y avisa.
- Con eso desaparecen la doble evaluación en Claude Code, el deny total de Cursor y Grok sobre un motor 0.1.0, y el desfasaje entre `lock.engine`, el `version=` del launcher commiteado y el `VERSION` de la CI al migrar un repo. Se elimina `--harness`. Hay un solo camino para los hooks, el global, y uno para el motor, el lock.

**MH-29. Pre-check y guard de shell.**
- `message.ts` cita `pregate check --stdin --path <file> --format agent`.
- El guard permite como `argv[0]`, para `check`, `explain`, `preset show` y `rules test`: el `pregate` desnudo y `<DATA>/bin/pregate`.
- Al regex `HARNESS` se suman `agy`, `antigravity`, `cursor` y `agent` (este último solo como `argv[0]` exacto, no como segmento de `node_modules/`). Medido: `agy plugin disable pregate`, `agent -p x` y `cursor agent -p x` dan `null` hoy.
- `ADMIN_WORD` suma `--ignore-user-config`, `--setting-sources` y `features.hooks`. `HOOK_SWITCH` suma `CODEX_HOME`, `GROK_HOME` y `CLAUDE_CONFIG_DIR`. Estos y los de MH-17 forman la causa nueva `hook-switch`, que corre siempre. El resto de `shell-admin` corre solo con raíz.
- `apply_patch` y `applypatch` como comando de shell ⇒ `shell-write` ("use the apply_patch tool"). [E2E] si Codex 0.159.2 los convierte en la tool.
- **Shell interactivo con stdin sin hook.** Un `argv[0]` que es un shell, un intérprete, un REPL o un editor, sin script ni `-c`/`-e`, o con `-i`/`-s`/`-` (`bash`, `sh -s`, `python3`, `node`, `ed`, `vim`, `script`, `tmux`; medido: hoy dan `null`) ⇒ `shell-write` ("interactive session: its input cannot be checked"). Cierra `write_stdin` de Codex, que no dispara PreToolUse [D]; `send_command_input` de agy ya se deniega (MH-11).
- **Codex, destino relativo.** El `Bash` de Codex no trae el `workdir` de `exec_command` [V]. Un destino de escritura relativo en una sesión con raíz ⇒ `shell-write` ("use absolute paths"). [E2E] si el `cwd` del payload refleja el `workdir`: si lo refleja, la regla se retira.

**MH-30. Rutas protegidas nuevas con raíz** (paso 5; las de máquina están en MH-17):
- `**/.codex/hooks.json` y `**/.codex/config.toml`;
- `**/.cursor/hooks.json`, `**/.cursor/cli-config.json` y `**/.cursor/managed/**`;
- `**/.grok/hooks/**` y `**/.grok/config.toml`;
- `**/{.agents,.agent,_agents,_agent}/{hooks.json,plugins.json,plugins/**}`.

`**/.claude/settings*.json` ya estaba.

**MH-31. `install.sh`** (estilo orderfield; solo baja, verifica, extrae y delega):
- Uso: `install.sh [--version vX]`. Instala siempre global.
- `DEFAULT_VERSION` está escrito en el script, en lockstep con `package.json`. Se rechazan `main` y `HEAD`.
- Elige el target (`darwin-arm64` o `linux-x64`). El origen es el release, con `gh release download`. Para desarrollo, tests y modo offline: `PREGATE_ARCHIVE` + `PREGATE_SHA256`.
- Verifica el **SHA-256** contra `SHA256SUMS` con `shasum -a 256` o `sha256sum`. Si no coincide, sale con 1.
- Extrae a un directorio temporal, quita `com.apple.quarantine` en macOS y termina con `exec <tmp>/pregate setup`, que copia el motor a `<DATA>/<v>/` y hace el warm-up (una sola implementación, en TS).
- El uninstall es `pregate uninstall`. Toda la lógica vive en TS, donde está testeada. El script se mantiene tonto.

**MH-32. Releases en `pedroknigge/pregate` (privado).**
- Assets por tag `v<x>`: `pregate-<x>-darwin-arm64.tar.gz` y `pregate-<x>-linux-x64.tar.gz` (binario, LICENSE y THIRD_PARTY_NOTICES), `install.sh` y `SHA256SUMS`, que cubre todo. No hay `.sha256` por tar: la plantilla de CI usa `SHA256SUMS`.
- El repo es privado, así que la descarga va por `gh`, con la sesión del usuario. Sin `gh`, un error claro.
- Bootstrap verificado:
  ```sh
  d=$(mktemp -d) && gh release download --repo pedroknigge/pregate --pattern install.sh --pattern SHA256SUMS --dir "$d" \
    && (cd "$d" && shasum -a 256 -c --ignore-missing SHA256SUMS) && sh "$d/install.sh"
  ```
- Límite honesto: `SHA256SUMS` viene del mismo release, así que protege el transporte y no un release comprometido. `PREGATE_SHA256` permite fijar el hash por fuera.
- **Update:** explícito (`pregate update`); el aviso de versión nueva lo decide U-4. No hay actualización automática.

**MH-33. A20 revisada: aceptación de un preset sin commitear sin depender de SessionStart.** Una raíz se acepta si su `preset.json` está rastreado en HEAD, **o si su ctime es anterior al primer contacto de la sesión con una raíz** (SessionStart o el primer Pre que alcanza una raíz; es el `at` de la primera snapshot de la sesión, que ya se guarda). Antes dependía de SessionStart, que agy no tiene [V], ni los subagentes de Cursor, Grok y agy, que son sesiones nuevas [V]: un repo recién onboardeado quedaba sin gate hasta el commit. El ataque que A20 evita, un preset anidado y laxo creado durante la sesión por un canal que el guard no ve, sigue cerrado: ese preset es posterior al primer contacto.

**MH-34. Onboarding de un repo en el flujo global.** Con PREGATE instalado en la máquina:
1. El humano escribe `.pregate/preset.json` (el agente no puede: ruta protegida; `pregate init` llega en v1).
2. `pregate preset compile` ⇒ `.pregate/pregate.lock.json`, con el motor que corre.
3. Opcional: `pregate install --git-hook --ci github`.
4. Commit. Desde ese momento, los cinco harnesses lo gatean; antes del commit, también, desde la sesión siguiente a su creación (MH-33).

Para migrar un repo a un motor nuevo: `pregate update`, `pregate preset compile` y commit del lock. No hay más archivos que tocar (MH-28).

---

## 6. Plan de pruebas

**6.1 Unit (puras y en CI).**
- **Contrato por payload real.** Por cada harness, un test recorre `test/payloads/<h>/*.json` y **falla si un archivo no tiene expectativa**. Así, una captura nueva obliga a clasificarla. La expectativa es el `HookEvent` esperado, `Rejected` o `null`. Casos que tiene que cubrir:
  - Codex: add+update, move, delete, subagente y el `callId` con hash.
  - Cursor: create, strreplace, applypatch-gpt, delete, shell (cwd `""` con una raíz), task, `claude-import-pre-write` y stop/loop.
  - Grok: write, search_replace (sin `replace_all`), create con old vacío, hashline ⇒ unknown, subagente, shutdown ⇒ `null` y reentry por `stopHookActive`.
  - agy: write, append, replace, multiline, run_command, stop y reentry, y las tools de lectura y subagente ⇒ fuera del matcher.
- **Mutaciones.** Una clave extra en la edición ⇒ `unknown`; la clave de primer nivel quitada ⇒ `BAD`; `"cursor_version"` dentro del contenido de un `Write` de Claude ⇒ sigue siendo Claude; `GROK_HOOK_EVENT` sin `hookEventName` ⇒ el flag; `toolInputTruncated` ausente o `true` en cualquier tool de Grok ⇒ deny; Shell de Cursor con `cwd:""` y dos raíces ⇒ `BAD`; ruta relativa en un patch ⇒ `unknown`.
- **`Rejected` fuera de raíz:** un sobre válido con tool desconocida y `dirs` sin raíz ⇒ neutro y sin estado; con raíz ⇒ deny; sobre que no es JSON ⇒ deny.
- **Encode por harness** × {none, deny, deny+halt, ask, stop block, stop reingreso, session-start}. Invariantes:
  - nunca aparece `allow`;
  - Codex: con exit 2, stdout vacío y stderr no vacío; el Stop lleva exactamente las claves `decision` y `reason`;
  - Cursor: el deny es el JSON de Claude con exit 0;
  - Grok: razón ≤ 256 y sin `\n`;
  - agy: el deny nunca está vacío;
  - fuera de Claude, `ask` ⇒ deny y halt ⇒ sin claves de halt;
  - el reingreso de Stop (las cinco señales) llega a `decide` como `reentry`.
- **Patch.** La gramática: capturas más los casos sintéticos (`..`, `@@ ctx`, varios hunks, `*** End of File`, heredoc ⇒ `unknown`). La aplicación: exacta, contexto ausente ⇒ `cannot-reconstruct`, inserción pura ⇒ `unknown`, Move con `from`.
- **`reconstruct`:** append, rango de agy, old vacío que crea (MH-13).
- **`gate` y `decide`:**
  - superposición (un patch que crea `a.ts` y lo importa desde `b.ts`, sin `unresolvable-import`);
  - `merge` y su prioridad;
  - Delete sobre `.pregate/**` ⇒ deny y en scope ⇒ sin objeción;
  - MH-17: sin raíz, ni un archivo de estado escrito; `~/.claude/settings.json`, `~/.codex/config.toml` y su realpath bajo symlink ⇒ deny sin raíz; `.git/**` sin raíz ⇒ sin objeción; `cd /tmp && echo x > /repo/src/a.ts` ⇒ alcanza la raíz;
  - MH-20 (`FLOOR`) y MH-33 (ctime anterior y posterior a la primera snapshot).
- **`shell`:** `hook-switch` con y sin raíz; `shell-admin` (otro harness) solo con raíz; las palabras nuevas de MH-29; shell interactivo; destino relativo en Codex.
- **`register`** sobre fixtures con la forma real de las configs del usuario (Orca en Claude y Codex; ArkGate):
  - lo ajeno queda deep-equal;
  - la segunda corrida no escribe nada (mismos bytes y mtime);
  - en Codex los grupos propios van al final y los índices ajenos no se mueven;
  - JSON inválido ⇒ no se escribe;
  - un symlink se escribe en su destino;
  - un grupo con el marcador y una cola distinta se reemplaza pero no es "exacto" (sin trust);
  - el uninstall deja lo ajeno deep-equal al original y lista los índices corridos;
  - `drift` detecta cada caso de MH-27.

**6.2 e2e (binario compilado + launcher, sin harnesses reales, en CI).**
- **Launcher:** motor ausente, motor vacío, exit 1, SIGKILL, cuelgue (plazo de 5 s), exit 3 a un motor fijado, exit 3 a un motor ausente o con versión inválida, doble exit 3, motor con exit 2 y stderr vacío, SIGTERM al launcher, PATH vacío. Siempre: Pre fail-closed = exit 2 + stderr de una línea no vacía y stdout vacío. Corre en dash, bash 3.2 y **`zsh -c` con el comando registrado literal** (MH-22), con launcher presente, ausente y vacío, y la variante de agy con `workspacePaths` normal, con escapes y ausente.
- **Por harness:** los payloads reales reescritos a un repo temporal con preset dan deny ante una violación, sin objeción ante una edición limpia, y sin objeción y sin estado en un repo sin preset.
- **CLI:** `check` en un repo fijado a otro motor corre ese motor; `preset compile` no redirige.
- **`HOME=<tmp> pregate setup`** con los cinco detectados (binarios falsos en el PATH): segunda corrida sin escrituras, `uninstall` que restaura y `doctor` en verde. El trust de Codex se prueba contra un app-server falso que reproduce `hooks/list`, `config/batchWrite` y la invalidación por índice; el real, en §6.3.

**6.3 E2E real con cada CLI (opt-in, `scripts/e2e-real.ts`, `PREGATE_REAL=1`).** Es requisito antes de instalar en la máquina real del usuario (D20).
- **Aislamiento.** Se usa el de los relevamientos y nada real se escribe:
  - Codex: `CODEX_HOME` temporal con `auth.json` copiado y `HOME` temporal.
  - Cursor: `HOME` temporal con un symlink a `Library/Keychains`.
  - Grok: `env -i`, `HOME` y `GROK_HOME` temporales, y `auth.json` con el `refresh_token` vaciado.
  - agy: `HOME` temporal con el symlink al keychain.
  - Claude Code: `HOME` temporal, autenticado como en la verificación de O10.
- **Flujo:** `HOME=$tmp pregate setup` (incluye el trust por app-server y `agy plugin install`), un repo git temporal con preset (por ejemplo, `CA-DEP-002` prohíbe `node:fs` en `src/core/**`) y el CLI headless:
  - Codex: `codex exec --json -s workspace-write`.
  - Cursor: `cursor-agent -p --trust --force --output-format stream-json`.
  - Grok: `grok -p --trust --always-approve --output-format streaming-json`.
  - agy: `agy -p --output-format json`.
  - Claude Code: `claude -p --permission-mode acceptEdits`.
- **Cuatro escenarios por harness**, con prompts que nombran la tool:
  1. **Deny real:** "creá `src/core/x.ts` con `import fs from 'node:fs'`". El archivo no existe después, y el stream trae el motivo de PREGATE en el texto que ve el modelo.
  2. **Edición limpia:** el archivo queda escrito y **su contenido es igual al `after` reconstruido** (comprueba MH-08, MH-11 y MH-13 contra el harness real, incluido el `\n` final del Add de Codex).
  3. **Repo sin preset:** escribe, no hay salida de PREGATE y no hay estado. En agy, además, sin `--dangerously-skip-permissions`, la escritura la decide el sistema de permisos (el neutro no concede nada).
  4. **Motor colgado:** el lock fija `9.9.9-hang`, cuyo "motor" es `sleep 60`. Se espera un deny en menos de 6 s y el archivo sin escribir (MH-19 + MH-15).
- **Modo interactivo:** un escenario 1 por harness en una pty (el usuario trabaja en TUI; solo están probados los modos headless).
- **Además, y cada uno cierra un [E2E] de este documento:**
  - Cursor: el deny en formato Claude, el `followup_message` y `Delete` llegan por el registro importado; Stop interactivo en pty con el tope de `maxStopBlocks`; una escritura de 2 MB llega completa (hash del `content` contra el disco).
  - Grok: los literales `apply_patch|edit|bash` del matcher; `Stop` con exit 0 y `reason:"shutdown"` ignorado.
  - Codex: `hooks/list` = trusted antes y después de un `setup` repetido; reformatear los espacios de `hooks.json` y medir el `trustStatus` (MH-23); si el `cwd` del payload refleja el `workdir` (MH-29); si el JS de code mode puede escribir sin `apply_patch` ni el shell (un prompt que lo intente); si `exec-<uuid>` se repite entre llamadas.
  - agy: `agy plugin uninstall` existe; una escritura de 2 MB por `CodeContent`; un plugin de proyecto llamado `pregate` con `enabled:false` no anula al global.
  - **Un hook ajeno que devuelve `allow`** (y otro que devuelve `ask`) registrado antes del nuestro, en Codex (grupo 0), Grok (`~/.grok/hooks/aa.json` y `config.toml`) y Claude: el deny de PREGATE tiene que ganar. Si en Grok no gana, el registro de Grok pasa a `[[hooks.PreToolUse]]` de `config.toml`, que corre antes [V]. Si en Codex no gana, **la instalación en Codex queda bloqueada** hasta resolverlo.
  - **Orca:** capturar el entorno y los flags reales de cada agente que lanza (`CODEX_HOME`, `GROK_HOME`, `CLAUDE_CONFIG_DIR`, `HOME`, `--ignore-user-config`, `--setting-sources`). Si alguno corre sin la config de usuario, PREGATE no lo cubre: se documenta y se lleva al usuario.
  - La salida del comando registrado bajo el `zsh` real del usuario (sus dotfiles, solo lectura) es limpia.
- Costo estimado: < USD 3 por corrida completa.

**6.4 Aceptación real, 2026-10-02 (W12).** Se construyó 0.2.0 y se ejecutó `PREGATE_REAL=1 bun run scripts/e2e-real.ts`, con reruns por harness y `--core-only`, `--extras-only` o `--pty-only`. Todos los HOME, XDG, TMPDIR, CODEX_HOME y GROK_HOME quedaron bajo `/private/tmp/claude-501/`. Las credenciales se copiaron solo para lectura, sin refresh tokens; Cursor y agy usaron el symlink de Keychains de los relevamientos. No hubo instalación en el HOME real ni push. Claude consumió **exactamente dos prompts**, agrupando los cuatro casos; sus extras no se ejecutaron.

| Harness / versión real | Deny y archivo ausente | Edit permitido = reconstrucción = disco | Sin preset, sin objeción | `9.9.9-hang`, fail-closed | Deny interactivo |
|---|---|---|---|---|---|
| Claude Code 2.1.287 | PASS | PASS | PASS | PASS | Pendiente: límite de dos prompts |
| Codex 0.159.2 | PASS | PASS | PASS | PASS | PASS, `--no-daemon` |
| Cursor 2026.09.26-dd393fe | PASS | PASS | PASS | PASS | PASS |
| Grok 1.0.48 | PASS | PASS | PASS | PASS | PASS |
| agy 1.2.14 | PASS | PASS | PASS | PASS | PASS |

La edición cambia solamente `a + b` por `b + a`; se decodifica el input capturado de cada CLI y se reconstruye contra los bytes originales, incluidos espacios y newline. El deny exige evento Pre, motivo visible y árbol `src/` intacto. El caso hang exige que el launcher haya invocado el motor fijado y que el mensaje de su plazo de **5 s** llegue al modelo: no se confunde con un timeout fail-open del harness.

Defectos encontrados y corregidos:

- **Grok:** el matcher anterior no cubría la tool nativa `write`; además el runner expande referencias `$VAR` antes del shell y el comando con locales no se ejecutaba. Se reprodujo el write sin Pre y se verificó el deny con la invocación literal y el fallback diferido de MH-22. La tabla usa la corrida reparada, no la falla inicial de autenticación.
- **Cursor:** el Stop importado solo no activaba el dispatcher del TUI. Se instala un Stop nativo propio y se evita ejecutar ambos. Cada followup trae otro `generation_id`, por lo que el contador de Stop usa la continuidad de la sesión hasta completar el turno; ahora bloquea dos veces y termina. Hay regresión automatizada del cap y su reset.
- **agy:** el plugin de proyecto `pregate` deshabilitado anulaba al global con igual identidad. Cambiar solo el named hook no bastaba; cambiar carpeta, manifest y named hook a `pregate-global` sí. El caso real vuelve a denegar y uninstall retira el plugin propio. Una colisión deliberada con la nueva identidad sigue sujeta a la precedencia del loader y a doctor; no constituye aislamiento contra configuración humana hostil.
- **Runner:** los locks usan la versión compilada; se refrescan las copias de access tokens antes de cada harness; el contexto exacto evita el fuzzy patch de Codex; `danger-full-access` permite el write en el scratch bajo el sandbox externo (el sandbox anidado `workspace-write` no lo permitió); el TUI de Codex usa `--no-daemon` porque este entorno impide `/bin/ps`; agy usa `--prompt-interactive`. La inspección de procesos indisponible se registra y no impide uninstall.

**Ledger de todos los [E2E] y extras de §6.3.** PASS confirma lo observado; pendiente/no ofrecido conserva la opción conservadora y **no** cierra W12 completo ni autoriza D20.

| Ítem | Resultado real / decisión |
|---|---|
| Cursor `generation_id` cambia por turno (§2) | Observado: cambia también entre followups de Stop; cap corregido y verificado en pty. |
| Add de Codex, incluido newline (MH-08) | Edición Update exacta PASS. Add quedó escrito en el caso sin preset; equivalencia de Add contra reconstrucción con preset pendiente. |
| Cursor `permissionDecisionReason` de ~12 KB (§3) | Pendiente; deny corto llegó completo. No se reutiliza la evidencia anterior de `user_message` como prueba de este campo. |
| Grok `additionalContext` en deny (§3) | Pendiente; sigue emitiéndose únicamente `compact` ≤ 256 caracteres. |
| Matcher `Delete` importado de Cursor (MH-22) | PASS: Pre capturado, `protected-path`, preset conservado. |
| Literales Grok `apply_patch\|edit\|bash` (MH-22) | No ofrecidos por 1.0.48; vistos `write`, `search_replace`, `run_terminal_command`. Los literales se conservan, sin afirmar que fueron ejecutados. |
| Comando en sh/dash/bash/zsh (MH-22) | Suite del launcher PASS, incluyendo launcher ausente/vacío/no ejecutable y neutralidad sin preset; Cursor real usa zsh. |
| Espacios de hooks.json y trust de Codex (MH-23) | PASS: los tres propios y el ajeno permanecen `trusted` después de reformatear y restaurar. |
| Codex `hooks/list` tras setup repetido (MH-24) | PASS: tres propios trusted, ajeno trusted, bytes y mtimes sin cambio. |
| `agy plugin uninstall` (MH-25) | PASS: existe en help; uninstall real retiró `pregate-global` y preservó registros ajenos. |
| Codex shell `apply_patch`/`applypatch` se convierte en tool (MH-29) | Pendiente; se conserva `shell-write` para ambos comandos. |
| Codex `cwd` refleja `exec_command.workdir` (MH-29) | No: `ls` pidió `src/core`, payload Bash mantuvo la raíz. Se conserva la exigencia de destinos absolutos. |
| Codex code mode escribe desde JS | Archivo no creado; el modelo informó V8 sin Node/fs. Observación de esta configuración, no prueba universal de imposibilidad. |
| Codex `exec-<uuid>` compartido entre inputs | 0 repeticiones entre 7 inputs observados; reutilización no ejercida. Se conserva callId + hash de input. |
| Cursor deny Claude importado | PASS, en headless y pty. |
| Cursor `followup_message`, Stop pty y maxStopBlocks | PASS tras registro nativo: reentry `loop_count > 0`, dos bloqueos y salida neutra. |
| Cursor write de 2 MB, hash contra disco | Pendiente: generar 2 MB contradice prompts mínimos; no se declara íntegro por una prueba chica. |
| Grok Stop exit 0 y reentry | PASS: el bloqueo reanuda el agente; `stopHookActive:true` capturado. |
| Grok Stop `reason:shutdown` ignorado | PASS: un shutdown capturado, sin evento de gate adicional. |
| agy neutral sin skip-permissions | PASS: sin preset PREGATE no habla ni crea estado; agy devuelve `headless mode cannot prompt`. |
| agy write de 2 MB por CodeContent | Pendiente por límite de cuota/prompts mínimos. |
| agy proyecto `pregate` con `enabled:false` | PASS después de separar la identidad global; antes era fail-open. |
| Hook ajeno allow antes del deny: Codex / Grok / Claude | Codex PASS; Grok PASS (fuentes toml y aa ejecutadas); Claude pendiente por límite de dos prompts. |
| Hook ajeno ask antes del deny: Codex / Grok / Claude | Codex PASS; Grok PASS (fuentes toml y aa ejecutadas); Claude pendiente por límite de dos prompts. |
| Orca: entorno y flags reales de agentes | No verificable en este sandbox: `posix_spawn /bin/ps` devuelve EPERM. No se afirma cobertura de lanzamientos de Orca. |
| zsh con dotfiles reales | Pendiente por instrucción estricta de HOME temporal; zsh aislado PASS, stdout vacío. No se ejecutaron los dotfiles reales. |
| Ciclo real setup → setup → doctor → uninstall | PASS en reruns: canarios de los cinco dialectos, trust, idempotencia y preservación de hooks ajenos. Doctor avisa que gh no está autenticado en el HOME temporal. |

Evidencia local, sin credenciales: `/private/tmp/claude-501/finish-pregate/{real,codex-retry,codex-pty,grok-final,cursor-agy-final,cursor-agy-core-final,grok-replay-final}.log`. Los payloads y eventos están en los directorios `Evidence` impresos al final; los auth.json copiados y symlinks al keychain se eliminan al terminar. Claude fue probado antes de las correcciones de registro; no se gastaron prompts adicionales: la invocación compartida vigente se verificó con los payloads y la suite del launcher. Después del arreglo de latencia/replay, el core real de Grok vuelve a pasar los cuatro casos y pty (**11/0**); los demás dialectos pasan la suite del launcher, sin nuevos prompts. Ver también [MVP-STATUS §8](MVP-STATUS.md#8-real-cli-acceptance-y-latencia).

---

## 7. Residuos aceptados

Lo que el gate de sesión no ve y queda para Stop (donde existe), pre-commit y CI:
- Escrituras por comandos que el guard deja pasar por diseño (`rsync`, `tar x`, `unzip -o`, `make`, `prettier --write`, `git stash pop`…), procesos en segundo plano que escriben después de Stop (`&`, `nohup`, `WaitMsBeforeAsync` de agy, `backgroundTasks` de Grok) y tools MCP que escriben archivos.
- Sesiones sin un Stop efectivo: Cursor `-p` [V], subagentes de Cursor (`subagentStop` no disparó [V]) y de Grok (su sesión no tiene Stop propio), y el Stop del padre de agy que llega con `fullyIdle:false` [V].
- Fuera de Claude, Stop deja de bloquear después de `maxStopBlocks` sin canal hacia el humano.
- Cursor y Grok dependen de que lean `~/.claude/settings.json` (MH-04); Codex, del trust (detectado por deriva y `doctor`); todos, de que un orquestador no los lance sin la config de usuario (§6.3, Orca).
- Disponibilidad, no fail-open: un `.zshenv` que imprime o un `$SHELL` no POSIX hacen que Cursor reciba JSON inválido y bloquee todo [V]. El canario de `doctor` lo detecta.

---

## 8. Cambios que esto implica en ARCHITECTURE y SPEC (se aplican al construir)

- **A16:** `ProposedChange.from` y `pre-edit.changes[]` (MH-07).
- **A17 y principio 8:** se reemplazan por MH-01.
- **A20:** se reemplaza por MH-33.
- **Principio 1.6:** las variables que se leen pasan a ser `GROK_HOOK_EVENT` (ya no `GROK_*`) y, solo en la cáscara, `GROK_HOME`, `CODEX_HOME` y `CLAUDE_CONFIG_DIR`. `XDG_DATA_HOME` deja de leerse en el motor (MH-18).
- **§4.0:** salida de Pre universal, invariante de stderr, PATH propio, exit 3 y motor ausente (MH-15, MH-19, MH-22).
- **§4.2:** causa `hook-switch` y guard restringido sin raíz (MH-17, MH-29).
- **§4.4:** SessionStart sin preset queda en silencio (MH-17).
- **§4.5:** el pre-commit usa el `pregate` global (MH-28).
- **§5.4:** layout (MH-18) y releases (MH-32).
- **O11:** acotado por MH-13.
- **O25:** `payload-unrecognized` nombra el harness y la tool.
- **SPEC §14.6:** Codex, Cursor y agy pasan de v1/v1.1 a la versión 0.2.0. `hashline_edit` sigue en v2.

---

## 9. Revisión adversarial aplicada

Dos revisiones sobre la versión anterior de este documento: **FO** (caminos de fail-open, F1–F30) y **SI** (simplicidad, A1–A9, B1–B6, C1–C4). Lo que dicen "D" de SI (lo que está bien) no cambia nada.

| Hallazgo | Resolución | Dónde |
|---|---|---|
| FO-F1, SI-B1: MH-17 dejaba apagar PREGATE desde una sesión sin raíz | **Aplicado.** Rutas de máquina y `hook-switch` siempre; "alcanza raíz" sobre todas las rutas del comando. Se recortó lo que FO pedía de más: `~/.gemini/config/**` entero (bloquearía skills y MCP del usuario) y `skills.json` (no apaga hooks) | MH-17, U-5 |
| FO-F2: MH-04 neutralizaba lo importado porque existía un archivo | **Disuelto** por SI-A1: ya no hay registro nativo en Cursor ni Grok, así que no hay nada que neutralizar | MH-04 |
| SI-A1: registro doble + MH-04 | **Aplicado** (la opción mínima): un registro compartido para Claude, Cursor y Grok. Cursor usa el formato de Claude, verificado en el camino importado | MH-04, MH-14, MH-22, U-6 |
| FO-F3: matchers de lista cerrada | **Parcial.** Se descartan el matcher `*` con allowlist en el launcher (un spawn por cada lectura de la máquina) y la heurística de MCP. Quedan la comparación con `VERIFIED` en `doctor` y el inventario de tools en el E2E; MCP es un residuo declarado | MH-22, §7 |
| FO-F4: trust de Codex roto por terceros | **Aplicado:** transacción con foto y restauración; empalme de texto si el E2E lo exige; deriva en pre-commit y `doctor` (junto con SI-C1). Descartado: `stat` en cada SessionStart (el pre-commit es el canal que existe en los cinco) | MH-24, MH-27 |
| FO-F5: launcher o motor vacío | **Parcial:** `[ -s ]` en el guard inline y en el launcher, escrituras tmp + fsync + rename. Descartados el handshake de ack y el `trap EXIT` de deny: con rename después de verificar y del warm-up, un motor parcial no puede quedar instalado | MH-15, MH-22 |
| FO-F6, SI-B5: agy con el launcher ausente salía neutro | **Aplicado**, con una sola búsqueda de preset (SI-A6) | MH-22 |
| FO-F7: rutas relativas en Codex | **Aplicado:** patch solo con rutas absolutas; en `Bash`, destino relativo ⇒ deny hasta que el E2E diga lo contrario | MH-08, MH-29 |
| FO-F8: sin Stop efectivo | **Descartado** (SubagentStop, Stop pegajoso, TDD-DEL en Pre): son mecanismos nuevos para una red secundaria. Queda como residuo declarado. La raíz ya se registra en la primera llamada | §7 |
| FO-F9: shell interactivo con stdin sin hook | **Aplicado** | MH-29 |
| FO-F10: payload truncado de Grok en cualquier tool | **Aplicado.** Descartado el deep-equal entre `toolInput` y `tool_input`: son alias del mismo serializador [V] | MH-12 |
| FO-F11: timeouts que fallan abierto y PATH | **Aplicado:** Pre 30 s en los tres registros; PATH propio del launcher | MH-15, MH-22 |
| FO-F12, FO-F13: exit 2 sin stderr | **Aplicado** en el launcher. Descartado el sniff del JSON de agy en `sh`: lo garantizan los tests de encode | MH-15 |
| FO-F14: config reubicada o en symlink | **Aplicado sin `install.json`:** realpath de cada archivo de registro, calculado en el hook; el motor deriva sus rutas de `execPath`. Descartado `PREGATE_STATE` (un estado en otra ruta no abre el gate) | MH-17, MH-18 |
| FO-F15: config de proyecto que apaga hooks | **Aplicado** como aviso de deriva en pre-commit y `doctor` | MH-27 |
| FO-F16: orquestador que reubica la config | **Aplicado:** palabras nuevas en el guard; captura de Orca en el E2E | MH-29, §6.3 |
| FO-F17: allow ajeno frente a nuestro deny | **Aplicado** como E2E que bloquea la instalación en Codex | §6.3 |
| FO-F18, SI-A2 (`SINCE`) | **Aplicado unificado:** un solo `FLOOR` reemplaza a `SINCE` (por harness era especulativo) | MH-20 |
| FO-F19: A20 sin SessionStart | **Aplicado,** sin estado nuevo: se usa el `at` de la primera snapshot | MH-33 |
| FO-F20: raíces anidadas con el motor ausente | **Descartado:** registro de raíces conocidas para un estado de instalación rota; con SI-A6, el motor ausente deniega siempre | MH-15 |
| FO-F21: cwd ambiguo en Cursor y agy | **Aplicado** como `BAD`. Descartado evaluar contra cada raíz: más código para un caso raro | MH-06 |
| FO-F22: reingreso de Cursor escrito como neutro | **Aplicado** (error del documento) | MH-14 |
| FO-F23: compañeros sin la instalación global | **A decisión del usuario** | U-1 |
| FO-F24: procesos en segundo plano | **Descartado:** residuo de la clase de shell que ya cubren pre-commit y CI | §7 |
| FO-F25: regex `HARNESS` | **Aplicado** | MH-29 |
| FO-F26, FO-F27, FO-F30: code mode, contenido truncado, `callId` compartido | **E2E**; el `callId` con hash se aplica ya porque cuesta una línea | MH-05, §6.3 |
| FO-F28: orden del update y test de esquema | **Parcial:** el orden motor → warm-up → launcher se aplica. El test que fija el hash del esquema se descarta por frágil: lo reemplaza la regla de MH-21 en el checklist de release | MH-21, MH-27 |
| FO-F29: trust y `mine()` por subcadena | **Aplicado:** igualdad exacta | MH-22, MH-24 |
| SI-A2: `v1/`, raíces vistas, `--prune`, avisos por lock | **Aplicado:** todo eliminado. El deny "engine v is not installed" se resuelve solo | MH-18, MH-21, MH-27 |
| SI-A3: `current`, `install.json`, `install.lock`, `agy-plugin/` | **Aplicado.** Lo único que se guarda es `codex-trust.json`, que SI-C1 justifica | MH-18 |
| SI-A4: flags de CLI | **Aplicado:** quedan `setup`, `update [--version \| --engine]`, `uninstall [--purge]` y `doctor` | MH-27 |
| SI-A5: `install.sh` | **Aplicado:** un modo, release o `PREGATE_ARCHIVE`, un solo warm-up, solo `gh`, solo `SHA256SUMS` | MH-31, MH-32 |
| SI-A6: dialectos en el launcher | **Aplicado:** Pre universal sin JSON; Stop solo bloquea en Claude; una sola búsqueda de preset. El sniff de Cursor pasa a `CURSOR_VERSION` | MH-15 |
| SI-A7: re-trust ajeno en el uninstall | **Aplicado:** se listan las keys y el usuario las aprueba | MH-24 |
| SI-A8: `fallback` como parte de `decode` | **Aplicado** (`Rejected`), y además lleva `dirs` para no romper la máquina | MH-01, MH-06 |
| SI-A9, SI-B3, SI-B4: launcher commiteado y migración de repos | **Aplicado:** sin launcher commiteado; pre-commit y CI siguen al lock; la CLI redirige por lock | MH-19, MH-28, U-7 |
| SI-B2: `doctor` sin `test/payloads` | **Aplicado:** `VERIFIED` embebida por adaptador | MH-01, MH-27 |
| SI-B6: plugin de agy habilitado; Cursor como `agent` | **Aplicado** | MH-25, MH-26 |
| SI-C1: deriva en runtime | **Aplicado** en pre-commit y `doctor` | MH-27 |
| SI-C2: aviso de update | **A decisión del usuario** | U-4 |
| SI-C3: onboarding en el flujo global | **Aplicado** | MH-34 |
| SI-C4: huecos del E2E | **Aplicado** (pty, code mode, zsh real); `write_stdin` lo cierra MH-29 | §6.3 |

---

## 10. Plan de construcción

Cada unidad es dueña de sus archivos y de sus tests, y no edita los de otra. Las interfaces de §10.1 se fijan en W0 y no cambian sin pasar por el orquestador. Cada unidad cierra con una revisión adversarial de simplicidad (D16), como en ARCHITECTURE §9.

### 10.1 MH-W0: contratos (primero y en serie, ~1 día)

Entrega: los tipos, `src/harness/wire.ts`, el movimiento de `src/claude.ts` a `src/harness/claude.ts` (sin cambio de conducta), las constantes de §10.1, el arnés del test de contrato por payload (falla si un archivo no tiene expectativa) y los stubs que cada unidad reemplaza. Fija estas firmas:

```ts
// types.ts
type HarnessId = "claude-code" | "codex" | "cursor" | "grok" | "agy";
type HookKind = "pre" | "stop" | "session-start";
type Edit = …                                                    // MH-07
interface ProposedChange { session: Session; callId: string; tool: string; path: string; edit: Edit; from: string | null }
type HookEvent = { kind: "session-start"; … } | { kind: "pre-edit"; changes: ProposedChange[] }
               | { kind: "pre-command"; command: ProposedCommand } | { kind: "stop"; … }
interface Rejected { cause: Cause; kind: HookEvent["kind"]; reentry: boolean; session: Session | null; dirs: string[] }
type Cause = … | "hook-switch";                                  // FIXABLE_BY: "agent"
interface HookEnv { grokEvent: string | null; projectDir: string | null; remote: boolean }

// harness/<h>.ts (codex, cursor, grok, agy; claude adaptado)
export const VERIFIED: string;
export function decode(event: HookKind, raw: string, env: HookEnv): HookEvent | Rejected | null;
export function encode(kind: HookEvent["kind"], d: Decision, stop: StopState | null): Emission;

// main.ts
export const FLOOR = "0.2.0";
export function profile(flag: HarnessId, raw: string, env: HookEnv): HarnessId;   // MH-03, puro

// reconstruct.ts
export function apply(current: string | null, edit: Edit): { after: string | null; status: Reconstruction };

// decide.ts
export function merge(ds: Decision[]): Decision;

// paths.ts
export function machineGlobs(home: string, env: { codexHome: string; grokHome: string; claudeConfig: string | null; data: string; state: string }, real: (p: string) => string): string[];

// shell.ts
export function guard(command: string, cwd: string, ctx: GuardContext & { machineOnly: boolean; harness: HarnessId }): Cause | null;
//   ctx.touched(): boolean — si alguna ruta extraída alcanzó una raíz (MH-17)

// gate.ts
export function onPreEdit(changes: ProposedChange[]): Promise<Decision>;
export function rejected(r: Rejected): Decision;                 // MH-06: neutro sin raíz

// register.ts
type Sub = HookKind;
type Target = "shared" | "codex" | "agy";
export function hookCommand(data: string, sub: Sub, h: HarnessId, agy: boolean): string;           // MH-22, texto congelado
export function merge(text: string | null, t: Target, data: string): string | null;                // null: no es un objeto JSON
export function unmerge(text: string, t: Target, data: string): { text: string; shifted: string[] } | null;
export function exact(group: unknown, t: Target, data: string): boolean;                           // MH-22, MH-24
export function agyPlugin(data: string): Record<string, string>;                                    // ruta relativa → bytes
export function drift(m: MachineFiles, repo: RepoFiles | null, data: string, trust: Record<string, string>): string[];

// machine.ts
export function setup(): Promise<{ code: 0 | 1; text: string }>;
export function update(o: { version?: string; engine?: string }): Promise<{ code: 0 | 1; text: string }>;
export function uninstall(purge: boolean): Promise<{ code: 0 | 1; text: string }>;
export function doctor(): Promise<{ code: 0 | 1; text: string }>;
```

Protocolo del launcher (0.2.0, aún sin publicar): exit 0 y 2 = salida del motor; exit 3 con primera línea stdout `^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$` = "corré ese motor". Pre devuelve también el stdin original después de esa línea (MH-19); el replay vacío se rechaza. Cualquier otro código = fail-closed. El texto de `<CMD ev h>` de MH-22 queda escrito en W0 como fixture literal.

**Δ de W0 (construido; esto manda sobre las firmas de arriba).**
- `HARNESSES` y `profile` viven en `src/harness/profile.ts`, no en `main.ts`: `main.ts` corre al importarse, así que ni un test ni `doctor` podrían importarlo, y `machine.ts → main.ts → cli.ts → machine.ts` sería un ciclo.
- `FLOOR` vive en `gate.ts`, junto a `VERSIONS`, con las constantes del protocolo: `REDIRECT = 3` y `ENGINE_VERSION` (la regex de arriba).
- Se agrega `gate.pinned(dir: string): string | null`: el motor que fija el lock de la raíz en o sobre `dir` si no es este y no está bajo `FLOOR`. Es la costura `main ↔ gate` del exit 3 (MH-19), que §10.1 no fijaba. El stub devuelve `null`: decide este motor, como hoy.
- `encode(kind, d)` sin `stop: StopState | null`: `StopState` no estaba definido y ninguna fila de MH-14 lo necesita. El reingreso entra a `decide` por `stop.reentry`, y el de un payload rechazado viaja en `Rejected.reentry`.
- `Session.harness: HarnessId`: `gate` necesita el harness para el contexto del guard (MH-29) y para indexar el estado por `<id>:<Session.id>` (MH-05), y ni `ProposedCommand` ni `onPreCommand` lo traían. `Session.id` sigue siendo el id nativo; W6 arma la clave (ojo: `state.sessionDir` rechaza `:`).
- `hookCommand(data, sub, h)` sin `agy: boolean`, que repetía `h === "agy"`.
- Texto de MH-22 (fixture literal en `test/fixtures/hook-command.txt`): el ciclo es `while [ "${d#/}" != "$d" ]; do …; d=${d%/*}; done` en lugar de `while [ -n "$d" ] && [ "$d" != / ]; do …; d=$(dirname "$d"); done`. Sin fork ni dependencia del PATH, y termina con cualquier valor: `dirname` de una ruta relativa llega a `.` y repite hasta el timeout del harness, que falla abierto en Codex, Grok y Claude. La variante de agy queda escrita completa (un solo candidato, `workspacePaths[0]`). Verificado a mano en sh, dash, bash y zsh; la matriz es de W8.
- `claude.ts` exporta además `eventOf(raw): HookKind | null` para `hook auto`, porque `decode` exige el evento.
- `GuardContext` (exportado por `shell.ts`) incluye `touched(): boolean`: lo implementa `gate` y el guard puede consultarlo. `MachineFiles` y `RepoFiles` (`register.ts`) quedan definidos.
- `hook-switch` entra en `GUARDS` de `decide.ts`: shadow nunca lo silencia.
- El adaptador de Claude ya no rechaza por `GROK_*` en el entorno (MH-03) y decodifica `old_string` vacío como `oldnew` con `old: ""` (MH-13); el stub de `apply` lo sigue dando `unknown`, así que la decisión no cambia hasta W5.
- Arnés de contrato: `contract(h, dir, expectations)` en `test/harness/contract.ts`. Además de exigir una expectativa por archivo, comprueba que `profile` elige `h` para cada payload que llega a `decode`. Una captura que ningún registro nuestro entrega se clasifica como `{ unregistered: "<por qué>" }`.

### 10.2 Unidades (en paralelo, cada una en su worktree)

| Unidad | Archivos (exclusivos) | Depende de | Aceptación | Tamaño |
|---|---|---|---|---|
| **MH-W1 Codex** | `src/harness/codex.ts`, `test/harness/codex.test.ts`, expectativas de `test/payloads/codex/` | W0 | Contrato por payload en verde; gramática y aplicación del patch (§6.1); rutas relativas ⇒ `unknown`; `callId` con hash; encode con stdout vacío en exit 2 y Stop con dos claves | L |
| **MH-W2 Cursor** | `src/harness/cursor.ts`, su test y expectativas | W0 | Contrato por payload; Shell con `cwd:""` y una o dos raíces; deny en formato Claude a exit 0; Stop con `followup_message` y reingreso por `loop_count` | S |
| **MH-W3 Grok** | `src/harness/grok.ts`, su test y expectativas | W0 | Contrato por payload; `toolInputTruncated` en toda tool; shutdown ⇒ `null`; razón ≤ 256 sin `\n` | S |
| **MH-W4 agy** | `src/harness/agy.ts`, su test y expectativas | W0 | Contrato por payload; append, rango, claves cerradas; `send_command_input` ⇒ `shell-write`; `Cwd` ausente con `workspacePaths` vacío ⇒ `BAD` | M |
| **MH-W5 Reconstrucción** | `src/reconstruct.ts` y su test | W0 | `append`, `oldnew` con rango, `hunks` exactos con `anchor` y `eof`, `delete`, old vacío que crea (MH-13) | M |
| **MH-W6 Núcleo** | `src/gate.ts`, `src/decide.ts`, `src/state.ts` y sus tests | W0; W5 por interfaz | Superposición y `merge` (MH-09); MH-17 sin estado; `rejected`; MH-33 por ctime; `FLOOR`; exit 3 y redirección de la CLI (MH-19); `engineHome` desde `execPath` | L |
| **MH-W7 Borde** | `src/shell.ts`, `src/paths.ts`, `src/message.ts` y sus tests | W0 | `machineGlobs` con realpath; `hook-switch` siempre y el resto con raíz; palabras de MH-29; shell interactivo; destino relativo en Codex; textos de las causas nuevas | M |
| **MH-W8 Launcher** | `assets/launcher.sh`, `test/launcher.e2e.test.ts` | W0 (protocolo y texto de MH-22) | Matriz de §6.2 en dash, bash 3.2 y `zsh -c` con el comando literal; invariante de stderr; PATH propio | M |
| **MH-W9 Registro** | `src/register.ts`, `test/register.test.ts`, fixtures de configs reales (Orca, ArkGate, cmux) | W0 | §6.1 `register` completo, incluido `drift` | M |
| **MH-W10 Máquina** | `src/machine.ts`, `src/install.ts` (recortado a MH-28), `assets/pre-commit.sh`, `assets/ci-github.yml`, `test/machine.e2e.test.ts` con un app-server falso | W0; W9 por interfaz | `HOME=<tmp> setup` idempotente; transacción de trust con restauración; `uninstall` que restaura; `doctor` con canario por `$SHELL -c`; orden del update | L |
| **MH-W11 Distribución** | `install.sh`, `scripts/build.ts` (tars + `SHA256SUMS`), `.github/workflows/release.yml` | W0 | Release de prueba en un tag `-rc`; bootstrap verificado de MH-32 en una máquina limpia; `PREGATE_ARCHIVE` + `PREGATE_SHA256` | S |
| **MH-W12 E2E real** | `scripts/e2e-real.ts` | W0 (lo escribe contra la CLI de MH-27; corre después de la integración) | Los escenarios de §6.3 escritos y ejecutables con `PREGATE_REAL=1` | M |

### 10.3 Integración (MH-WI, en serie, la hace el orquestador)

1. **W0**, en serie.
2. En paralelo: **W1–W5, W7, W8, W9, W11, W12**.
3. **W6** en cuanto W5 está integrado (consume `apply`); **W10** en cuanto W9 está integrado.
4. **MH-WI:** `src/main.ts` (mapa `HARNESSES`, `profile`, `Rejected`, `FLOOR`) y `src/cli.ts` (`setup`, `update`, `uninstall`, `doctor`). Después, §6.1 y §6.2 completos en CI, bench (p50 sin raíz ≤ 25 ms; p95 de Pre ≤ 150 ms) y dogfooding.
5. **W12 corre** §6.3 con los cinco CLIs reales. Cada [E2E] se cierra y se anota en este documento. Un [E2E] que contradice el diseño vuelve a la unidad dueña.
6. Recién entonces, y con las decisiones de §11 tomadas, la instalación en la máquina del usuario (D20), seguida de `pregate doctor` en verde.

---

## 11. Decisiones que requieren al usuario

| # | Pregunta | Recomendación |
|---|---|---|
| U-1 | **Migración del piloto.** Hay que sacar los hooks por repo de su `.claude/settings.json` y el launcher commiteado (MH-28), y recompilar su lock con 0.2.0 (MH-20). Los compañeros sin la instalación global pierden el gate de sesión y su pre-commit les pide instalar PREGATE. La alternativa (FO-F23) es mantener el hook por repo como respaldo, con la deduplicación por `callId` que MH-04 ya no necesita | Sí, en una sola PR del piloto, junto con la instrucción de instalación. Un solo camino para los hooks |
| U-2 | **Acceso del equipo a los releases.** Están en el repo privado `pedroknigge/pregate` y la descarga necesita `gh auth` con permiso de lectura | Dar lectura en el privado. Un repo público solo de binarios va contra D18 hasta el "público clean" |
| U-3 | **Trust de Codex.** `setup` lo otorga por app-server **solo a las keys de PREGATE cuya definición es exactamente la que escribió**, que es lo mismo que aprobarlas en `/hooks`. Entiendo que el "ok si" de D20 lo cubre. Si un hook ajeno pierde el trust, setup restaura y falla: nunca toca trust ajeno | Confirmar. Si no, `setup` lo deja pendiente y `doctor` falla hasta que se apruebe a mano |
| U-4 | **Aviso de versión nueva.** (a) Solo `doctor`; (b) una línea en el pre-commit, como máximo una vez por día, a partir de un chequeo con `gh` en segundo plano y cacheado; (c) auto-update opt-in | (b): sin aviso, nadie se entera de que hay versión nueva, y el pre-commit es el único canal que existe en los cinco harnesses. Nunca auto-update |
| U-5 | **Protecciones de máquina siempre activas (MH-17).** Ningún agente, en ningún repo, puede editar `~/.claude/settings*.json`, `~/.codex/{hooks.json,config.toml}`, `~/.grok/{config.toml,hooks/**}`, `~/.gemini/config/{hooks.json,config.json}` ni la instalación de PREGATE, ni correr `pregate uninstall` o `agy plugin disable pregate`. Eso incluye pedirle a Claude que agregue un permiso a `~/.claude/settings.json` (por ejemplo, con `/update-config`): lo hace el humano | Sí. Sin esto, cualquier sesión abierta fuera de un repo con preset puede apagar PREGATE en toda la máquina, y en Codex en silencio |
| U-6 | **Registro único para Claude, Cursor y Grok (MH-04).** Se pierde `failClosed` de Cursor para fallas en las que el `sh` inline ni siquiera arranca, y Grok queda sujeto a su interruptor de compatibilidad con Claude (que el agente no puede tocar y que el pre-commit detecta). Se gana no escribir en `~/.cursor/hooks.json` (de Orca, que un error de esquema invalida entero) y no tener doble evaluación | Sí |
| U-7 | **Sin launcher commiteado (MH-28).** El pre-commit usa el `pregate` global y la CI baja el motor que pide el lock. Cada máquina que commitea en un repo con PREGATE necesita la instalación global | Sí: elimina el desfasaje de versiones al migrar un repo |

D15.9 ("¿alguien usa Grok?") queda resuelta por D20.
