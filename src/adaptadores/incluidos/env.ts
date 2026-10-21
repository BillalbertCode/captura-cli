// builtin:env — credenciales desde un archivo .env y del entorno del proceso (que manda sobre el archivo).
// Rol abierto: <PREFIJO><ROL>_USUARIO + <PREFIJO><ROL>_CLAVE (ROL en mayúsculas, sin acentos, _ por separadores).
// Alias opcionales: { "rol": "NOMBRE" } usa <PREFIJO>NOMBRE_*. Opciones: archivo, prefijo, alias.
import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import type { AdaptadorCredenciales, ContextoAdaptador, Fabrica } from '../contrato.js'

export const normalizarRol = (rol: string): string =>
  rol.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_')

export function leerDotenv(archivo: string): Record<string, string> {
  const env: Record<string, string> = {}
  if (!existsSync(archivo)) return env
  for (const l of readFileSync(archivo, 'utf8').split(/\r?\n/)) {
    if (l.trim().startsWith('#')) continue
    const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m?.[1] !== undefined && m[2] !== undefined) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
  return env
}

const texto = (x: unknown, d: string): string => (typeof x === 'string' ? x : d)

const fabrica: Fabrica<'credenciales'> = {
  contrato: 1,
  tipo: 'credenciales',
  crear(opciones, contexto: ContextoAdaptador): AdaptadorCredenciales {
    const archivo = texto(opciones['archivo'], '.env')
    const ruta = isAbsolute(archivo) ? archivo : join(contexto.base, archivo)
    const prefijo = texto(opciones['prefijo'], 'CAPTURA_')
    const alias: Record<string, string> = {}
    const crudo = opciones['alias']
    if (crudo && typeof crudo === 'object') {
      for (const [k, v] of Object.entries(crudo)) if (typeof v === 'string') alias[normalizarRol(k)] = v
    }
    return {
      resolver(rol) {
        const env = leerDotenv(ruta)
        for (const [k, v] of Object.entries(process.env)) if (k.startsWith(prefijo) && v) env[k] = v
        const R = normalizarRol(rol)
        const p = alias[R] ?? R
        const vu = `${prefijo}${p}_USUARIO`, vc = `${prefijo}${p}_CLAVE`
        const usuario = env[vu], clave = env[vc]
        const faltan = [...(usuario ? [] : [vu]), ...(clave ? [] : [vc])]
        if (!usuario || !clave) return { faltan, donde: archivo }
        // letra/número: para logins con el documento partido. A-12345 / A12345 -> letra A, numero 12345
        return { usuario, clave, letra: usuario.match(/^[A-Za-z]/)?.[0] ?? '', numero: usuario.replace(/^[A-Za-z]-?/, '') }
      },
    }
  },
}
export default fabrica
