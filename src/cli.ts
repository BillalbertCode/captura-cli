#!/usr/bin/env node
// CLI de captura-cli. Pensado para agentes: salida en texto corto, códigos de salida estables, nunca espera stdin
// salvo `init` en una terminal interactiva.
import { createInterface } from 'node:readline/promises'
import { cargarUno } from './adaptadores/cargar.js'
import { TIPOS, type TipoAdaptador, esFaltaConfiguracion } from './adaptadores/contrato.js'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { PLANTILLAS } from './plantillas.js'
import type { OpcionesRun } from './ejecutar.js'
import { type Escenario, recetasDe, validarEscenario } from './escenario.js'
import { recetasFaltantes } from './recetas.js'
import { dirWorkspace, guardarConfigUsuario, home, leerConfigUsuario, leerRegistro, propuesta, raizWorkspace } from './almacen.js'
import { ctx, hayContexto, preparar } from './contexto.js'
import { CODIGOS, salir } from './salida.js'
import { VERSION } from './version.js'
import { mensajeWorkspaceNuevo, registrar } from './workspace.js'

const AYUDA = `captura-cli ${VERSION}: evidencia de lo que hizo un agente en el navegador

Uso:
  captura-cli init [--yes] [--salidas global|<ruta>] [--proyecto <ruta>] [--estadisticas si|no]
  captura-cli config                       muestra el registro, las rutas y la config efectiva del workspace
  captura-cli config <clave> <valor>       cambia salidas (global|ruta), proyecto, estadisticas (si|no)
                                           o salidas-base (ruta por defecto para workspaces nuevos)
  captura-cli validar <escenario>          revisa el escenario sin abrir el navegador (sale con 2 si no es válido)
  captura-cli run <escenario> [opciones]   valida y ejecuta el escenario; informe.md, casos.json y capturas
  captura-cli explorar <ruta> --rol <rol> [--app <app>] [--errores]
                                           lista lo interactivo de una pantalla con selectores sugeridos;
                                           --errores agrega campos inválidos y mensajes de error visibles
  captura-cli recetas [app]                catálogo de recetas con versión y estado
  captura-cli adaptadores verificar        comprueba cada adaptador contra el contrato
  captura-cli adaptador nuevo <tipo> [--en <ruta.mjs>]
                                           plantilla de un adaptador propio (credenciales, identificador,
                                           entorno, publicacion, correo) en <proyecto>/adaptadores/
  captura-cli entorno levantar <app> [args…] | estado | parar [app]
                                           servicios del slot propio, mediante el adaptador de entorno
  captura-cli --version | --help

  <escenario> es una ruta a un .json o un nombre de la carpeta de escenarios del proyecto.

Opciones de run y explorar:
  --id <id>             carpeta de salida (manda sobre "id" del escenario)
  --app <app>           app del config (por defecto la única declarada)
  --rol <rol>           rol con el que entrar (manda sobre "rol" del escenario)
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

La API de código: import { sesion, foto, marcar, caso } from 'captura-cli'

Códigos de salida: 0 ok · 1 error · 2 escenario inválido · 3 FALTAN_CREDENCIALES · 4 TIMEOUT_GLOBAL
  · 5 recetas sin declarar · 6 WORKSPACE_NUEVO · 7 PAGINA_COLGADA`

interface Args { pos: string[]; op: Record<string, string | true> }
const CON_VALOR = ['en', 'salidas', 'proyecto', 'estadisticas', 'id', 'app', 'rol', 'browser', 'canal', 'viewport', 'sesion-min', 'timeout', 'slot', 'out', 'config']
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
  const p = propuesta(raiz)
  let salidas = texto(op['salidas']), proyecto = texto(op['proyecto']), est = texto(op['estadisticas'])
  if (!op['yes']) {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      console.log(mensajeWorkspaceNuevo(raiz))
      return CODIGOS.WORKSPACE_NUEVO
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    try {
      salidas = (await rl.question(`¿Dónde van las salidas? [global = ${p.salidasGlobal}] o una ruta: `)).trim() || 'global'
      proyecto = (await rl.question(`¿Carpeta del proyecto (config, adaptadores, recetas)? [${p.proyecto}]: `)).trim() || p.proyecto
      est = (await rl.question('¿Registrar estadísticas de uso locales? [si]/no: ')).trim() || 'si'
    } finally { rl.close() }
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

async function explorarCli(ruta: string | undefined, op: Args['op']): Promise<number> {
  if (!ruta || !/^(\/|https?:\/\/)/.test(ruta)) return salir('explorar: falta la ruta (p. ej. /inicio o una URL)', CODIGOS.ERROR)
  const rol = texto(op['rol'])
  if (!rol) return salir('explorar: falta --rol (con qué rol entrar)', CODIGOS.ERROR)
  const { sesion } = await import('./sesion.js')
  const { explorar } = await import('./explorar.js')
  const { estado } = await import('./estado.js')
  const app = texto(op['app'])
  const { page, cerrar } = await sesion(rol, { ticket: texto(op['id']) ?? 'explorar', ...(app ? { app } : {}), ...opcionesNavegador(op) })
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
      r = await e.levantar!(app, { slot: c.slot, args: args.slice(1) })
    } else if (sub === 'estado') r = await e.estado!({ slot: c.slot })
    else r = await e.parar!(args[0], { slot: c.slot })
  } catch (err) {
    if (esFaltaConfiguracion(err)) return salir(`FALTAN_CREDENCIALES: entorno -> ${err.message}`, CODIGOS.FALTAN_CREDENCIALES)
    throw err
  }
  if (r.salida) console.log(r.salida)
  console.log(`entorno ${sub}: ${r.ok ? 'ok' : 'con problemas'} (slot ${c.slot})`)
  return r.ok ? CODIGOS.OK : CODIGOS.ERROR
}

async function main(): Promise<number> {
  const { pos, op } = parsear(process.argv.slice(2))
  const cmd = pos[0]
  if (op['version']) { console.log(VERSION); return 0 }
  if (op['help'] || cmd === 'help' || !cmd) { console.log(AYUDA); return cmd || op['help'] ? 0 : 1 }
  if (cmd === 'init') return init(op)
  if (cmd === 'config' && pos[1]) return cambiarConfig(pos[1], pos[2])
  // Opciones que equivalen a variables de entorno: se aplican antes de resolver el contexto.
  for (const [o, v] of [['config', 'CAPTURA_CONFIG'], ['out', 'CAPTURA_OUT'], ['slot', 'CAPTURA_SLOT'], ['canal', 'CAPTURA_CANAL']] as const) {
    const x = texto(op[o])
    if (x !== undefined) process.env[v] = o === 'config' || o === 'out' ? resolve(x) : x
  }
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
  if (cmd === 'explorar') return explorarCli(pos[1], op)
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
      `salidas: ${c.rutas.salidas}`, `proyecto: ${r?.proyecto ?? ''}`, `config: ${c.configArchivo ?? '(sin archivo: valores por defecto)'}`,
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
