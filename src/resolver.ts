// Hook de resolución de módulos (lo carga `captura-cli script` con node:module.register, en otro hilo).
// Con la herramienta instalada en global, `import … from 'captura-cli'` no se resuelve (los paquetes globales no
// están en el camino de resolución de ESM). Este hook deja que Node resuelva primero como siempre —si el proyecto
// tiene su propia copia de captura-cli, esa gana— y solo si NO encuentra el paquete usa esta instalación.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

interface ContextoResolucion { conditions: string[]; importAttributes: Record<string, string>; parentURL?: string }
interface Resultado { url: string; format?: string; shortCircuit?: boolean }
type Siguiente = (especificador: string, contexto: ContextoResolucion) => Promise<Resultado>

let destinos: Record<string, string> = {}


/** `raiz` es la carpeta del paquete instalado (la que tiene package.json y dist/). */
export function initialize(datos: { raiz: string }): void {
  const pkg = JSON.parse(readFileSync(join(datos.raiz, 'package.json'), 'utf8')) as { name: string; exports?: Record<string, string | { import?: string }> }
  destinos = {}
  for (const [clave, valor] of Object.entries(pkg.exports ?? {})) {
    if (clave === './package.json') continue
    const destino = typeof valor === 'string' ? valor : valor.import
    if (destino) destinos[clave === '.' ? pkg.name : `${pkg.name}${clave.slice(1)}`] = pathToFileURL(join(datos.raiz, destino)).href
  }
}

export async function resolve(especificador: string, contexto: ContextoResolucion, siguiente: Siguiente): Promise<Resultado> {
  try {
    return await siguiente(especificador, contexto)
  } catch (e) {
    const url = destinos[especificador]
    if (url && (e as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND') return { url, format: 'module', shortCircuit: true }
    throw e
  }
}
