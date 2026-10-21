#!/usr/bin/env node
// CLI de captura-cli. Pensado para agentes: salida en texto corto, códigos de salida estables, nunca espera stdin
// salvo `init` en una terminal interactiva.
import { createInterface } from 'node:readline/promises'
import { cargarUno } from './adaptadores/cargar.js'
import { TIPOS, type TipoAdaptador } from './adaptadores/contrato.js'
import { dirWorkspace, home, leerRegistro, propuesta, raizWorkspace } from './almacen.js'
import { ctx, preparar } from './contexto.js'
import { CODIGOS, salir } from './salida.js'
import { VERSION } from './version.js'
import { mensajeWorkspaceNuevo, registrar } from './workspace.js'

const AYUDA = `captura-cli ${VERSION}: evidencia de lo que hizo un agente en el navegador

Uso:
  captura-cli init [--yes] [--salidas global|<ruta>] [--proyecto <ruta>] [--estadisticas si|no]
  captura-cli config                       muestra el registro y las rutas del workspace
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

async function main(): Promise<number> {
  const { pos, op } = parsear(process.argv.slice(2))
  const cmd = pos[0]
  if (op['version']) { console.log(VERSION); return 0 }
  if (op['help'] || cmd === 'help' || !cmd) { console.log(AYUDA); return cmd || op['help'] ? 0 : 1 }
  if (cmd === 'init') return init(op)
  await preparar()
  const c = ctx() // sale con 6 si el workspace no está registrado
  if (cmd === 'config') {
    const r = leerRegistro(c.raiz)
    console.log([
      `workspace: ${c.raiz}`, `almacén: ${dirWorkspace(c.raiz)} (CAPTURA_HOME=${home()})`,
      `salidas: ${c.rutas.salidas}`, `proyecto: ${r?.proyecto ?? ''}`, `config: ${c.configArchivo ?? '(sin archivo: valores por defecto)'}`,
      `recetas: ${c.rutas.recetas}`, `slot: ${c.slot}`, `estadisticas: ${r?.estadisticas ? 'si' : 'no'}`,
      `apps: ${Object.keys(c.cfg.apps).join(', ') || '(ninguna)'}`,
      'cambiar: captura-cli init --yes … (vuelve a registrar con las respuestas nuevas)',
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
