// `prepare` tolerante. npm lo corre al instalar desde git (también en global) y con `npm install` en el repo.
// - Si dist/cli.js ya existe (commit de release con dist/ versionado): no compila ni necesita TypeScript.
// - Si no existe (desarrollo, o instalar un commit sin dist/): compila con tsc, que debe estar instalado.
// En desarrollo, `npm run build` y `npm test` compilan siempre.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
if (existsSync(join(raiz, 'dist', 'cli.js'))) {
  console.log('captura-cli: dist/ ya está compilado; no se compila')
  process.exit(0)
}
let tsc
try { tsc = createRequire(join(raiz, 'package.json')).resolve('typescript/bin/tsc') } catch {
  console.error('captura-cli: falta dist/ y no está TypeScript para compilarlo. Instalar desde una etiqueta de release (trae dist/) o correr `npm install` en el repo')
  process.exit(1)
}
const r = spawnSync(process.execPath, [tsc, '-p', join(raiz, 'tsconfig.json')], { stdio: ['ignore', 'inherit', 'inherit'], timeout: 300000 })
process.exit(r.status ?? 1)
