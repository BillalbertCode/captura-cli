// captura.config.json del proyecto. Toda clave es opcional y su valor por defecto es neutro: ningún prefijo,
// patrón ni nombre de un proyecto concreto. Lo propio de cada proyecto lo declara su config y sus adaptadores.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { AppConfig } from './adaptadores/contrato.js'

export type RefAdaptador = string | ({ usa: string } & Record<string, unknown>)

export interface Config {
  viewport: { width: number; height: number }
  sesionMin: number
  apps: Record<string, AppConfig>
  id: { patron: string; mayusculas: boolean }
  credenciales: { archivo: string; prefijo: string; alias: Record<string, string> }
  rutas: { salidas?: string; recetas?: string; helpers?: string; escenarios?: string }
  adaptadores: Partial<Record<'credenciales' | 'identificador' | 'entorno' | 'publicacion' | 'correo', RefAdaptador>>
}

export const DEFECTO: Config = {
  viewport: { width: 1366, height: 900 },
  sesionMin: 15,
  apps: {},
  id: { patron: '^[A-Za-z0-9._-]+$', mayusculas: true },
  credenciales: { archivo: '.env', prefijo: 'CAPTURA_', alias: {} },
  rutas: {},
  adaptadores: {},
}

export class ConfigInvalida extends Error {}

const esObjeto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

function exigir(cond: boolean, archivo: string, clave: string, forma: string): void {
  if (!cond) throw new ConfigInvalida(`CONFIG_INVALIDA: ${archivo}: "${clave}" debe ser ${forma}`)
}

/** Mezcla el JSON del proyecto sobre los valores por defecto, validando la forma de cada clave conocida. */
export function normalizar(crudo: unknown, archivo: string): Config {
  exigir(esObjeto(crudo), archivo, '(raíz)', 'un objeto')
  const c = crudo as Record<string, unknown>
  const v = c['viewport'] ?? DEFECTO.viewport
  exigir(esObjeto(v) && typeof v['width'] === 'number' && typeof v['height'] === 'number', archivo, 'viewport', '{ "width": n, "height": n }')
  const sesionMin = c['sesionMin'] ?? DEFECTO.sesionMin
  exigir(typeof sesionMin === 'number' && sesionMin >= 0, archivo, 'sesionMin', 'un número de minutos')
  const apps = c['apps'] ?? {}
  exigir(esObjeto(apps), archivo, 'apps', 'un objeto { nombre: { baseUrl, login, … } }')
  for (const [n, a] of Object.entries(apps as Record<string, unknown>)) {
    exigir(esObjeto(a) && typeof a['baseUrl'] === 'string', archivo, `apps.${n}.baseUrl`, 'una URL')
  }
  const id = c['id'] ?? {}
  exigir(esObjeto(id), archivo, 'id', '{ "patron": "regex", "mayusculas": bool }')
  const idObj = id as Record<string, unknown>
  const patron = idObj['patron'] ?? DEFECTO.id.patron
  exigir(typeof patron === 'string', archivo, 'id.patron', 'una expresión regular en texto')
  try { new RegExp(patron as string) } catch { exigir(false, archivo, 'id.patron', 'una expresión regular válida') }
  const mayusculas = idObj['mayusculas'] ?? DEFECTO.id.mayusculas
  exigir(typeof mayusculas === 'boolean', archivo, 'id.mayusculas', 'true o false')
  const cr = c['credenciales'] ?? {}
  exigir(esObjeto(cr), archivo, 'credenciales', '{ "archivo", "prefijo", "alias" }')
  const crObj = cr as Record<string, unknown>
  const alias = crObj['alias'] ?? {}
  exigir(esObjeto(alias) && Object.values(alias).every((x) => typeof x === 'string'), archivo, 'credenciales.alias', '{ "rol": "NOMBRE" }')
  const rutas = c['rutas'] ?? {}
  exigir(esObjeto(rutas) && Object.values(rutas).every((x) => typeof x === 'string'), archivo, 'rutas', '{ "recetas": "ruta", … }')
  const ad = c['adaptadores'] ?? {}
  exigir(esObjeto(ad), archivo, 'adaptadores', '{ "tipo": "builtin:nombre" | "./ruta.mjs" | { "usa": … } }')
  for (const [t, r] of Object.entries(ad as Record<string, unknown>)) {
    exigir(typeof r === 'string' || (esObjeto(r) && typeof r['usa'] === 'string'), archivo, `adaptadores.${t}`, '"builtin:nombre", "./ruta.mjs" o { "usa": … }')
  }
  return {
    viewport: v as Config['viewport'],
    sesionMin: sesionMin as number,
    apps: apps as Record<string, AppConfig>,
    id: { patron: patron as string, mayusculas: mayusculas as boolean },
    credenciales: {
      archivo: typeof crObj['archivo'] === 'string' ? crObj['archivo'] : DEFECTO.credenciales.archivo,
      prefijo: typeof crObj['prefijo'] === 'string' ? crObj['prefijo'] : DEFECTO.credenciales.prefijo,
      alias: alias as Record<string, string>,
    },
    rutas: rutas as Config['rutas'],
    adaptadores: ad as Config['adaptadores'],
  }
}

/** Lee el config si existe; sin archivo, los valores por defecto. `base` es la carpeta para resolver rutas. */
export function leerConfig(archivo: string | null): { cfg: Config; base: string | null } {
  if (!archivo || !existsSync(archivo)) return { cfg: normalizar({}, '(sin config)'), base: null }
  let crudo: unknown
  try { crudo = JSON.parse(readFileSync(archivo, 'utf8')) } catch (e) {
    throw new ConfigInvalida(`CONFIG_INVALIDA: ${archivo}: no es JSON válido (${(e as Error).message})`)
  }
  return { cfg: normalizar(crudo, archivo), base: dirname(resolve(archivo)) }
}
