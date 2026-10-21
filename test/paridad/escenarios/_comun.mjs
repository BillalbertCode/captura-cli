// Base de los escenarios: carga la implementación del descriptor, levanta el sitio local y registra la app "zz".
import { pathToFileURL } from 'node:url'
import { appZZ } from '../../sitio.mjs'

export { sitio } from '../../sitio.mjs'
export const impl = (await import(pathToFileURL(process.env.CAPTURA_IMPL).href)).default
export const C = await import(impl.modulo)
// id(n): fijo (las salidas se acumulan por id). id(n, true): único por corrida, para comprobar nombres stepNN exactos.
export const id = (n, unico = false) => impl.id(n, unico ? String(Date.now() % 1e8) : '')
export const USUARIO = 'A12345678'
export const CLAVE = 'clave-de-prueba'

export function conCredenciales(rol = 'zz') {
  Object.assign(process.env, impl.envCredenciales(rol, USUARIO, CLAVE))
}

export function registrarApp(baseUrl, nombre = 'zz') {
  C.apps[nombre] = appZZ(baseUrl)
}

// Una falla esperada: imprime "ok rechaza <nombre>: <mensaje>" o "ERROR_ESPERADO_NO_OCURRIO <nombre>".
export async function rechaza(nombre, fn) {
  try { await fn(); console.log(`ERROR_ESPERADO_NO_OCURRIO ${nombre}`) } catch (e) { console.log(`ok rechaza ${nombre}: ${String(e.message).split('\n')[0].slice(0, 400)}`) }
}
