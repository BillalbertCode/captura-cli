// Recetas: lo ya probado se reutiliza, si no se rompe se avanza. Una receta es un tramo de pantalla ya verificado
// con su propia comprobación. Es conocimiento del PROYECTO, no de esta herramienta: vive en la carpeta de recetas
// del workspace (<app>.mjs, y comun.mjs para lo compartido). El núcleo solo sabe cargarlas, ejecutarlas y anotar.
//   export default { 'abrir-bandeja': { version: 1, descripcion, vistoEn, verificar(page, args), hacer(page, args) } }
// receta(page, id, args): si verificar() ya pasa, no hace nada («ya estaba»); si no, hace() y vuelve a verificar().
// Si falla, la marca «rota» y dice dónde corregirla: se sube su `version` y se vuelve a probar.
// El estado (ok/rota, versión, id, fecha) se guarda en el almacén. CAPTURA_RECETAS cambia la carpeta.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Page } from 'playwright'
import { ctx } from './contexto.js'
import { type Declaracion, type Tramo, estado } from './estado.js'
import { sinReceta } from './grabacion.js'
import { CODIGOS } from './salida.js'

export interface Receta {
  version?: number
  descripcion?: string
  vistoEn?: string
  verificar?: (page: Page, args: Record<string, unknown>) => unknown
  hacer: (page: Page, args: Record<string, unknown>) => unknown
}
type Catalogo = Record<string, Receta & { origen: string }>
type EstadoRecetas = Record<string, { estado: 'ok' | 'rota'; version: number; ticket: string; fecha: string; error?: string }>

const dirRecetas = (): string => ctx().rutas.recetas
const archivoEstado = (): string => ctx().rutas.estadoRecetas
const leerEstado = (): EstadoRecetas => { try { return JSON.parse(readFileSync(archivoEstado(), 'utf8')) as EstadoRecetas } catch { return {} } }

function anotar(clave: string, est: 'ok' | 'rota', version: number, ticket: string, error?: string): void {
  const e = leerEstado()
  e[clave] = { estado: est, version, ticket, fecha: new Date().toISOString().slice(0, 16).replace('T', ' '), ...(error ? { error } : {}) }
  mkdirSync(dirname(archivoEstado()), { recursive: true })
  writeFileSync(archivoEstado(), JSON.stringify(e, null, 2))
}

async function catalogo(app: string): Promise<Catalogo> {
  const out: Catalogo = {}
  for (const n of ['comun', app]) {
    const f = join(dirRecetas(), `${n}.mjs`)
    if (!n || !existsSync(f)) continue
    const m = (await import(`${pathToFileURL(f).href}?t=${statSync(f).mtimeMs}`)) as { default?: Record<string, Receta> }
    for (const [id, r] of Object.entries(m.default || {})) out[id] = { ...r, origen: n }
  }
  return out
}

const archivoApp = (n: string): string => join(dirRecetas(), `${n}.mjs`)

/** Ids que no están en el catálogo de la app (comun + app). Para validar un escenario sin abrir el navegador. */
export async function recetasFaltantes(app: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return []
  const c = await catalogo(app)
  return ids.filter((id) => !c[id])
}

/** Índice compacto de lo que ya existe para una app: mirarlo ANTES de escribir un script nuevo. */
export async function listarRecetas(app: string): Promise<string[]> {
  const c = await catalogo(app)
  const est = leerEstado()
  const ids = Object.keys(c)
  console.log(ids.length
    ? ids.map((id) => `${id}@v${c[id]?.version ?? 1} [${est[`${app}/${id}`]?.estado || 'sin uso'}] ${c[id]?.descripcion || ''}`).join('\n')
    : `recetas de ${app}: ninguna`)
  return ids
}

export async function receta(page: Page, id: string, args: Record<string, unknown> = {}, { app = estado(page).appNombre }: { app?: string | undefined } = {}): Promise<void> {
  if (!app) throw new Error('receta(): falta la app (abrir con sesion() o pasar { app })')
  const e = estado(page)
  const c = await catalogo(app)
  const r = c[id]
  if (!r) throw new Error(`receta "${id}" no existe para ${app}. Existentes: ${Object.keys(c).join(', ') || 'ninguna'}. Explorar con diagnostico(), probar los pasos y registrarla en ${archivoApp(app)}`)
  const v = r.version ?? 1
  const clave = `${app}/${id}`
  const verifica = async (): Promise<boolean> => (r.verificar ? Boolean(await Promise.resolve(r.verificar(page, args)).catch(() => false)) : false)
  let modo: 'ya estaba' | 'ejecutada' = 'ya estaba'
  e.acciones.push({ t: 'receta', id })
  e.ultimoPaso = `receta ${id}`
  if (!(await verifica())) {
    modo = 'ejecutada'
    const grab = e.grabar
    e.grabar = false
    try { await r.hacer(page, args) } catch (err) {
      const msg = String((err as Error).message || err).split('\n')[0]!.slice(0, 200)
      anotar(clave, 'rota', v, e.id, msg)
      throw new Error(`receta "${id}"@v${v} falló al ejecutar: ${msg}. Corregirla en ${archivoApp(r.origen)} y subir su version`)
    } finally { e.grabar = grab }
    if (r.verificar && !(await verifica())) {
      anotar(clave, 'rota', v, e.id, 'verificar() no pasa tras hacer()')
      throw new Error(`receta "${id}"@v${v}: se ejecutó pero verificar() no pasa. Corregirla en ${archivoApp(r.origen)} y subir su version`)
    }
  }
  anotar(clave, 'ok', v, e.id)
  e.recetasUsadas.push({ id, version: v, modo })
  console.log(`receta ${id}@v${v}: ${modo}`)
}

// Al terminar el caso se nombran las recetas usadas (automático) y las creadas (declaradas), o se explica por qué ninguna.
//   declararRecetas(page, { creadas: ['abrir-bandeja'] })         // las registró en <recetas>/<app>.mjs
//   declararRecetas(page, { ninguna: 'tramo de una sola vez, no se repite' })
// También vale pasarlo a cerrar({ creadas } | { ninguna }). Si el script hizo pasos por su cuenta (sin receta) y no se
// declara nada, cerrar() falla con código 5 y el informe queda marcado INCOMPLETO.
export function declararRecetas(page: Page, d: Declaracion): void { estado(page).declaracion = d }

export async function cerrarRecetas(page: Page, d?: Declaracion): Promise<void> {
  const e = estado(page)
  const dec = d || e.declaracion || {}
  const resto = e.acciones.filter((a) => a.t !== 'receta')
  if (resto.length) e.tramos.push({ foto: '(después de la última captura)', url: '', acciones: e.acciones.splice(0) })
  const tramos = sinReceta(page)
  const usadas = [...new Set(e.recetasUsadas.map((r) => `${r.id}@v${r.version} (${r.modo})`))]
  const creadas = dec.creadas || []
  const ninguna = typeof dec.ninguna === 'string' && dec.ninguna.trim() ? dec.ninguna.trim() : ''
  const problemas: string[] = []
  if (creadas.length && e.appNombre) {
    const c = await catalogo(e.appNombre)
    const faltan = creadas.filter((id) => !c[id])
    if (faltan.length) problemas.push(`recetas declaradas como creadas que no existen en ${archivoApp(e.appNombre)}: ${faltan.join(', ')}`)
  }
  if (tramos.length && !creadas.length && !ninguna) {
    problemas.push(`${tramos.length} tramo(s) hechos sin receta (ver recetas-candidatas.md): registrar las que se repetirán en ${join(dirRecetas(), '<app>.mjs')} y declararRecetas(page, { creadas: [...] }), o declararRecetas(page, { ninguna: 'motivo' })`)
  }
  console.log(`recetas usadas: ${usadas.join(', ') || 'ninguna'}`)
  console.log(`recetas creadas: ${creadas.join(', ') || (ninguna ? `ninguna (${ninguna})` : 'ninguna')}`)
  if (tramos.length) {
    const f = join(e.base, 'recetas-candidatas.md')
    writeFileSync(f, borrador(e.id, tramos))
    console.log(`recetas candidatas: ${f} (${tramos.length} tramo(s) sin receta; borrador para revisar, no copiar a ciegas)`)
  }
  e.recetasResumen = { usadas, creadas, ninguna, pendiente: problemas.length > 0 }
  for (const p of problemas) console.error(`ERROR recetas: ${p}`)
  if (problemas.length) process.exitCode = CODIGOS.RECETAS_SIN_DECLARAR
}

const esc = (s: string): string => s.replace(/'/g, "\\'")

function borrador(id: string, tramos: Tramo[]): string {
  const L = [`# Recetas candidatas de ${id} (borrador generado de lo que hizo el script)`, '',
    `Cada tramo es lo hecho hasta una captura. Sirve de punto de partida: unir tramos, ponerle id y \`verificar\` reales, y registrarlo en \`${join(dirRecetas(), '<app>.mjs')}\`. Lo hecho dentro de una receta no aparece acá.`, '']
  tramos.forEach((t, i) => {
    const ruta = t.url || ''
    L.push(`## Tramo ${i + 1} → ${t.foto}${ruta ? ` (ruta ${ruta})` : ''}`, '', '```js',
      `'tramo-${i + 1}': { version: 1, descripcion: '${esc(t.leyenda || t.foto)}', vistoEn: '${id}',`,
      `  verificar: async (page) => ${ruta ? `new URL(page.url()).pathname === '${ruta}'` : 'true /* completar */'}${t.marca ? ` && await page.getByText('${esc(t.marca)}').first().isVisible()` : ''},`,
      '  hacer: async (page) => {')
    for (const a of t.acciones) {
      if (a.t === 'receta') L.push(`    // usó la receta ${a.id}`)
      else if (a.t === 'ir') L.push(`    await page.goto(page.__app.baseUrl + '${a.url}')`)
      else if (a.t === 'click') L.push(`    await ${a.sel}.click()`)
      else if (a.t === 'fill') L.push(`    await ${a.sel}.fill('${esc(String(a.valor))}')${a.valor === '<clave>' ? ' // parametrizar: args' : ''}`)
      else L.push(`    await ${a.sel}.selectOption({ label: '${esc(String(a.valor))}' })`)
    }
    L.push('  } },', '```', '')
  })
  return L.join('\n')
}
