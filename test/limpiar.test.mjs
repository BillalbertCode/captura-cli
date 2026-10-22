// `captura-cli limpiar` (simulación por defecto, --aplicar, --antes), la caché que caduca sola en `entorno levantar`
// y `captura-cli doctor`.
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url))
const raiz = join(tmpdir(), 'captura-cli-pruebas', `limpiar-${process.pid}-${Date.now()}`)
const casa = join(raiz, 'casa'), ws = join(raiz, 'ws'), proy = join(raiz, 'proy')
const env = { ...process.env, CAPTURA_HOME: casa }
const correr = (args, extra = {}) => {
  const r = spawnSync(process.execPath, [cli, ...args], { cwd: ws, env: { ...env, ...extra }, encoding: 'utf8', timeout: 120000 })
  return { code: r.status, out: r.stdout, err: r.stderr }
}
const DIA = 86400000
const archivo = (f, diasAtras = 0, contenido = 'x'.repeat(2048)) => {
  mkdirSync(join(f, '..'), { recursive: true })
  writeFileSync(f, contenido)
  const t = (Date.now() - diasAtras * DIA) / 1000
  utimesSync(f, t, t)
  return f
}
let dirWs, salidas, f

before(() => {
  for (const d of [casa, ws, proy]) mkdirSync(d, { recursive: true })
  writeFileSync(join(proy, 'captura.config.json'), JSON.stringify({ adaptadores: { entorno: { usa: 'builtin:comando', comandos: { levantar: 'node -e "console.log(1)"' } } } }))
  assert.equal(correr(['init', '--yes', '--salidas', 'global', '--proyecto', proy, '--estadisticas', 'no']).code, 0)
  const c = correr(['config']).out
  dirWs = c.match(/^almacén: (.+) \(CAPTURA_HOME=/m)[1]
  salidas = c.match(/^salidas: (.+)$/m)[1]
  const s0 = join(dirWs, 'slots', '0'), s3 = join(dirWs, 'slots', '3')
  f = {
    tmpA: archivo(join(s0, 'tmp', '20260101-000000-999999', 'a.txt')),
    tmpB: archivo(join(s0, 'tmp', '20260101-000000-999999', 'sub', 'b.txt')),
    tmpVivo: archivo(join(s0, 'tmp', `20260101-000000-${process.pid}`, 'c.txt')), // de un proceso vivo: se deja
    cacheVieja: archivo(join(s0, 'cache', 'web', 'viejo.bin'), 20),
    cacheNueva: archivo(join(s0, 'cache', 'web', 'nuevo.bin'), 1),
    sesVieja: archivo(join(s0, 'sesiones', 'web-a.json'), 2, '{}'),
    sesNueva: archivo(join(s0, 'sesiones', 'web-b.json'), 0, '{}'),
    marca: archivo(join(s3, 'ocupado.json'), 0, JSON.stringify({ pid: 999999 })),
    capVieja: archivo(join(salidas, 'OLD-1', 'step01-x.png'), 40),
    capVieja2: archivo(join(salidas, 'OLD-1', 'publicar', 'step01-x.png'), 40),
    capNueva: archivo(join(salidas, 'NEW-1', 'informe.md'), 0),
  }
})

test('limpiar sin --aplicar: lista por grupo y total, y no borra nada', () => {
  const r = correr(['limpiar'])
  assert.equal(r.code, 0, r.err)
  assert.match(r.out, /^temporales: 2 archivo\(s\), 4 KB en 1 carpeta\(s\) — carpetas tmp\/ de corridas terminadas/m)
  assert.match(r.out, /^caché: 1 archivo\(s\), 2 KB — archivos de caché sin tocar hace más de 14 días$/m)
  assert.match(r.out, /^sesiones: 1 archivo\(s\)/m)
  assert.match(r.out, /^marcas de slot: 1 archivo\(s\)/m)
  assert.doesNotMatch(r.out, /^capturas:/m, 'las capturas solo con --antes')
  assert.match(r.out, /^total: 5 archivo\(s\), .+ \(simulación: no se borró nada; repetir con --aplicar\)$/m)
  for (const x of Object.values(f)) assert.ok(existsSync(x), x)
})

test('limpiar --aplicar: borra solo lo listado; deja lo vivo, lo reciente y las capturas', () => {
  const r = correr(['limpiar', '--aplicar'])
  assert.equal(r.code, 0, r.err)
  assert.match(r.out, /^borrados: 5 archivo\(s\), \d+ KB$/m)
  for (const k of ['tmpA', 'tmpB', 'cacheVieja', 'sesVieja', 'marca']) assert.ok(!existsSync(f[k]), k)
  assert.ok(!existsSync(join(dirWs, 'slots', '0', 'tmp', '20260101-000000-999999')), 'la carpeta vacía también')
  for (const k of ['tmpVivo', 'cacheNueva', 'sesNueva', 'capVieja', 'capNueva']) assert.ok(existsSync(f[k]), k)
  assert.match(correr(['limpiar']).out, /^nada que limpiar$/m)
})

test('limpiar --antes 30d: capturas sin cambios en ese plazo, con sus subcarpetas; las recientes quedan', () => {
  assert.equal(correr(['limpiar', '--antes', 'un-mes']).code, 1)
  let r = correr(['limpiar', '--antes', '30d'])
  assert.match(r.out, /^capturas: 2 archivo\(s\), 4 KB en 1 carpeta\(s\) — ids sin cambios hace más de 30 días/m)
  assert.ok(r.out.includes(join(salidas, 'OLD-1')))
  r = correr(['limpiar', '--antes', '30d', '--aplicar'])
  assert.equal(r.code, 0, r.err)
  assert.ok(!existsSync(join(salidas, 'OLD-1')))
  assert.ok(existsSync(f.capNueva))
})

test('limpiar: salidas fuera del almacén no se tocan ni con --antes', () => {
  const fuera = join(raiz, 'salidas-propias')
  const vieja = archivo(join(fuera, 'X-1', 'step01-a.png'), 90)
  const r = correr(['limpiar', '--antes', '1d', '--aplicar'], { CAPTURA_OUT: fuera })
  assert.equal(r.code, 0, r.err)
  assert.match(r.out, /^AVISO: capturas: .+salidas-propias está fuera del almacén; limpiar no la toca/m)
  assert.ok(existsSync(vieja))
})

test('entorno levantar: la caché de más de 14 días caduca sola', () => {
  const vieja = archivo(join(dirWs, 'slots', '0', 'cache', 'web', 'otra-vieja.bin'), 30)
  const r = correr(['entorno', 'levantar', 'web'])
  assert.equal(r.code, 0, r.out + r.err)
  assert.match(r.out, /^caché: 1 archivo\(s\) de más de 14 días borrados/m)
  assert.ok(!existsSync(vieja))
  assert.ok(existsSync(f.cacheNueva))
})

test('doctor: todo en orden sale con 0; un navegador que falta es FALTA con el comando; sin workspace, AVISO', () => {
  let r = correr(['doctor'])
  assert.equal(r.code, 0, r.out + r.err)
  assert.match(r.out, /^ok {4}captura-cli \d+\.\d+\.\d+$/m)
  assert.match(r.out, /^ok {4}Node \d+/m)
  assert.match(r.out, /^ok {4}Playwright \d+\.\d+\.\d+$/m)
  assert.match(r.out, /^ok {4}Chromium de Playwright \(/m)
  assert.match(r.out, /^ok {4}workspace .+; salidas en /m)
  assert.match(r.out, /^AVISO no hay apps declaradas$/m)
  r = correr(['doctor'], { PLAYWRIGHT_BROWSERS_PATH: join(raiz, 'sin-navegadores') })
  assert.equal(r.code, 1)
  assert.match(r.out, /^FALTA Chromium de Playwright no está descargado\n {6}→ captura-cli doctor --instalar {3}\(o: node ".+cli\.js" install chromium\)$/m)
  r = correr(['doctor'], { CAPTURA_HOME: join(raiz, 'casa-vacia') })
  assert.match(r.out, /^AVISO workspace .+ sin registrar \(o con la config inválida\)$/m)
})
