// Contrato nuevo del CLI (no existe en la referencia): 2 escenario inválido, 6 WORKSPACE_NUEVO, manifest.json.
// Cada prueba se salta si la implementación no declara la capacidad; en F0 quedan escritas como contrato.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { impl, falta } from './lib.mjs'

const tmp = join(dirname(fileURLToPath(import.meta.url)), '..', '.tmp')
const carpetaNueva = (n) => { const d = join(tmp, `${n}-${process.pid}-${Date.now()}`); mkdirSync(d, { recursive: true }); return d }
const cli = (args, { cwd, env = {} } = {}) => spawnSync(process.execPath, [impl.cli, ...args], {
  cwd, env: { ...process.env, ...(impl.env ? impl.env() : {}), ...env }, encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
})

test('6: WORKSPACE_NUEVO en una carpeta sin registrar, con las preguntas para el agente', { skip: falta('workspace') }, () => {
  const casa = carpetaNueva('casa'), ws = carpetaNueva('ws')
  const r = cli(['recetas'], { cwd: ws, env: { CAPTURA_HOME: casa } })
  assert.equal(r.status, 6, r.stdout + r.stderr)
  assert.match(r.stdout + r.stderr, /WORKSPACE_NUEVO/)
  assert.match(r.stdout + r.stderr, /captura-cli init --yes/)
})

test('6: la API también sale con WORKSPACE_NUEVO, sin abrir el navegador', { skip: falta('workspace') }, () => {
  const casa = carpetaNueva('casa')
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', `const C = await import(${JSON.stringify(impl.modulo)}); await C.abrir({ ticket: 'x' }); console.log('ERROR_ESPERADO_NO_OCURRIO')`], {
    env: { ...process.env, CAPTURA_HOME: casa }, encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  })
  assert.equal(r.status, 6, r.stdout + r.stderr)
  assert.match(r.stderr, /^WORKSPACE_NUEVO: /m)
  assert.doesNotMatch(r.stdout, /ERROR_ESPERADO_NO_OCURRIO/)
})

test('2: escenario inválido, sin abrir el navegador, con el campo exacto a corregir', { skip: falta('escenario') }, () => {
  const d = carpetaNueva('esc')
  const f = join(d, 'malo.json')
  writeFileSync(f, JSON.stringify({ version: 1, id: 'x', rol: 'zz', casos: [{ nombre: 'c', pasos: [{ volar: {} }] }] }))
  const r = cli(['validar', f])
  assert.equal(r.status, 2, r.stdout + r.stderr)
  assert.match(r.stdout + r.stderr, /casos\[0\]\.pasos\[0\]/)
})

test('manifest.json junto al informe', { skip: falta('manifest') }, () => {
  assert.fail('pendiente de F4: definir el formato y verificarlo aquí')
})
