// captura.config.json del proyecto. Toda clave es opcional y su valor por defecto es neutro: ningún prefijo,
// patrón ni nombre de un proyecto concreto. Lo propio de cada proyecto lo declara su config y sus adaptadores.
// Una clave desconocida es un error con la corrección sugerida (un typo no se ignora en silencio).
// Referencia completa: docs/configuracion.md. Esquema para el editor: schema/captura.config.schema.json.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { AppConfig } from './adaptadores/contrato.js'

export type RefAdaptador = string | ({ usa: string } & Record<string, unknown>)
export type Extra = 'correo'
export const EXTRAS: readonly Extra[] = ['correo']

export interface Config {
  viewport: { width: number; height: number }
  sesionMin: number
  apps: Record<string, AppConfig>
  id: { patron: string; mayusculas: boolean }
  credenciales: { archivo: string; prefijo: string; alias: Record<string, string> }
  rutas: { salidas?: string; recetas?: string; helpers?: string; escenarios?: string; sesiones?: string }
  adaptadores: Partial<Record<'credenciales' | 'identificador' | 'entorno' | 'publicacion' | 'correo', RefAdaptador>>
  extras: Extra[]
  /** Hook de cierre del plugin: exige evidencia si en el turno se tocó la interfaz. Apagado por defecto. */
  evidencia: { hook: boolean; patrones: string[]; horas: number }
}

export const DEFECTO: Config = {
  viewport: { width: 1366, height: 900 },
  sesionMin: 15,
  apps: {},
  id: { patron: '^[A-Za-z0-9._-]+$', mayusculas: true },
  credenciales: { archivo: '.env', prefijo: 'CAPTURA_', alias: {} },
  rutas: {},
  adaptadores: {},
  extras: [],
  evidencia: { hook: false, patrones: ['**/*.tsx', '**/*.jsx', '**/*.vue', '**/*.svelte', '**/*.html', '**/*.css', '**/*.scss'], horas: 12 },
}

export class ConfigInvalida extends Error {}

const CLAVES_RAIZ = ['$schema', 'viewport', 'sesionMin', 'apps', 'id', 'credenciales', 'rutas', 'adaptadores', 'extras', 'evidencia'] as const
const CLAVES: Record<string, readonly string[]> = {
  evidencia: ['hook', 'patrones', 'horas'],
  viewport: ['width', 'height'],
  id: ['patron', 'mayusculas'],
  credenciales: ['archivo', 'prefijo', 'alias'],
  rutas: ['salidas', 'recetas', 'helpers', 'escenarios', 'sesiones'],
  adaptadores: ['credenciales', 'identificador', 'entorno', 'publicacion', 'correo'],
}
/** Claves de la herramienta original o errores comunes: qué usar en su lugar. */
const SUGERENCIAS: Record<string, string> = {
  salida: 'usar "rutas": { "salidas": "…" } (o dejarlo vacío: el almacén global del workspace)',
  playwrightDesde: 'quitarla: Playwright viene incluido en captura-cli',
  ticket: 'el id se pasa al abrir (abrir({ ticket }) o --id); el formato va en "id": { "patron": "…" }',
  slot: 'el slot se elige por corrida: CAPTURA_SLOT=N|auto o --slot',
  stack: 'va dentro de la configuración del adaptador de entorno ("adaptadores": { "entorno": { "usa": …, … } })',
  recetas: 'usar "rutas": { "recetas": "…" }',
}
const CLAVES_APP = ['baseUrl', 'login', 'campoUsuario', 'campoClave', 'campos', 'boton', 'postLogin', 'inicio', 'cookieSesion', 'apiBase']
const VALORES_CAMPO = ['usuario', 'clave', 'letra', 'numero']

const esObjeto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const texto = (x: unknown): x is string => typeof x === 'string' && x.trim() !== ''

function exigir(cond: boolean, archivo: string, clave: string, forma: string): asserts cond {
  if (!cond) throw new ConfigInvalida(`CONFIG_INVALIDA: ${archivo}: "${clave}" debe ser ${forma}`)
}

/** Distancia de edición (para sugerir la clave correcta ante un typo). */
function distancia(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0]![j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }
  return d[a.length]![b.length]!
}

function sinDesconocidas(o: Record<string, unknown>, validas: readonly string[], archivo: string, prefijo: string): void {
  for (const k of Object.keys(o)) {
    if (validas.includes(k)) continue
    const ruta = prefijo ? `${prefijo}.${k}` : k
    const sug = (!prefijo && SUGERENCIAS[k]) || (() => {
      const cerca = validas.filter((v) => distancia(v.toLowerCase(), k.toLowerCase()) <= 2)
      return cerca.length ? `¿quisiste decir "${prefijo ? `${prefijo}.` : ''}${cerca[0]}"?` : `claves válidas: ${validas.join(', ')}`
    })()
    throw new ConfigInvalida(`CONFIG_INVALIDA: ${archivo}: clave desconocida "${ruta}": ${sug}`)
  }
}

function validarApp(n: string, a: unknown, archivo: string): AppConfig {
  const p = `apps.${n}`
  exigir(esObjeto(a), archivo, p, 'un objeto { baseUrl, login, boton, postLogin, … }')
  exigir(typeof a['baseUrl'] === 'string' && /^https?:\/\/[^/]+/.test(a['baseUrl']), archivo, `${p}.baseUrl`, 'una URL http(s)://host[:puerto]')
  for (const k of ['login', 'boton', 'postLogin'] as const) exigir(typeof a[k] === 'string' && a[k] !== '', archivo, `${p}.${k}`, 'un texto no vacío')
  for (const k of ['campoUsuario', 'campoClave', 'inicio', 'apiBase'] as const) exigir(a[k] === undefined || typeof a[k] === 'string', archivo, `${p}.${k}`, 'un texto')
  exigir(a['cookieSesion'] === undefined || a['cookieSesion'] === null || typeof a['cookieSesion'] === 'string', archivo, `${p}.cookieSesion`, 'el nombre de una cookie o null')
  if (a['campos'] !== undefined) {
    const cs = a['campos']
    exigir(Array.isArray(cs) && cs.length > 0, archivo, `${p}.campos`, 'una lista [{ "selector": "…", "valor": "usuario|clave|letra|numero" }]')
    cs.forEach((c: unknown, i: number) => {
      exigir(esObjeto(c) && typeof c['selector'] === 'string' && VALORES_CAMPO.includes(String(c['valor'])), archivo, `${p}.campos[${i}]`, `{ "selector": "…", "valor": ${VALORES_CAMPO.join('|')} }`)
    })
  } else {
    exigir(typeof a['campoUsuario'] === 'string' && typeof a['campoClave'] === 'string', archivo, `${p}.campoUsuario/campoClave`, 'selectores de texto (o declarar "campos")')
  }
  // Claves extra (p. ej. datos para un adaptador propio) se permiten dentro de una app; se avisan para detectar typos.
  for (const k of Object.keys(a)) {
    if (CLAVES_APP.includes(k)) continue
    const cerca = CLAVES_APP.find((v) => distancia(v.toLowerCase(), k.toLowerCase()) <= 2)
    if (cerca) throw new ConfigInvalida(`CONFIG_INVALIDA: ${archivo}: clave desconocida "${p}.${k}": ¿quisiste decir "${p}.${cerca}"?`)
  }
  return a as AppConfig
}

/** Mezcla el JSON del proyecto sobre los valores por defecto, validando la forma de cada clave. */
export function normalizar(crudo: unknown, archivo: string): Config {
  exigir(esObjeto(crudo), archivo, '(raíz)', 'un objeto')
  const c = crudo
  sinDesconocidas(c, CLAVES_RAIZ, archivo, '')
  for (const [k, validas] of Object.entries(CLAVES)) if (esObjeto(c[k])) sinDesconocidas(c[k], validas, archivo, k)

  const v = c['viewport'] ?? DEFECTO.viewport
  exigir(esObjeto(v) && Number.isInteger(v['width']) && Number.isInteger(v['height']) && (v['width'] as number) > 0 && (v['height'] as number) > 0, archivo, 'viewport', '{ "width": n, "height": n } (enteros positivos)')
  const sesionMin = c['sesionMin'] ?? DEFECTO.sesionMin
  exigir(typeof sesionMin === 'number' && sesionMin >= 0, archivo, 'sesionMin', 'un número de minutos (0 = no reutilizar)')
  const appsCrudo = c['apps'] ?? {}
  exigir(esObjeto(appsCrudo), archivo, 'apps', 'un objeto { nombre: { baseUrl, login, … } }')
  const apps: Record<string, AppConfig> = {}
  for (const [n, a] of Object.entries(appsCrudo)) apps[n] = validarApp(n, a, archivo)

  const id = c['id'] ?? {}
  exigir(esObjeto(id), archivo, 'id', '{ "patron": "regex", "mayusculas": bool }')
  const patron = id['patron'] ?? DEFECTO.id.patron
  exigir(typeof patron === 'string', archivo, 'id.patron', 'una expresión regular en texto')
  try { new RegExp(patron) } catch { exigir(false, archivo, 'id.patron', 'una expresión regular válida') }
  const mayusculas = id['mayusculas'] ?? DEFECTO.id.mayusculas
  exigir(typeof mayusculas === 'boolean', archivo, 'id.mayusculas', 'true o false')

  const cr = c['credenciales'] ?? {}
  exigir(esObjeto(cr), archivo, 'credenciales', '{ "archivo", "prefijo", "alias" }')
  for (const k of ['archivo', 'prefijo'] as const) exigir(cr[k] === undefined || typeof cr[k] === 'string', archivo, `credenciales.${k}`, 'un texto')
  const alias = cr['alias'] ?? {}
  exigir(esObjeto(alias) && Object.values(alias).every((x) => typeof x === 'string' && /^[A-Z0-9_]+$/.test(x)), archivo, 'credenciales.alias', '{ "rol": "NOMBRE" } (NOMBRE en mayúsculas, dígitos o _)')

  const rutas = c['rutas'] ?? {}
  exigir(esObjeto(rutas) && Object.values(rutas).every((x) => typeof x === 'string' && x !== ''), archivo, 'rutas', '{ "recetas": "ruta", … } (textos no vacíos)')

  const ad = c['adaptadores'] ?? {}
  exigir(esObjeto(ad), archivo, 'adaptadores', '{ "tipo": "builtin:nombre" | "./ruta.mjs" | { "usa": … } }')
  for (const [t, r] of Object.entries(ad)) {
    exigir(typeof r === 'string' || (esObjeto(r) && typeof r['usa'] === 'string'), archivo, `adaptadores.${t}`, '"builtin:nombre", "./ruta.mjs" o { "usa": … }')
  }

  const extras = c['extras'] ?? []
  exigir(Array.isArray(extras) && extras.every((x) => EXTRAS.includes(x as Extra)), archivo, 'extras', `una lista con: ${EXTRAS.join(', ')}`)

  const ev = c['evidencia'] ?? {}
  exigir(esObjeto(ev), archivo, 'evidencia', '{ "hook": bool, "patrones": ["**/*.tsx", …], "horas": n }')
  const hook = ev['hook'] ?? DEFECTO.evidencia.hook
  exigir(typeof hook === 'boolean', archivo, 'evidencia.hook', 'true o false')
  const patrones = ev['patrones'] ?? DEFECTO.evidencia.patrones
  exigir(Array.isArray(patrones) && patrones.length > 0 && patrones.every(texto), archivo, 'evidencia.patrones', 'una lista de globs (p. ej. "src/**/*.tsx")')
  const horas = ev['horas'] ?? DEFECTO.evidencia.horas
  exigir(typeof horas === 'number' && horas > 0, archivo, 'evidencia.horas', 'horas hacia atrás para los commits del turno (número positivo)')

  return {
    viewport: { width: v['width'] as number, height: v['height'] as number },
    sesionMin,
    apps,
    id: { patron, mayusculas },
    credenciales: {
      archivo: typeof cr['archivo'] === 'string' ? cr['archivo'] : DEFECTO.credenciales.archivo,
      prefijo: typeof cr['prefijo'] === 'string' ? cr['prefijo'] : DEFECTO.credenciales.prefijo,
      alias: alias as Record<string, string>,
    },
    rutas: rutas as Config['rutas'],
    adaptadores: ad as Config['adaptadores'],
    extras: [...new Set(extras as Extra[])],
    evidencia: { hook, patrones: patrones as string[], horas },
  }
}

/** Lee el config si existe; sin archivo, los valores por defecto. `base` es la carpeta para resolver rutas. */
export function leerConfig(archivo: string | null): { cfg: Config; base: string | null } {
  if (!archivo || !existsSync(archivo)) return { cfg: normalizar({}, '(sin config)'), base: null }
  let crudo: unknown
  try { crudo = JSON.parse(readFileSync(archivo, 'utf8').replace(/^﻿/, '')) } catch (e) {
    throw new ConfigInvalida(`CONFIG_INVALIDA: ${archivo}: no es JSON válido (${(e as Error).message})`)
  }
  return { cfg: normalizar(crudo, archivo), base: dirname(resolve(archivo)) }
}
