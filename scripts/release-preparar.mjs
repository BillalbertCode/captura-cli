// Prepara el commit de release: el commit actual (HEAD) más dist/ compilado, en la rama release/v<versión>.
// No toca main, ni la carpeta de trabajo, ni el índice: compila en una carpeta nueva y arma el commit con un índice
// temporal (git plumbing). No crea etiquetas ni hace push.
//   npm run release:preparar
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const { version } = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8'))
const rama = `release/v${version}`

const fallar = (m) => { console.error(`release: ${m}`); process.exit(1) }
function git(args, env = {}) {
  const r = spawnSync('git', args, { cwd: raiz, encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } })
  if (r.status !== 0) fallar(`git ${args.join(' ')}: ${(r.stderr || r.stdout).trim()}`)
  return r.stdout.trim()
}

if (git(['status', '--porcelain', '--untracked-files=no'])) fallar('hay cambios sin commitear; commitearlos antes de preparar el release')
const base = git(['rev-parse', 'HEAD'])

// 1) Compilar en una carpeta nueva y vacía (dist/ del repo no se toca).
const salida = join(raiz, 'test', '.tmp', `release-${Date.now()}`, 'dist')
mkdirSync(salida, { recursive: true })
const tsc = createRequire(join(raiz, 'package.json')).resolve('typescript/bin/tsc')
const c = spawnSync(process.execPath, [tsc, '-p', join(raiz, 'tsconfig.json'), '--outDir', salida], { stdio: ['ignore', 'inherit', 'inherit'], timeout: 300000 })
if (c.status !== 0) fallar('tsc falló')
const archivos = []
const recorrer = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) (e.isDirectory() ? recorrer : (f) => archivos.push(f))(join(d, e.name)) }
recorrer(salida)
if (!archivos.some((f) => f.endsWith(`${sep}cli.js`))) fallar('la compilación no produjo dist/cli.js')

// 2) Índice temporal = árbol de HEAD + dist/ compilado.
const indice = join(dirname(salida), 'indice')
const env = { GIT_INDEX_FILE: indice }
git(['read-tree', base], env)
for (const f of archivos) {
  const sha = git(['hash-object', '-w', f])
  const ruta = 'dist/' + relative(salida, f).split(sep).join('/')
  git(['update-index', '--add', '--cacheinfo', `100644,${sha},${ruta}`], env)
}
const arbol = git(['write-tree'], env)
rmSync(indice) // solo el archivo de índice temporal que creó este script

// 3) Commit hijo de HEAD en la rama de release (se rehace si ya existía). main no cambia.
const mensaje = `chore(release): incluye dist/ compilado para v${version}\n\n- Árbol de ${base.slice(0, 7)} más dist/ (${archivos.length} archivos)\n- La instalación desde git no compila: scripts/prepare.mjs ve dist/cli.js y no necesita tsc`
const commit = git(['commit-tree', arbol, '-p', base, '-m', mensaje])
git(['branch', '-f', rama, commit])
console.log(`release: ${rama} -> ${commit.slice(0, 7)} (base ${base.slice(0, 7)}, ${archivos.length} archivos en dist/)`)
console.log(`probar: npx --yes git+file:///${raiz.split(sep).join('/')}#${commit.slice(0, 7)} --version`)
console.log('no se creó ninguna etiqueta ni se hizo push')
