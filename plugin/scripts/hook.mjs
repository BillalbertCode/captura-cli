// Puente entre los hooks del plugin y el comando captura-cli (instalado aparte, en global).
//   node hook.mjs inicio | cierre   (Claude Code pasa el JSON del evento por stdin)
// Si captura-cli no está instalado: al inicio, le dice al agente cómo instalarlo; al cierre, no hace nada.
// Nunca bloquea por un error propio y nunca se queda esperando (tope en stdin y en el comando).
import { spawnSync } from 'node:child_process'

const evento = process.argv[2]
const INSTALAR = 'npm i -g --install-links github:BillalbertCode/captura-cli#v1.0.0'

function leerEntrada(ms = 5000) {
  if (process.stdin.isTTY) return Promise.resolve('')
  return new Promise((ok) => {
    let s = ''
    const fin = () => { clearTimeout(t); process.stdin.pause(); ok(s) }
    const t = setTimeout(fin, ms)
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (d) => { s += d })
    process.stdin.on('end', fin)
    process.stdin.on('error', fin)
  })
}

const entrada = await leerEntrada()
const opciones = { input: entrada, encoding: 'utf8', timeout: 40000, windowsHide: true }
// CAPTURA_CLI=<ruta a dist/cli.js> usa esa copia (desarrollo y pruebas); si no, el comando global.
// En Windows el comando global es un .cmd: hace falta la shell para encontrarlo.
const r = process.env.CAPTURA_CLI
  ? spawnSync(process.execPath, [process.env.CAPTURA_CLI, 'hook', evento], opciones)
  : spawnSync('captura-cli', ['hook', evento], { ...opciones, shell: process.platform === 'win32' })
const noEsta = r.error?.code === 'ENOENT' || r.status === 127 || (process.platform === 'win32' && r.status === 1 && /no se reconoce|not recognized/i.test(r.stderr ?? ''))
if (noEsta) {
  if (evento === 'inicio') console.log(`captura-cli no está instalado: la skill captura lo necesita. Instalar con: ${INSTALAR}`)
  process.exit(0)
}
if (r.stdout) process.stdout.write(r.stdout)
if (r.stderr) process.stderr.write(r.stderr)
// Siempre 0: un hook roto no traba al agente. La decisión de bloquear va en el JSON de stdout.
process.exit(0)
