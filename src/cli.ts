#!/usr/bin/env node
// CLI de captura-cli. Pensado para agentes: salida en texto corto, códigos de salida estables, nunca espera stdin
// salvo `init` en una terminal interactiva.
import { cargarUno } from './adaptadores/cargar.js'
import { TIPOS, type TipoAdaptador, esFaltaConfiguracion } from './adaptadores/contrato.js'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep, basename } from 'node:path'
import { PLANTILLAS } from './plantillas.js'
import type { OpcionesRun } from './ejecutar.js'
import { type Escenario, recetasDe, validarEscenario } from './escenario.js'
import { recetasFaltantes } from './recetas.js'
import { dirWorkspace, guardarConfigUsuario, home, leerConfigUsuario, leerRegistro, raizWorkspace } from './almacen.js'
import { ctx, hayContexto, preparar } from './contexto.js'
import { CODIGOS, salir } from './salida.js'
import { sinConversionMsys } from './msys.js'
import { iniciarLibro } from './uso.js'
import { VERSION } from './version.js'
import { configurarInteractivo, hayTeclado, mensajeWorkspaceNuevo, origenSalidas, registrar } from './workspace.js'

const AYUDA = `captura-cli ${VERSION}: evidencia de lo que hizo un agente en el navegador

Uso:
  captura-cli init [--yes] [--salidas global|<ruta>] [--proyecto <ruta>] [--estadisticas si|no]
  captura-cli config                       muestra el registro, las rutas y la config efectiva del workspace
  captura-cli config <clave> <valor>       cambia salidas (global|ruta), proyecto, estadisticas (si|no)
                                           o salidas-base (ruta por defecto para workspaces nuevos)
  captura-cli script [--slot N] [--limpiar] <archivo.mjs> [args…]
                                           corre un script que usa la API (import … from 'captura-cli'),
                                           también con la herramienta instalada en global
  captura-cli validar <escenario>          revisa el escenario sin abrir el navegador (sale con 2 si no es válido)
  captura-cli run <escenario> [opciones]   valida y ejecuta el escenario; informe.md, casos.json y capturas
  captura-cli explorar <ruta> [--id <id>] [--rol <rol>] [--app <app>] [--errores]
                                           lista lo interactivo de una pantalla con selectores sugeridos;
                                           --errores agrega campos inválidos y mensajes de error visibles
  captura-cli recetas [app]                catálogo de recetas con versión y estado
  captura-cli adaptadores verificar        comprueba cada adaptador contra el contrato
  captura-cli adaptador nuevo <tipo> [--en <ruta.mjs>]
                                           plantilla de un adaptador propio (credenciales, identificador,
                                           entorno, publicacion, correo) en <proyecto>/adaptadores/
  captura-cli entorno levantar <app> [args…] | estado | parar [app]
                                           servicios del slot propio, mediante el adaptador de entorno;
                                           estado además comprueba que cada app responda
  captura-cli stats [--todos] [--desde 7d] [--id <id>] [--json]
                                           uso por comando (tokens estimados, tiempo, códigos), recetas,
                                           casos y espacio ocupado; --todos suma todos los workspaces;
                                           --id acota a una tarea (p. ej. --id SUT-647)
  captura-cli stats --transcrito <sesión.jsonl>
                                           tokens reales de una sesión de Claude Code y cuánto vino de captura-cli
  captura-cli limpiar [--antes 30d] [--aplicar]
                                           residuos del almacén (temporales, caché de más de 14 días, sesiones
                                           vencidas; capturas solo con --antes). Sin --aplicar solo lista
  captura-cli doctor [--instalar]          qué falta (Node, Playwright, navegadores, workspace, config,
                                           adaptadores) y cómo arreglarlo; --instalar baja Chromium
  captura-cli hook cierre | inicio         los usa el plugin de Claude Code (leen el JSON del hook por stdin)
  captura-cli --version | --help

  <escenario> es una ruta a un .json o un nombre de la carpeta de escenarios del proyecto.

Opciones de run y explorar:
  --id <id>             carpeta de salida (manda sobre "id" del escenario)
  --app <app>           app del config (por defecto la única declarada)
  --rol <rol>           rol con el que entrar (manda sobre "rol" del escenario; no hace falta en una app sin login)
  --browser <b>         chromium | firefox | webkit (por defecto chromium)
  --canal <c>           msedge | chrome: el navegador instalado (= CAPTURA_CANAL)
  --headless | --no-headless
  --viewport <AxB>      tamaño de la captura, p. ej. 1366x900
  --sesion-min <n>      minutos que vale la sesión guardada
  --sin-sesion          forzar login
  --timeout <s>         tope de la corrida en segundos (por defecto 300)
  --slot <n|auto>       slot de la corrida (= CAPTURA_SLOT)
  --out <ruta>          carpeta de salidas (= CAPTURA_OUT)
  --config <ruta>       captura.config.json (= CAPTURA_CONFIG)
  --limpiar             vacía la carpeta del id antes de la corrida (capturas, publicar/ e informe)

La API de código: import { sesion, foto, marcar, caso } from 'captura-cli'

Códigos de salida: 0 ok · 1 error · 2 escenario inválido · 3 FALTAN_CREDENCIALES · 4 TIMEOUT_GLOBAL
  · 5 recetas sin declarar · 6 WORKSPACE_NUEVO · 7 PAGINA_COLGADA`

interface Args { pos: string[]; op: Record<string, string | true> }
const CON_VALOR = ['antes', 'transcrito', 'desde', 'en', 'salidas', 'proyecto', 'estadisticas', 'id', 'app', 'rol', 'browser', 'canal', 'viewport', 'sesion-min', 'timeout', 'slot', 'out', 'config']
function parsear(argv: string[]): Args {
  const pos: string[] = [], op: Record<string, string | true> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (!a.startsWith('--')) { pos.push(a); continue }
    const [k, v] = a.slice(2).split(/=(.*)/s)
    if (v !== undefined) op[k!] = v
    else if (argv[i + 1] !== undefined && !argv[i + 1]!.startsWith('--') && CON_VALOR.includes(k!)) op[k!] = argv[++i]!
    else op[k!] = true
  }
  return { pos, op }
}

const texto = (x: string | true | undefined): string | undefined => (typeof x === 'string' ? x : undefined)

async function init(op: Args['op']): Promise<number> {
  const raiz = raizWorkspace()
  const salidas = texto(op['salidas']), proyecto = texto(op['proyecto']), est = texto(op['estadisticas'])
  if (!op['yes']) {
    if (!hayTeclado()) {
      console.log(mensajeWorkspaceNuevo(raiz))
      return CODIGOS.WORKSPACE_NUEVO
    }
    // Ya lo pidió con `init`: no hace falta preguntar si quiere configurarlo.
    return (await configurarInteractivo(raiz, { confirmar: false })) ? CODIGOS.OK : CODIGOS.WORKSPACE_NUEVO
  }
  if (est !== undefined && !['si', 'no'].includes(est)) return salir(`init: --estadisticas debe ser si o no (recibido "${est}")`, CODIGOS.ERROR)
  const { avisos } = registrar(raiz, { salidas: salidas ?? 'global', ...(proyecto ? { proyecto } : {}), estadisticas: est !== 'no' })
  for (const a of avisos) console.log(a)
  return CODIGOS.OK
}

// Cambia lo respondido al registrar el workspace (salidas, proyecto, estadisticas) o la ruta base global de salidas.
// No necesita una config válida: sirve justamente para arreglar dónde está.
function cambiarConfig(clave: string, valor: string | undefined): number {
  if (clave === 'salidas-base') {
    if (!valor) return salir('config salidas-base: falta la ruta (o "ninguna" para volver al almacén)', CODIGOS.ERROR)
    const u = leerConfigUsuario()
    if (valor === 'ninguna') delete u.salidasBase; else u.salidasBase = resolve(valor)
    u.salidasBasePreguntada = true // ya está decidido: la primera configuración no lo vuelve a preguntar
    guardarConfigUsuario(u)
    console.log(`salidas-base: ${u.salidasBase ?? '(ninguna: el almacén)'} (se propone en cada workspace nuevo; los registrados no cambian)`)
    return 0
  }
  const raiz = raizWorkspace()
  const r = leerRegistro(raiz)
  if (!r) return salir(mensajeWorkspaceNuevo(raiz), CODIGOS.WORKSPACE_NUEVO)
  if (!['salidas', 'proyecto', 'estadisticas'].includes(clave)) {
    return salir(`config: clave desconocida "${clave}" (salidas, proyecto, estadisticas, salidas-base)`, CODIGOS.ERROR)
  }
  if (!valor) return salir(`config ${clave}: falta el valor`, CODIGOS.ERROR)
  if (clave === 'estadisticas' && !['si', 'no'].includes(valor)) return salir(`config estadisticas: si o no (recibido "${valor}")`, CODIGOS.ERROR)
  const { avisos } = registrar(raiz, {
    salidas: clave === 'salidas' ? valor : r.salidas,
    ...(clave !== 'salidas' && r.salidasPorDefecto ? { salidasPorDefecto: true } : {}),
    proyecto: clave === 'proyecto' ? valor : r.proyecto,
    estadisticas: clave === 'estadisticas' ? valor === 'si' : r.estadisticas,
  })
  for (const a of avisos) console.log(a)
  const n = leerRegistro(raiz)!
  console.log(`${clave}: ${clave === 'estadisticas' ? (n.estadisticas ? 'si' : 'no') : n[clave as 'salidas' | 'proyecto']}`)
  return 0
}

// ---------- escenarios: validar, run, explorar ----------

function opcionesNavegador(op: Args['op']): OpcionesRun {
  const o: OpcionesRun = {}
  const b = texto(op['browser'])
  if (b !== undefined) {
    if (b !== 'chromium' && b !== 'firefox' && b !== 'webkit') return salir(`--browser: chromium, firefox o webkit (recibido "${b}")`, CODIGOS.ERROR)
    o.browser = b
  }
  if (op['headless']) o.headless = true
  if (op['no-headless']) o.headless = false
  const vp = texto(op['viewport'])
  if (vp !== undefined) {
    const m = vp.match(/^(\d+)x(\d+)$/)
    if (!m) return salir(`--viewport: ANCHOxALTO, p. ej. 1366x900 (recibido "${vp}")`, CODIGOS.ERROR)
    o.viewport = { width: Number(m[1]), height: Number(m[2]) }
  }
  const t = texto(op['timeout'])
  if (t !== undefined) {
    if (!/^\d+$/.test(t) || Number(t) <= 0) return salir(`--timeout: segundos (recibido "${t}")`, CODIGOS.ERROR)
    o.maxMs = Number(t) * 1000
  }
  if (op['sin-sesion']) o.reutilizar = false
  return o
}

/** Ruta del escenario: un archivo que existe, o un nombre de la carpeta de escenarios del proyecto. */
function rutaEscenario(ref: string): string | null {
  if (existsSync(ref)) return resolve(ref)
  if (!hayContexto()) return null
  for (const n of [ref, `${ref}.json`]) { const f = join(ctx().rutas.escenarios, n); if (existsSync(f)) return f }
  return null
}

/** Lee, aplica --id/--rol/--app y valida (estructura, y con contexto: app, id y recetas). Sale con 2 si no sirve. */
async function cargarEscenario(ref: string | undefined, op: Args['op']): Promise<Escenario> {
  if (!ref) return salir('ESCENARIO_INVALIDO: falta el escenario (ruta a un .json o nombre en la carpeta de escenarios)', CODIGOS.ESCENARIO_INVALIDO)
  const f = rutaEscenario(ref)
  if (!f) return salir(`ESCENARIO_INVALIDO: no existe "${ref}"${hayContexto() ? ` (ni en ${ctx().rutas.escenarios})` : ''}`, CODIGOS.ESCENARIO_INVALIDO)
  let crudo: unknown
  try { crudo = JSON.parse(readFileSync(f, 'utf8').replace(/^﻿/, '')) } catch (e) {
    return salir(`ESCENARIO_INVALIDO: ${f}: no es JSON válido (${(e as Error).message})`, CODIGOS.ESCENARIO_INVALIDO)
  }
  if (typeof crudo === 'object' && crudo !== null && !Array.isArray(crudo)) {
    const o = crudo as Record<string, unknown>
    for (const k of ['id', 'rol', 'app']) { const v = texto(op[k]); if (v !== undefined) o[k] = v }
  }
  const r = validarEscenario(crudo)
  const errores = r.ok ? [] : [...r.errores]
  if (r.ok && hayContexto()) {
    const c = ctx()
    const esc = r.escenario
    const apps = Object.keys(c.cfg.apps)
    if (esc.app && !c.cfg.apps[esc.app]) errores.push(`app: "${esc.app}" no está en captura.config.json (${apps.join(', ') || 'ninguna declarada'})`)
    if (!esc.app && apps.length !== 1) errores.push(`app: falta (hay ${apps.length ? `varias: ${apps.join(', ')}` : 'ninguna declarada'}); declarar "app" o pasar --app`)
    const prob = c.adaptadores.identificador.validar(esc.id)
    if (prob) errores.push(`id: ${prob}`)
    const app = esc.app ?? apps[0]
    if (app && c.cfg.apps[app]?.login && !esc.rol) errores.push(`rol: falta (la app ${app} tiene login): declarar "rol" o pasar --rol`)
    if (app) {
      const faltan = await recetasFaltantes(app, recetasDe(esc))
      if (faltan.length) errores.push(`recetas usadas que no existen para ${app}: ${faltan.join(', ')} (catálogo: captura-cli recetas ${app})`)
    }
  }
  if (errores.length) return salir([`ESCENARIO_INVALIDO: ${f}`, ...errores.map((x) => `  - ${x}`)].join('\n'), CODIGOS.ESCENARIO_INVALIDO)
  return (r as { escenario: Escenario }).escenario
}

async function validar(ref: string | undefined, op: Args['op']): Promise<number> {
  const esc = await cargarEscenario(ref, op)
  const pasos = esc.casos.reduce((n, c) => n + c.pasos.length, 0)
  console.log(`escenario válido: ${esc.casos.length} caso(s), ${pasos} paso(s)${hayContexto() ? '' : ' (sin workspace registrado: no se comprobaron app, id ni recetas)'}`)
  return CODIGOS.OK
}

/**
 * `explorar <ruta> [--id <id>]`: el id va con --id, con CAPTURA_ID o como argumento suelto; se reconoce por el
 * patrón del config, así que la ruta y el id pueden ir en cualquier orden. Sin id se usa "explorar" si el patrón
 * lo admite; si no, el error dice cómo pasarlo.
 */
async function explorarCli(pos: string[], op: Args['op']): Promise<number> {
  const c = ctx()
  const patron = new RegExp(c.cfg.id.patron)
  let id = texto(op['id']) ?? process.env['CAPTURA_ID']
  let rutaCruda: string | undefined
  for (const a of pos.slice(1)) {
    if (!id && patron.test(a)) { id = a; continue }
    if (!rutaCruda) { rutaCruda = a; continue }
    return salir(`explorar: sobra el argumento "${a}" (uso: explorar <ruta> [--id <id>])`, CODIGOS.ERROR)
  }
  if (!id && !rutaCruda) return salir('explorar: falta la ruta y el id (p. ej. captura-cli explorar /inicio --id SUT-1)', CODIGOS.ERROR)
  if (!id) {
    if (!patron.test('explorar')) return salir(`explorar: falta el id (formato ${c.cfg.id.patron}): pasalo con --id <id> o CAPTURA_ID=<id>`, CODIGOS.ERROR)
    id = 'explorar'
  }
  const ruta = rutaCruda === undefined ? undefined : sinConversionMsys(rutaCruda)
  if (!ruta || !/^(\/|https?:\/\/)/.test(ruta)) {
    const msys = /^[A-Za-z]:[\\/]/.test(ruta ?? '') ? ' La ruta parece una ruta de Windows convertida por Git Bash: usar MSYS_NO_PATHCONV=1 o una URL completa.' : ''
    return salir(`explorar: falta la ruta (p. ej. /inicio o una URL)${msys}${process.platform === 'win32' ? '. En Git Bash, un argumento que empieza con "/" se convierte en una ruta de Windows: usar MSYS_NO_PATHCONV=1 o una URL completa' : ''}`, CODIGOS.ERROR)
  }
  const rol = texto(op['rol'])
  const app = texto(op['app'])
  // --rol solo hace falta si la app tiene login.
  const nombres = Object.keys(c.cfg.apps)
  const cfgApp = c.cfg.apps[app ?? (nombres.length === 1 ? nombres[0]! : '')]
  if (!rol && (!cfgApp || cfgApp.login)) return salir(`explorar: falta --rol (con qué rol entrar${cfgApp ? '; la app tiene login' : '; no hace falta si la app no tiene login'})`, CODIGOS.ERROR)
  const { sesion } = await import('./sesion.js')
  const { explorar } = await import('./explorar.js')
  const { estado } = await import('./estado.js')
  const { page, cerrar } = await sesion(rol ?? null, { ticket: id, ...(app ? { app } : {}), ...opcionesNavegador(op) })
  const e = estado(page)
  e.grabar = false // explorar no es un tramo para recetas
  await page.goto(/^https?:/.test(ruta) ? ruta : (e.app?.baseUrl ?? '') + ruta, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
  await explorar(page, { completo: true, max: 80, errores: !!op['errores'] })
  await cerrar({ ninguna: 'exploración desde el CLI' })
  return CODIGOS.OK
}

// ---------- adaptadores propios y entorno ----------

function adaptadorNuevo(tipo: string | undefined, op: Args['op']): number {
  if (!tipo || !(TIPOS as readonly string[]).includes(tipo)) return salir(`adaptador nuevo: falta el tipo (${TIPOS.join(', ')})`, CODIGOS.ERROR)
  const c = ctx()
  const t = tipo as TipoAdaptador
  const destino = texto(op['en']) ? resolve(texto(op['en'])!) : join(c.registro.proyecto, 'adaptadores', `${t}.mjs`)
  if (existsSync(destino)) return salir(`adaptador nuevo: ${destino} ya existe; no se sobrescribe (usar --en <otra ruta>)`, CODIGOS.ERROR)
  mkdirSync(dirname(destino), { recursive: true })
  writeFileSync(destino, PLANTILLAS[t])
  const base = c.configArchivo ? dirname(c.configArchivo) : c.raiz
  const rel = relative(base, destino).split(sep).join('/')
  console.log(`adaptador: ${destino}`)
  console.log(`declararlo en ${c.configArchivo ?? 'captura.config.json'}:\n  "adaptadores": { "${t}": { "usa": "${rel.startsWith('.') ? rel : `./${rel}`}" } }`)
  console.log('comprobar: captura-cli adaptadores verificar')
  return CODIGOS.OK
}

/** Salud de cada app declarada: ¿responde su baseUrl? (la VPN y los servicios los comprueban las precondiciones del config). */
async function saludDeApps(): Promise<{ lineas: string; malas: number }> {
  const c = ctx()
  const L: string[] = []
  let malas = 0
  for (const [n, a] of Object.entries(c.cfg.apps)) {
    let url = a.baseUrl
    try { url = c.adaptadores.entorno.url(n, a, c.slot) } catch { /* el adaptador no sabe la url: la del config */ }
    try {
      // Un backend que se está levantando tarda ~25 s en responder: el tope tiene que dejarlo llegar.
      const r = await fetch(url, { signal: AbortSignal.timeout(30000) })
      L.push(`  ${n}: ${url} -> responde (HTTP ${r.status})`)
    } catch (e) {
      malas++
      L.push(`  ${n}: ${url} -> NO RESPONDE (${String((e as Error).message).split('\n')[0]})`)
    }
  }
  return { lineas: L.join('\n'), malas }
}

async function entornoCli(sub: string | undefined, args: string[]): Promise<number> {
  const c = ctx()
  const e = c.adaptadores.entorno
  if (sub !== 'levantar' && sub !== 'estado' && sub !== 'parar') return salir('entorno: levantar <app> [args…] | estado | parar [app]', CODIGOS.ERROR)
  if (typeof e[sub] !== 'function') return salir(`entorno ${sub}: el adaptador de entorno no implementa ${sub}(); declarar "comandos.${sub}" (builtin:comando) o escribir uno propio (captura-cli adaptador nuevo entorno)`, CODIGOS.ERROR)
  let r
  try {
    if (sub === 'levantar') {
      const app = args[0]
      if (!app) return salir('entorno levantar: falta la app', CODIGOS.ERROR)
      // La caché del slot caduca solo: lo que tiene más de 14 días se borra antes de levantar.
      const { expirarCache, DIAS_CACHE } = await import('./limpiar.js')
      const v = expirarCache(c.dirWs, c.dirSlot)
      if (v.borrados) console.log(`caché: ${v.borrados} archivo(s) de más de ${DIAS_CACHE} días borrados (${Math.round(v.bytes / 1024)} KB)`)
      r = await e.levantar!(app, { slot: c.slot, args: args.slice(1) })
    } else if (sub === 'estado') {
      r = await e.estado!({ slot: c.slot })
      const salud = await saludDeApps()
      if (salud.lineas) console.log(`salud:\n${salud.lineas}`)
      if (salud.malas) console.error(`AVISO: ${salud.malas} app(s) no responden: puede ser la VPN o un servicio caído (declarar "precondiciones" en captura.config.json para comprobarlo antes de capturar)`)
    } else r = await e.parar!(args[0], { slot: c.slot })
  } catch (err) {
    if (esFaltaConfiguracion(err)) return salir(`FALTAN_CREDENCIALES: entorno -> ${err.message}`, CODIGOS.FALTAN_CREDENCIALES)
    throw err
  }
  if (r.salida) console.log(r.salida)
  console.log(`entorno ${sub}: ${r.ok ? 'ok' : 'con problemas'} (slot ${c.slot})`)
  return r.ok ? CODIGOS.OK : CODIGOS.ERROR
}

// ---------- limpiar y doctor ----------

async function limpiarCli(op: Args['op']): Promise<number> {
  const a = texto(op['antes'])
  if (a !== undefined && !/^\d+d$/.test(a)) return salir(`limpiar --antes: días, p. ej. 30d (recibido "${a}")`, CODIGOS.ERROR)
  const c = ctx()
  const l = await import('./limpiar.js')
  const { grupos, avisos } = l.planificar({ dirWs: c.dirWs, salidas: c.rutas.salidas, corridaActual: c.corrida, ...(a ? { antesDias: Number(a.slice(0, -1)) } : {}) })
  console.log(l.formatearPlan(grupos, avisos, !!op['aplicar']))
  if (!op['aplicar'] || !grupos.length) return CODIGOS.OK
  const r = l.aplicar(c.dirWs, grupos)
  for (const e of r.errores) console.error(`AVISO: ${e}`)
  console.log(`borrados: ${r.borrados} archivo(s), ${Math.round(r.bytes / 1024)} KB`)
  return r.errores.length ? CODIGOS.ERROR : CODIGOS.OK
}

async function doctorCli(op: Args['op']): Promise<number> {
  const d = await import('./doctor.js')
  const cs = await d.revisar({ instalar: !!op['instalar'] })
  console.log(d.formatearChequeos(cs))
  return cs.some((x) => x.estado === 'FALTA') ? CODIGOS.ERROR : CODIGOS.OK
}

// ---------- stats ----------

async function statsCli(op: Args['op']): Promise<number> {
  const s = await import('./stats.js')
  const tr = texto(op['transcrito'])
  if (tr) {
    if (!existsSync(tr)) return salir(`stats: no existe el transcrito ${tr}`, CODIGOS.ERROR)
    const r = s.leerTranscrito(tr)
    console.log(op['json'] ? JSON.stringify(r, null, 2) : s.formatearTranscrito(tr, r))
    return CODIGOS.OK
  }
  const d = texto(op['desde'])
  if (d !== undefined && !/^\d+d$/.test(d)) return salir(`stats --desde: días, p. ej. 7d (recibido "${d}")`, CODIGOS.ERROR)
  const id = texto(op['id'])
  const desde = d ? Date.now() - Number(d.slice(0, -1)) * 86400000 : 0
  const etiqueta = d ? new Date(desde).toISOString().slice(0, 10) : ''
  if (op['todos']) {
    const raizWs = join(home(), 'workspaces')
    const nombres = existsSync(raizWs) ? readdirSync(raizWs) : []
    const todas = nombres.flatMap((n) => s.leerLibro(join(raizWs, n, 'uso.jsonl'), desde))
    const lineas = id ? s.deId(todas, id) : todas
    if (op['json']) { console.log(JSON.stringify(s.resumir(lineas), null, 2)); return CODIGOS.OK }
    console.log(s.formatear(`todos (${nombres.length} workspace(s))${id ? ` · ${id}` : ''}`, s.resumir(lineas), etiqueta))
    for (const n of nombres) {
      const l = s.leerLibro(join(raizWs, n, 'uso.jsonl'), desde)
      const r = s.resumir(id ? s.deId(l, id) : l)
      if (r.corridas) console.log(`  ${n}: ${r.corridas} corrida(s), ${r.tokens} tokens estimados`)
    }
    return CODIGOS.OK
  }
  const c = ctx()
  const lineas = s.leerLibro(join(c.dirWs, 'uso.jsonl'), desde)
  const r = s.resumir(id ? s.deId(lineas, id) : lineas)
  if (op['json']) { console.log(JSON.stringify(r, null, 2)); return CODIGOS.OK }
  console.log(s.formatear(id ? `${c.registro.nombre} · ${id}` : c.registro.nombre, r, etiqueta))
  console.log(s.espacio(c.rutas.salidas, c.dirWs))
  if (!c.registro.estadisticas) console.log('(el registro de estadísticas está apagado: captura-cli config estadisticas si)')
  return CODIGOS.OK
}

// ---------- hooks del plugin ----------

/** La entrada JSON que Claude Code pasa a un hook por stdin, con tope: un hook nunca se queda esperando. */
function leerEntrada(ms = 5000): Promise<string> {
  if (process.stdin.isTTY) return Promise.resolve('')
  return new Promise((ok) => {
    let s = ''
    const fin = (): void => { clearTimeout(t); process.stdin.pause(); ok(s) }
    const t = setTimeout(fin, ms)
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (d: string) => { s += d })
    process.stdin.on('end', fin)
    process.stdin.on('error', fin)
  })
}

async function hookCli(evento: string | undefined): Promise<number> {
  if (evento !== 'cierre' && evento !== 'inicio') return salir('hook: cierre | inicio (los llama el plugin de Claude Code)', CODIGOS.ERROR)
  const { hookCierre, hookInicio } = await import('./hook.js')
  try {
    const r = await (evento === 'cierre' ? hookCierre : hookInicio)(await leerEntrada())
    if (r.salida) console.log(r.salida)
    return r.codigo
  } catch (e) {
    // Un hook roto no debe trabar al agente: se informa y se deja seguir.
    console.error(`captura-cli hook ${evento}: ${(e as Error).message}`)
    return CODIGOS.OK
  }
}

/**
 * Workspace sin configurar: con una persona al teclado se ofrece configurarlo ahora y el comando sigue; si dice que no
 * (o no hay teclado, como con un agente), sigue sin registro y el comando sale con WORKSPACE_NUEVO (6) y las preguntas.
 */
async function ofrecerRegistro(): Promise<void> {
  const raiz = raizWorkspace()
  if (leerRegistro(raiz) || !hayTeclado()) return
  if (!(await configurarInteractivo(raiz))) return salir(mensajeWorkspaceNuevo(raiz), CODIGOS.WORKSPACE_NUEVO)
}

// Opciones que equivalen a variables de entorno: se aplican antes de resolver el contexto.
function aplicarOpcionesDeEntorno(op: Args['op']): void {
  for (const [o, v] of [['config', 'CAPTURA_CONFIG'], ['out', 'CAPTURA_OUT'], ['slot', 'CAPTURA_SLOT'], ['canal', 'CAPTURA_CANAL']] as const) {
    const x = texto(op[o])
    if (x !== undefined) process.env[v] = o === 'config' || o === 'out' ? resolve(x) : x
  }
  if (op['limpiar']) process.env['CAPTURA_LIMPIAR'] = '1'
}

// ---------- scripts ----------

/**
 * captura-cli script [--slot N] [--canal c] [--out ruta] [--config ruta] [--limpiar] <archivo.mjs> [args del script…]
 * Lo que va después del archivo es del script; las opciones de captura-cli van antes.
 */
async function scriptCli(args: string[]): Promise<number> {
  const propias: Args['op'] = {}
  let i = 0
  for (; i < args.length && args[i]!.startsWith('--'); i++) {
    const [k, v] = args[i]!.slice(2).split(/=(.*)/s)
    if (!['slot', 'canal', 'out', 'config', 'limpiar'].includes(k!)) return salir(`script: opción desconocida --${k} antes del archivo (válidas: --slot, --canal, --out, --config, --limpiar); lo que va después del archivo es para el script`, CODIGOS.ERROR)
    if (k === 'limpiar') { propias['limpiar'] = true; continue }
    const valor = v ?? args[++i]
    if (valor === undefined) return salir(`script: falta el valor de --${k}`, CODIGOS.ERROR)
    propias[k!] = valor
  }
  const archivo = args[i]
  if (!archivo) return salir('script: falta el archivo (captura-cli script [--slot N] [--canal c] [--out ruta] [--config ruta] [--limpiar] <archivo.mjs> [args…])', CODIGOS.ERROR)
  aplicarOpcionesDeEntorno(propias)
  await ofrecerRegistro()
  await preparar()
  // El libro de uso arranca aquí: cada invocación (aunque falle) queda contada con su código de salida.
  iniciarLibro('script', basename(archivo))
  const { ejecutarScript } = await import('./script.js')
  return ejecutarScript(archivo, args.slice(i + 1))
}

async function main(): Promise<number> {
  const crudo = process.argv.slice(2)
  if (crudo[0] === 'script') return scriptCli(crudo.slice(1))
  const { pos, op } = parsear(crudo)
  const cmd = pos[0]
  if (op['version']) { console.log(VERSION); return 0 }
  if (op['help'] || cmd === 'help' || !cmd) { console.log(AYUDA); return cmd || op['help'] ? 0 : 1 }
  if (cmd !== 'hook' && cmd !== 'stats') iniciarLibro(pos.slice(0, cmd === 'adaptador' || cmd === 'adaptadores' || cmd === 'entorno' || cmd === 'config' ? 2 : 1).join(' '))
  if (cmd === 'init') return init(op)
  if (cmd === 'config' && pos[1]) return cambiarConfig(pos[1], pos[2])
  if (cmd === 'hook') return hookCli(pos[1])
  if (cmd === 'stats' && (op['todos'] || op['transcrito'])) return statsCli(op)
  if (cmd === 'doctor') return doctorCli(op)
  aplicarOpcionesDeEntorno(op)
  await ofrecerRegistro()
  await preparar()
  if (cmd === 'validar') return validar(pos[1], op)
  const c = ctx() // sale con 6 si el workspace no está registrado, con 1 si la config es inválida
  if (cmd === 'run') {
    const esc = await cargarEscenario(pos[1], op)
    const sm = texto(op['sesion-min'])
    if (sm !== undefined) {
      if (!/^\d+(\.\d+)?$/.test(sm)) return salir(`--sesion-min: minutos (recibido "${sm}")`, CODIGOS.ERROR)
      c.cfg.sesionMin = Number(sm)
    }
    const { ejecutarEscenario } = await import('./ejecutar.js')
    return ejecutarEscenario(esc, opcionesNavegador(op))
  }
  if (cmd === 'explorar') return explorarCli(pos, op)
  if (cmd === 'stats') return statsCli(op)
  if (cmd === 'limpiar') return limpiarCli(op)
  if (cmd === 'adaptador' && pos[1] === 'nuevo') return adaptadorNuevo(pos[2], op)
  if (cmd === 'entorno') return entornoCli(pos[1], pos.slice(2))
  if (cmd === 'config') {
    const r = leerRegistro(c.raiz)
    const ad = (t: TipoAdaptador): string => {
      const ref = c.cfg.adaptadores[t]
      return ref ? (typeof ref === 'string' ? ref : ref.usa) : t === 'correo' ? (c.cfg.extras.includes('correo') ? 'builtin:mailpit (extras)' : '(ninguno)') : '(incluido por defecto)'
    }
    console.log([
      `workspace: ${c.raiz}`, `almacén: ${dirWorkspace(c.raiz)} (CAPTURA_HOME=${home()})`,
      `salidas: ${c.rutas.salidas}`, `salidas-origen: ${process.env['CAPTURA_OUT'] ? 'CAPTURA_OUT (manda sobre todo)' : c.cfg.rutas.salidas ? 'rutas.salidas del captura.config.json' : origenSalidas(r?.salidasPorDefecto === true)}`, `proyecto: ${r?.proyecto ?? ''}`, `config: ${c.configArchivo ?? '(sin archivo: valores por defecto)'}`,
      `recetas: ${c.rutas.recetas}`, `helpers: ${c.rutas.helpers}`, `escenarios: ${c.rutas.escenarios}`, `sesiones: ${c.rutas.sesiones}`,
      `slot: ${c.slot}`, `estadisticas: ${r?.estadisticas ? 'si' : 'no'}`, `salidas-base: ${leerConfigUsuario().salidasBase ?? '(ninguna: el almacén)'}`,
      `id: ${c.cfg.id.patron}${c.cfg.id.mayusculas ? ' (carpeta en mayúsculas)' : ''}`,
      `credenciales: ${c.cfg.credenciales.prefijo}<ROL>_USUARIO / _CLAVE en ${c.cfg.credenciales.archivo}`,
      `apps: ${Object.keys(c.cfg.apps).join(', ') || '(ninguna)'}`,
      `adaptadores: ${TIPOS.map((t) => `${t}=${ad(t)}`).join(' · ')}`,
      'cambiar: captura-cli config <salidas|proyecto|estadisticas|salidas-base> <valor>',
    ].join('\n'))
    return 0
  }
  if (cmd === 'recetas') {
    const { listarRecetas } = await import('./recetas.js')
    const nombres = pos[1] ? [pos[1]] : Object.keys(c.cfg.apps)
    if (!nombres.length) { console.log('recetas: ninguna app declarada en captura.config.json'); return 0 }
    for (const n of nombres) { console.log(`# ${n}`); await listarRecetas(n) }
    return 0
  }
  if (cmd === 'adaptadores' && pos[1] === 'verificar') {
    let mal = 0
    for (const t of TIPOS as TipoAdaptador[]) {
      const ref = c.cfg.adaptadores[t]
      if (!ref) { console.log(`${t}: ${t === 'correo' ? 'sin declarar (opcional)' : 'incluido por defecto'}`); continue }
      try {
        await cargarUno(t, ref, c.cfg, { raiz: c.raiz, base: c.base, slot: c.slot, dirSlot: c.dirSlot })
        console.log(`${t}: ok (${typeof ref === 'string' ? ref : ref.usa})`)
      } catch (e) { mal++; console.log((e as Error).message) }
    }
    return mal ? CODIGOS.ERROR : 0
  }
  console.error(`comando desconocido: ${pos.join(' ')}\n\n${AYUDA}`)
  return CODIGOS.ERROR
}

main().then((code) => { process.exitCode = code }, (e: unknown) => salir(`ERROR: ${(e as Error)?.stack || String(e)}`, CODIGOS.ERROR))
