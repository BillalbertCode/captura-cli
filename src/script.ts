// `captura-cli script <archivo.mjs> [args…]`: corre un script que usa la API de código en ESTE proceso, con el nombre
// `captura-cli` resuelto a esta instalación (ver resolver.ts). Así los ejemplos `import … from 'captura-cli'`
// funcionan con la herramienta instalada en global, sin tocar el proyecto ni crear enlaces. Al ser el mismo proceso,
// el tope de tiempo, las señales, el cierre del navegador y el código de salida son los de siempre.
import { existsSync } from 'node:fs'
import { register } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { CODIGOS, salir } from './salida.js'

export async function ejecutarScript(archivo: string, args: string[]): Promise<number> {
  const f = resolve(archivo)
  if (!existsSync(f)) return salir(`script: no existe ${f}`, CODIGOS.ERROR)
  const raiz = fileURLToPath(new URL('..', import.meta.url)) // la carpeta del paquete (dist/..)
  register(new URL('./resolver.js', import.meta.url), { parentURL: import.meta.url, data: { raiz } })
  // El script ve sus propios argumentos, como con `node script.mjs a b`.
  process.argv = [process.argv[0] ?? 'node', f, ...args]
  await import(pathToFileURL(f).href)
  return typeof process.exitCode === 'number' ? process.exitCode : CODIGOS.OK
}
