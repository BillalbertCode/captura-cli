// Casos, cambios e informe. Acumulativo: casos y cambios se guardan en casos.json (por carpeta de captura) e
// informe.md se regenera desde él. Un caso con el mismo nombre reemplaza al anterior, así se puede repetir una fase
// sin duplicar. Las capturas registradas por foto() (con leyenda y marca) se copian a publicar/: de ahí, y solo de
// ahí, se suben. Un PNG step*.png que no pasó por foto() se avisa como "sin registrar".
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from 'playwright'
import { createHash } from 'node:crypto'
import { type Cambio, type Caso, type Error5xx, type Foto, estado } from './estado.js'
import { slug } from './fotos.js'
import { VERSION } from './version.js'

/** Registra un caso para informe.md: { nombre, esperado, observado, ok, captura? } */
export function caso(page: Page, c: Caso): void {
  estado(page).casos.push(c)
  console.log(`${c.ok ? 'OK' : 'FALLA'} ${c.nombre}${c.ok ? '' : ` | esperado: ${c.esperado} | observado: ${c.observado}`}`)
}

/** Diario de cambios: todo lo que se escribió (siempre por la UI/API de la app, nunca SQL) y si se revirtió. */
export function cambio(page: Page, c: Cambio): void {
  estado(page).cambios.push(c)
  console.log(`cambio: ${c.que}${c.revertido ? ' (revertido)' : ` | revertir: ${c.revertir}`}`)
}

export interface BloqueConfiguracion {
  revertido(): void
  fin(): Promise<void>
}

// Bloque de configuración como admin (habilitar/deshabilitar un parámetro, menú o permiso desde la UI):
// documenta paso a paso desde el inicio, en <id>/config-<que>/, para dejar la causa de lo que se prueba después.
//   const b = configuracion(page, { que: 'habilitar parámetro X', reversion: false })
//   … navegar, marcar() y foto() cada paso …
//   await b.fin()                       // vuelve a la carpeta normal
// reversion (por defecto false): la mayoría de las veces el cambio se deja. Con reversion:true se hacen los pasos
// inversos con sus capturas, se llama b.revertido() y fin() avisa si faltó.
export function configuracion(page: Page, { que, reversion = false }: { que: string; reversion?: boolean }): BloqueConfiguracion {
  if (!que) throw new Error('configuracion(): falta { que }')
  const e = estado(page)
  const previo = e.dir
  e.dir = join(e.base, `config-${slug(que)}`)
  mkdirSync(e.dir, { recursive: true })
  const c: Cambio = { que, revertir: reversion ? 'invertir los mismos pasos desde el panel' : 'sin reversión (reversion:false)', revertido: false }
  cambio(page, c)
  let hecho = false
  return {
    revertido() { c.revertido = true; hecho = true },
    async fin() {
      if (reversion && !hecho) console.error(`AVISO: configuracion "${que}" pidió reversion:true pero no se llamó revertido()`)
      e.dir = previo
    },
  }
}

function pngsSueltos(dir: string): string[] {
  const out: string[] = []
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    if (d.isDirectory() && d.name !== 'publicar') out.push(...pngsSueltos(join(dir, d.name)))
    else if (d.isFile() && /^step\d+-.*\.png$/.test(d.name)) out.push(join(dir, d.name))
  }
  return out
}

interface Acumulado {
  casos: Caso[]
  cambios: Cambio[]
  fotos: Foto[]
  recetas?: { usadas: string[]; creadas: string[]; ninguna: string[]; pendiente: boolean }
  /** Respuestas 5xx de la última corrida (no se acumulan: describen el estado del servidor de esa corrida). */
  errores5xx?: Error5xx[]
}

// manifest.json: lo mismo que informe.md, para máquinas (un adaptador de publicación, un hook, otro agente).
// Rutas relativas a la carpeta del id; sha256 de cada PNG para comprobar lo que se sube.
function escribirManifest(base: string, id: string, acum: Acumulado, sueltas: string[]): void {
  const hash = (rel: string): string | null => {
    const f = join(base, rel)
    return existsSync(f) ? createHash('sha256').update(readFileSync(f)).digest('hex') : null
  }
  const publicado = (rel: string): string => `publicar/${rel.replace(/^\.\//, '').replaceAll('/', '__')}`
  const ok = acum.casos.filter((c) => c.ok).length
  const m = {
    version: 1,
    herramienta: { nombre: 'captura-cli', version: VERSION },
    id,
    actualizado: new Date().toISOString(),
    resumen: {
      casos: acum.casos.length, ok, falla: acum.casos.length - ok, capturas: acum.fotos.length,
      sinRegistrar: sueltas.length, recetasPendientes: acum.recetas?.pendiente ?? false, errores5xx: acum.errores5xx?.length ?? 0,
    },
    casos: acum.casos.map((c) => ({ nombre: c.nombre, esperado: c.esperado, observado: c.observado, ok: c.ok, captura: c.captura || null })),
    capturas: acum.fotos.map((f) => ({
      archivo: f.ruta, publicar: publicado(f.ruta), paso: f.paso, leyenda: f.leyenda, marcada: f.marcada,
      sinMarca: f.sinMarca || null, marcas: f.marcas, sha256: hash(f.ruta),
    })),
    cambios: acum.cambios,
    recetas: acum.recetas ?? null,
    errores5xx: acum.errores5xx ?? [],
    sinRegistrar: sueltas,
    archivos: {
      informe: 'informe.md', casos: 'casos.json', publicar: acum.fotos.length ? 'publicar/' : null,
      recetasCandidatas: existsSync(join(base, 'recetas-candidatas.md')) ? 'recetas-candidatas.md' : null,
    },
  }
  writeFileSync(join(base, 'manifest.json'), JSON.stringify(m, null, 2) + '\n')
}

export function escribirInforme(page: Page): void {
  const e = estado(page)
  const base = e.base
  const json = join(base, 'casos.json')
  let acum: Acumulado = { casos: [], cambios: [], fotos: [] }
  if (existsSync(json)) { try { acum = { fotos: [], ...(JSON.parse(readFileSync(json, 'utf8')) as Partial<Acumulado>) } as Acumulado } catch { /* se rehace */ } }
  const rel = (p: string | undefined): string => (p ? p.replace(base, '.').replaceAll('\\', '/') : '')
  for (const f of e.fotos) {
    const n = { ...f, ruta: rel(f.ruta) }
    const i = acum.fotos.findIndex((x) => x.ruta === n.ruta)
    if (i >= 0) acum.fotos[i] = n; else acum.fotos.push(n)
  }
  const registradas = new Set(acum.fotos.map((f) => f.ruta))
  const sueltas = pngsSueltos(base).map((p) => rel(p)).filter((r) => !registradas.has(r))
  if (sueltas.length) console.error(`AVISO: ${sueltas.length} captura(s) sin leyenda ni marca registrada (no pasaron por foto()): ${sueltas.join(', ')} — no suben a publicar/`)
  if (!e.casos.length && acum.fotos.length) console.error('AVISO: hay capturas pero ningún caso() en esta corrida; el informe no las registra')
  const pub = join(base, 'publicar')
  if (acum.fotos.length) mkdirSync(pub, { recursive: true })
  for (const f of acum.fotos) {
    const origen = join(base, f.ruta)
    if (existsSync(origen)) copyFileSync(origen, join(pub, f.ruta.replace(/^\.\//, '').replaceAll('/', '__')))
  }
  for (const c of e.casos) {
    const n = { ...c, captura: rel(c.captura) }
    const i = acum.casos.findIndex((x) => x.nombre === n.nombre)
    if (i >= 0) acum.casos[i] = n; else acum.casos.push(n)
  }
  for (const c of e.cambios) {
    const i = acum.cambios.findIndex((x) => x.que === c.que)
    if (i >= 0) acum.cambios[i] = c; else acum.cambios.push(c)
  }
  const rr = e.recetasResumen
  if (rr) {
    const u = (a: string[] | undefined, b: string[]): string[] => [...new Set([...(a || []), ...b])]
    acum.recetas = { usadas: u(acum.recetas?.usadas, rr.usadas), creadas: u(acum.recetas?.creadas, rr.creadas), ninguna: u(acum.recetas?.ninguna, rr.ninguna ? [rr.ninguna] : []), pendiente: rr.pendiente }
  }
  acum.errores5xx = e.errores5xx
  if (!acum.casos.length && !acum.cambios.length && !acum.fotos.length) return
  writeFileSync(json, JSON.stringify(acum, null, 2))
  const L = [`# ${e.id}: verificación en navegador`, '', `Actualizado: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`, '']
  if (acum.casos.length) {
    L.push('| Caso | Esperado | Observado | Resultado | Captura |', '|---|---|---|---|---|')
    for (const c of acum.casos) L.push(`| ${c.nombre} | ${c.esperado} | ${c.observado} | ${c.ok ? 'OK' : 'FALLA'} | ${c.captura || ''} |`)
    L.push('')
  }
  if (acum.cambios.length) {
    L.push('## Cambios hechos en los datos', '', '| Qué | Cómo revertir | Revertido |', '|---|---|---|')
    for (const c of acum.cambios) L.push(`| ${c.que} | ${c.revertir || ''} | ${c.revertido ? 'sí' : 'no'} |`)
    L.push('')
  }
  if (acum.fotos.length) {
    L.push('## Capturas (a subir desde `publicar/`)', '', '| Paso | Leyenda | Marca | Archivo |', '|---|---|---|---|')
    for (const f of acum.fotos) L.push(`| ${f.paso} | ${f.leyenda} | ${f.marcada ? 'roja' : `sin marca (${f.sinMarca})`} | ${f.ruta} |`)
    L.push('')
  }
  if (acum.recetas) {
    const r = acum.recetas
    L.push('## Recetas', '', `- Usadas: ${r.usadas.join(', ') || 'ninguna'}`, `- Creadas: ${r.creadas.join(', ') || 'ninguna'}${r.ninguna.length ? ` (${r.ninguna.join('; ')})` : ''}`)
    if (r.pendiente) L.push('- **INCOMPLETO: hubo tramos sin receta y no se declaró qué hacer (ver recetas-candidatas.md).**')
    L.push('')
  }
  if (sueltas.length) L.push('## Capturas sin registrar (no se suben)', '', ...sueltas.map((s) => `- ${s}`), '')
  if (e.errores5xx.length) {
    L.push('## Errores del servidor (última corrida)', '', 'La app respondió 5xx: es un problema de la app o de su entorno, no de la prueba.', '',
      '| Status | Petición | Durante |', '|---|---|---|')
    for (const x of e.errores5xx) L.push(`| ${x.status} | ${x.metodo} ${x.url} | ${x.paso} |`)
    L.push('')
  }
  writeFileSync(join(base, 'informe.md'), L.join('\n'))
  escribirManifest(base, e.id, acum, sueltas)
  console.log(`informe: ${join(base, 'informe.md')} (${acum.casos.length} casos, ${acum.fotos.length} capturas)`)
}
