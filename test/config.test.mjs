// F2: claves del config con valores neutros por defecto, errores accionables y `captura-cli config <clave> <valor>`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFECTO, normalizar } from '../dist/config.js'

// Fuera de este repo: dentro, git resolvería cada carpeta como el workspace captura-cli.
const tmp = join(tmpdir(), 'captura-cli-pruebas')
const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url))
const carpeta = (n) => { const d = join(tmp, `${n}-${process.pid}-${Date.now()}`); mkdirSync(d, { recursive: true }); return d }
const correr = (args, { cwd, casa }) => spawnSync(process.execPath, [cli, ...args], {
  cwd, env: { ...process.env, CAPTURA_HOME: casa }, encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
})
const error = (c) => { try { normalizar(c, 'x.json'); return '' } catch (e) { return e.message } }
const app = { baseUrl: 'http://localhost:3000', login: '/login', campoUsuario: '#u', campoClave: '#c', boton: 'Entrar', postLogin: '**/inicio' }

test('sin config: valores neutros, ningún nombre de proyecto', () => {
  const c = normalizar({}, 'x.json')
  assert.deepEqual(c, DEFECTO)
  assert.deepEqual(c.id, { patron: '^[A-Za-z0-9._-]+$', mayusculas: true })
  assert.deepEqual(c.credenciales, { archivo: '.env', prefijo: 'CAPTURA_', alias: {} })
  assert.deepEqual([c.apps, c.rutas, c.adaptadores, c.extras], [{}, {}, {}, []])
})

test('config completo se respeta', () => {
  const c = normalizar({
    $schema: 'x', viewport: { width: 800, height: 600 }, sesionMin: 0, apps: { web: app },
    id: { patron: '^T-\\d+$', mayusculas: false }, credenciales: { archivo: 'cred.env', prefijo: 'E2E_', alias: { 'jefe de área': 'JEFE' } },
    rutas: { salidas: 'out', recetas: 'r', helpers: 'h', escenarios: 'e', sesiones: 's' },
    adaptadores: { entorno: { usa: 'builtin:comando', puertoPorSlot: 10 } }, extras: ['correo', 'correo'],
  }, 'x.json')
  assert.equal(c.viewport.width, 800)
  assert.equal(c.sesionMin, 0)
  assert.equal(c.apps.web.boton, 'Entrar')
  assert.deepEqual(c.id, { patron: '^T-\\d+$', mayusculas: false })
  assert.equal(c.credenciales.alias['jefe de área'], 'JEFE')
  assert.equal(c.rutas.sesiones, 's')
  assert.deepEqual(c.extras, ['correo'])
})

test('errores accionables: clave desconocida, heredada, typo y forma', () => {
  assert.match(error({ salida: '.salidas' }), /clave desconocida "salida": usar "rutas": \{ "salidas": "…" \}/)
  assert.match(error({ playwrightDesde: 'x' }), /clave desconocida "playwrightDesde": quitarla: Playwright viene incluido/)
  assert.match(error({ sesionmin: 3 }), /clave desconocida "sesionmin": ¿quisiste decir "sesionMin"\?/)
  assert.match(error({ rutas: { recetass: 'r' } }), /clave desconocida "rutas\.recetass": ¿quisiste decir "rutas\.recetas"\?/)
  assert.match(error({ apps: { web: { ...app, botton: 'x' } } }), /"apps\.web\.botton": ¿quisiste decir "apps\.web\.boton"\?/)
  assert.match(error({ apps: { web: { ...app, baseUrl: 'localhost:3000' } } }), /"apps\.web\.baseUrl" debe ser una URL http\(s\)/)
  assert.match(error({ apps: { web: { baseUrl: 'http://a', login: '/l', boton: 'b', postLogin: '**' } } }), /"apps\.web\.campoUsuario\/campoClave" debe ser selectores/)
  assert.match(error({ apps: { web: { ...app, campos: [{ selector: '#x', valor: 'dni' }] } } }), /"apps\.web\.campos\[0\]" debe ser/)
  assert.match(error({ id: { patron: '([' } }), /"id\.patron" debe ser una expresión regular válida/)
  assert.match(error({ credenciales: { alias: { jefe: 'jefe' } } }), /"credenciales\.alias" debe ser/)
  assert.match(error({ extras: ['jira'] }), /"extras" debe ser una lista con: correo/)
  assert.match(error({ viewport: { width: 0, height: 900 } }), /"viewport" debe ser/)
  // Claves propias dentro de una app (datos para un adaptador) se permiten si no parecen un typo.
  assert.equal(error({ apps: { web: { ...app, repoFront: 'web' } } }), '')
})

test('app sin login: basta con baseUrl; boton, postLogin o campos sin login son un error que lo explica', () => {
  const c = normalizar({ apps: { pub: { baseUrl: 'http://localhost:3000', inicio: '/home', apiBase: '/api' } } }, 'x.json')
  assert.equal(c.apps.pub.login, undefined)
  assert.equal(c.apps.pub.inicio, '/home')
  for (const k of ['boton', 'postLogin', 'campoUsuario', 'campoClave']) {
    assert.match(error({ apps: { pub: { baseUrl: 'http://localhost:3000', [k]: 'x' } } }), new RegExp(`"apps\\.pub\\.${k}" solo tiene sentido con "apps\\.pub\\.login" \\(la ruta de la pantalla de login\\): declararlo, o quitar`))
  }
  assert.match(error({ apps: { pub: { baseUrl: 'http://localhost:3000', campos: [{ selector: '#u', valor: 'usuario' }] } } }), /"apps\.pub\.campos" solo tiene sentido con/)
  // Un typo de «login» no pasa en silencio, y un login vacío tampoco.
  assert.match(error({ apps: { pub: { baseUrl: 'http://localhost:3000', logn: '/l' } } }), /clave desconocida "apps\.pub\.logn": ¿quisiste decir "apps\.pub\.login"\?/)
  assert.match(error({ apps: { pub: { baseUrl: 'http://localhost:3000', login: '' } } }), /"apps\.pub\.login" debe ser un texto no vacío/)
  // Con login, todo sigue exigiéndose.
  assert.match(error({ apps: { web: { baseUrl: 'http://localhost:3000', login: '/l' } } }), /"apps\.web\.boton" debe ser un texto no vacío/)
})

test('config inválido: la API y el CLI salen con 1 y el texto exacto', () => {
  const casa = carpeta('casa'), ws = carpeta('ws'), proy = carpeta('proy')
  assert.equal(correr(['init', '--yes', '--salidas', 'global', '--proyecto', proy, '--estadisticas', 'no'], { cwd: ws, casa }).status, 0)
  writeFileSync(join(proy, 'captura.config.json'), JSON.stringify({ salida: 'x' }))
  const r = correr(['config'], { cwd: ws, casa })
  assert.equal(r.status, 1, r.stdout + r.stderr)
  assert.match(r.stderr, /^CONFIG_INVALIDA: .+captura\.config\.json: clave desconocida "salida"/m)
})

test('captura-cli config: muestra la config efectiva y cambia salidas, proyecto, estadisticas y salidas-base', () => {
  const casa = carpeta('casa'), ws = carpeta('ws'), proy = carpeta('proy'), otra = carpeta('salidas'), base = carpeta('base')
  const i = correr(['init', '--yes', '--salidas', 'global', '--proyecto', proy, '--estadisticas', 'si'], { cwd: ws, casa })
  assert.equal(i.status, 0, i.stdout + i.stderr)
  const cfg = JSON.parse(readFileSync(join(proy, 'captura.config.json'), 'utf8'))
  assert.match(cfg.$schema, /schema\/captura\.config\.schema\.json$/)
  let r = correr(['config'], { cwd: ws, casa })
  assert.equal(r.status, 0, r.stderr)
  for (const l of ['estadisticas: si', 'id: ^[A-Za-z0-9._-]+$ (carpeta en mayúsculas)', 'credenciales: CAPTURA_<ROL>_USUARIO / _CLAVE en .env']) assert.ok(r.stdout.includes(l), l)
  assert.match(r.stdout, /^adaptadores: credenciales=\(incluido por defecto\) .* correo=\(ninguno\)$/m)
  r = correr(['config', 'salidas', otra], { cwd: ws, casa })
  assert.equal(r.status, 0, r.stderr)
  assert.ok(r.stdout.includes(`salidas: ${otra}`))
  assert.equal(correr(['config', 'estadisticas', 'no'], { cwd: ws, casa }).status, 0)
  assert.equal(correr(['config', 'estadisticas', 'quizas'], { cwd: ws, casa }).status, 1)
  assert.equal(correr(['config', 'color', 'rojo'], { cwd: ws, casa }).status, 1)
  r = correr(['config'], { cwd: ws, casa })
  assert.ok(r.stdout.includes(`salidas: ${otra}`) && r.stdout.includes('estadisticas: no'), r.stdout)
  // salidas-base: se guarda en el config del usuario y se propone en workspaces nuevos (no cambia los registrados).
  assert.equal(correr(['config', 'salidas-base', base], { cwd: ws, casa }).status, 0)
  assert.equal(JSON.parse(readFileSync(join(casa, 'config.json'), 'utf8')).salidasBase, base)
  const nuevo = correr(['recetas'], { cwd: carpeta('ws2'), casa })
  assert.equal(nuevo.status, 6)
  assert.ok(nuevo.stderr.includes(join(base, '')), nuevo.stderr)
  assert.ok(correr(['config'], { cwd: ws, casa }).stdout.includes(`salidas: ${otra}`))
})

test('extras: ["correo"] carga builtin:mailpit sin declarar el adaptador', () => {
  const casa = carpeta('casa'), ws = carpeta('ws'), proy = carpeta('proy')
  correr(['init', '--yes', '--salidas', 'global', '--proyecto', proy], { cwd: ws, casa })
  writeFileSync(join(proy, 'captura.config.json'), JSON.stringify({ extras: ['correo'] }))
  const r = correr(['config'], { cwd: ws, casa })
  assert.match(r.stdout, /correo=builtin:mailpit \(extras\)/)
  assert.equal(correr(['adaptadores', 'verificar'], { cwd: ws, casa }).status, 0)
})

test('rutas.sesiones dentro de un repo: se excluye por .git/info/exclude con aviso', () => {
  const casa = carpeta('casa'), ws = carpeta('repo'), proy = carpeta('proy')
  spawnSync('git', ['init', '-q'], { cwd: ws, timeout: 30000 })
  correr(['init', '--yes', '--salidas', 'global', '--proyecto', proy], { cwd: ws, casa })
  writeFileSync(join(proy, 'captura.config.json'), JSON.stringify({ rutas: { sesiones: join(ws, 'sesiones-locales') } }))
  const r = correr(['config'], { cwd: ws, casa })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stderr, /AVISO: sesiones dentro de un repo git: agregado "\/sesiones-locales\/slots\/0\/" a \.git\/info\/exclude/)
  assert.ok(readFileSync(join(ws, '.git', 'info', 'exclude'), 'utf8').includes('/sesiones-locales/slots/0/'))
  assert.doesNotMatch(correr(['config'], { cwd: ws, casa }).stderr, /AVISO/, 'solo la primera vez')
  assert.ok(!existsSync(join(ws, '.gitignore')))
})
