#!/usr/bin/env node
// CLI de captura-cli. Pensado para agentes: salida en texto corto, códigos de salida estables, nunca espera stdin
// salvo `init` en una terminal interactiva.
import { createInterface } from 'node:readline/promises'
import { cargarUno } from './adaptadores/cargar.js'
import { TIPOS, type TipoAdaptador } from './adaptadores/contrato.js'
import { resolve } from 'node:path'
import { dirWorkspace, guardarConfigUsuario, home, leerConfigUsuario, leerRegistro, propuesta, raizWorkspace } from './almacen.js'
import { ctx, preparar } from './contexto.js'
import { CODIGOS, salir } from './salida.js'
import { VERSION } from './version.js'
import { mensajeWorkspaceNuevo, registrar } from './workspace.js'

const AYUDA = `captura-cli ${VERSION}: evidencia de lo que hizo un agente en el navegador

Uso:
  captura-cli init [--yes] [--salidas global|<ruta>] [--proyecto <ruta>] [--estadisticas si|no]
  captura-cli config                       muestra el registro, las rutas y la config efectiva del workspace
  captura-cli config <clave> <valor>       cambia salidas (global|ruta), proyecto, estadisticas (si|no)
                                           o salidas-base (ruta por defecto para workspaces nuevos)
  captura-cli recetas [app]                catálogo de recetas con versión y estado
  captura-cli adaptadores verificar        comprueba cada adaptador contra el contrato
  captura-cli --version | --help

La API de código: import { sesion, foto, marcar, caso } from 'captura-cli'

Códigos de salida: 0 ok · 1 error · 2 escenario inválido · 3 FALTAN_CREDENCIALES · 4 TIMEOUT_GLOBAL
  · 5 recetas sin declarar · 6 WORKSPACE_NUEVO · 7 PAGINA_COLGADA`

interface Args { pos: string[]; op: Record<string, string | true> }
function parsear(argv: string[]): Args {
  const pos: string[] = [], op: Record<string, string | true> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (!a.startsWith('--')) { pos.push(a); continue }
    const [k, v] = a.slice(2).split(/=(.*)/s)
    if (v !== undefined) op[k!] = v
    else if (argv[i + 1] !== undefined && !argv[i + 1]!.startsWith('--') && ['salidas', 'proyecto', 'estadisticas'].includes(k!)) op[k!] = argv[++i]!
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

async function main(): Promise<number> {
  const { pos, op } = parsear(process.argv.slice(2))
  const cmd = pos[0]
  if (op['version']) { console.log(VERSION); return 0 }
  if (op['help'] || cmd === 'help' || !cmd) { console.log(AYUDA); return cmd || op['help'] ? 0 : 1 }
  if (cmd === 'init') return init(op)
  if (cmd === 'config' && pos[1]) return cambiarConfig(pos[1], pos[2])
  await preparar()
  const c = ctx() // sale con 6 si el workspace no está registrado, con 1 si la config es inválida
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
