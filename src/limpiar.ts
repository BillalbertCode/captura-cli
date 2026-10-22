// `captura-cli limpiar`: residuos del almacén. Por defecto solo LISTA (simulación); con --aplicar borra.
// Solo dentro del almacén del workspace (~/.captura-cli/workspaces/<nombre>-<hash>/), archivo por archivo desde un
// listado, comprobando cada ruta; las carpetas que quedan vacías se quitan una por una. Nunca un borrado recursivo
// sobre una ruta que pase el usuario. Las capturas no se borran solas: solo con --antes <N>d.
import { existsSync, lstatSync, readdirSync, readFileSync, rmdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { dentroDe } from './almacen.js'

export const DIAS_CACHE = 14
const DIA = 86400000

export interface Grupo { nombre: string; motivo: string; archivos: Array<{ ruta: string; bytes: number }>; carpetas: string[] }

/** Archivos (no enlaces) bajo una carpeta, con su tamaño y fecha. */
function archivos(dir: string): Array<{ ruta: string; bytes: number; mtime: number }> {
  const out: Array<{ ruta: string; bytes: number; mtime: number }> = []
  if (!existsSync(dir)) return out
  const pila = [dir]
  while (pila.length) {
    const d = pila.pop()!
    let es
    try { es = readdirSync(d, { withFileTypes: true }) } catch { continue }
    for (const e of es) {
      const f = join(d, e.name)
      if (e.isSymbolicLink()) continue // un enlace nunca se sigue ni se borra
      if (e.isDirectory()) pila.push(f)
      else if (e.isFile()) { try { const s = lstatSync(f); out.push({ ruta: f, bytes: s.size, mtime: s.mtimeMs }) } catch { /* desapareció */ } }
    }
  }
  return out
}

const vivo = (pid: number): boolean => { try { process.kill(pid, 0); return true } catch { return false } }
const slots = (dirWs: string): string[] => {
  const d = join(dirWs, 'slots')
  return existsSync(d) ? readdirSync(d).map((s) => join(d, s)) : []
}

export interface OpcionesLimpiar { dirWs: string; salidas: string; antesDias?: number; ahora?: number; corridaActual?: string }

/** Arma el listado de lo que se borraría, por grupo. No toca nada. */
export function planificar(o: OpcionesLimpiar): { grupos: Grupo[]; avisos: string[] } {
  const ahora = o.ahora ?? Date.now()
  const grupos: Grupo[] = []
  const avisos: string[] = []
  const grupo = (nombre: string, motivo: string): Grupo => { const g: Grupo = { nombre, motivo, archivos: [], carpetas: [] }; grupos.push(g); return g }

  // 1) Temporales de corridas que ya terminaron (las de un proceso vivo se dejan).
  const tmp = grupo('temporales', 'carpetas tmp/ de corridas terminadas (deberían haberse borrado solas)')
  for (const s of slots(o.dirWs)) {
    const t = join(s, 'tmp')
    if (!existsSync(t)) continue
    for (const c of readdirSync(t)) {
      if (c === o.corridaActual) continue
      const pid = Number(c.split('-').at(-1))
      if (pid && vivo(pid)) continue
      tmp.carpetas.push(join(t, c))
      tmp.archivos.push(...archivos(join(t, c)))
    }
  }
  // 2) Caché vieja (caduca sola a los 14 días).
  const cache = grupo('caché', `archivos de caché sin tocar hace más de ${DIAS_CACHE} días`)
  for (const s of slots(o.dirWs)) for (const f of archivos(join(s, 'cache'))) if (ahora - f.mtime > DIAS_CACHE * DIA) cache.archivos.push(f)
  // 3) Sesiones guardadas vencidas (más de un día): tienen cookies de usuarios reales y ya no sirven.
  const ses = grupo('sesiones', 'sesiones guardadas de más de 1 día (vencidas; tienen cookies)')
  for (const s of slots(o.dirWs)) for (const f of archivos(join(s, 'sesiones'))) if (ahora - f.mtime > DIA) ses.archivos.push(f)
  // 4) Marcas de slot de procesos que ya no existen.
  const marcas = grupo('marcas de slot', 'ocupado.json de corridas que ya terminaron')
  for (const s of slots(o.dirWs)) {
    const f = join(s, 'ocupado.json')
    if (!existsSync(f)) continue
    let pid = 0
    try { pid = (JSON.parse(readFileSync(f, 'utf8')) as { pid: number }).pid } catch { /* ilegible: se borra */ }
    if (!pid || !vivo(pid)) marcas.archivos.push(...archivos(s).filter((x) => x.ruta === f))
  }
  // 5) Capturas viejas: solo si se pidió (--antes), y solo si están dentro del almacén.
  if (o.antesDias !== undefined) {
    const cap = grupo('capturas', `ids sin cambios hace más de ${o.antesDias} días (incluye informe y publicar/)`)
    if (!dentroDe(o.dirWs, o.salidas)) avisos.push(`capturas: ${o.salidas} está fuera del almacén; limpiar no la toca (borrarla a mano si hace falta)`)
    else if (existsSync(o.salidas)) {
      for (const d of readdirSync(o.salidas, { withFileTypes: true })) {
        if (!d.isDirectory() || d.isSymbolicLink()) continue
        const dir = join(o.salidas, d.name)
        const fs = archivos(dir)
        const ultimo = Math.max(0, ...fs.map((x) => x.mtime))
        if (ahora - ultimo <= o.antesDias * DIA) continue
        cap.carpetas.push(dir)
        cap.archivos.push(...fs)
      }
    }
  }
  return { grupos: grupos.filter((g) => g.archivos.length || g.carpetas.length), avisos }
}

/** Borra el listado: cada archivo comprobado dentro del almacén; después, las carpetas que quedaron vacías. */
export function aplicar(dirWs: string, grupos: Grupo[]): { borrados: number; bytes: number; errores: string[] } {
  let borrados = 0, bytes = 0
  const errores: string[] = []
  for (const g of grupos) {
    for (const f of g.archivos) {
      if (!dentroDe(dirWs, f.ruta) || f.ruta === dirWs) { errores.push(`fuera del almacén, no se toca: ${f.ruta}`); continue }
      try {
        if (lstatSync(f.ruta).isSymbolicLink()) continue
        unlinkSync(f.ruta)
        borrados++
        bytes += f.bytes
      } catch (e) { errores.push(`${f.ruta}: ${(e as Error).message}`) }
    }
    // Carpetas vacías, de la más profunda a la menos profunda; rmdir falla si no está vacía (y eso está bien).
    for (const c of g.carpetas) {
      if (!dentroDe(dirWs, c) || c === dirWs) continue
      const dirs: string[] = []
      const pila = [c]
      while (pila.length) {
        const d = pila.pop()!
        dirs.push(d)
        try { for (const e of readdirSync(d, { withFileTypes: true })) if (e.isDirectory() && !e.isSymbolicLink()) pila.push(join(d, e.name)) } catch { /* ya no está */ }
      }
      for (const d of dirs.reverse()) { try { rmdirSync(d) } catch { /* no vacía o ya no está */ } }
    }
  }
  return { borrados, bytes, errores }
}

/** Vence la caché de un slot (más de 14 días). La usa `entorno levantar` para que la caché caduque sola. */
export function expirarCache(dirWs: string, dirSlot: string, ahora = Date.now()): { borrados: number; bytes: number } {
  const g: Grupo = { nombre: 'caché', motivo: '', carpetas: [], archivos: archivos(join(dirSlot, 'cache')).filter((f) => ahora - f.mtime > DIAS_CACHE * DIA) }
  const r = aplicar(dirWs, [g])
  return { borrados: r.borrados, bytes: r.bytes }
}

const mb = (b: number): string => (b >= 1 << 20 ? `${(b / (1 << 20)).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`)

export function formatearPlan(grupos: Grupo[], avisos: string[], aplicado: boolean): string {
  const L: string[] = []
  let total = 0, n = 0
  for (const g of grupos) {
    const b = g.archivos.reduce((s, f) => s + f.bytes, 0)
    total += b
    n += g.archivos.length
    L.push(`${g.nombre}: ${g.archivos.length} archivo(s), ${mb(b)}${g.carpetas.length ? ` en ${g.carpetas.length} carpeta(s)` : ''} — ${g.motivo}`)
    for (const c of g.carpetas.slice(0, 5)) L.push(`  ${c}`)
    if (g.carpetas.length > 5) L.push(`  … y ${g.carpetas.length - 5} más`)
  }
  for (const a of avisos) L.push(`AVISO: ${a}`)
  if (!grupos.length) L.push('nada que limpiar')
  else L.push(aplicado ? `total: ${n} archivo(s), ${mb(total)}` : `total: ${n} archivo(s), ${mb(total)} (simulación: no se borró nada; repetir con --aplicar)`)
  return L.join('\n')
}
