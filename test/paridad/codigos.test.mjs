// Códigos de salida del núcleo: 0, 1, 3, 4 y 5, con el texto exacto que hoy lee un agente.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { correr, impl } from './lib.mjs'

test('0: flujo completo con recetas declaradas', async () => {
  const r = await correr('exito.mjs', { args: ['ninguna'] })
  assert.equal(r.code, 0, r.err)
  assert.doesNotMatch(r.out, /ERROR_ESPERADO_NO_OCURRIO/)
  assert.match(r.out, /^recetas creadas: ninguna \(tramo de prueba, no se repite\)$/m)
})

test('1: error no atrapado sale con 1 y el texto exacto', async () => {
  const r = await correr('error.mjs')
  assert.equal(r.code, 1, r.out + r.err)
  assert.ok(r.err.includes('foto("sin-leyenda"): falta { leyenda } — toda captura lleva leyenda'), r.err)
  assert.doesNotMatch(r.out, /ERROR_ESPERADO_NO_OCURRIO/)
})

test('3: FALTAN_CREDENCIALES con las variables exactas', async () => {
  const r = await correr('credenciales.mjs')
  assert.equal(r.code, 3, r.out + r.err)
  const vars = impl.variablesFaltantes('rol sin datos')
  assert.ok(r.err.includes(`FALTAN_CREDENCIALES: rol sin datos -> definir ${vars.join(', ')}`), r.err)
  assert.doesNotMatch(r.out, /ERROR_ESPERADO_NO_OCURRIO/)
})

test('4: TIMEOUT_GLOBAL cierra y sale con 4 sin esperar al script', async () => {
  const r = await correr('timeout.mjs', { ms: 60000 })
  assert.equal(r.code, 4, r.out + r.err)
  assert.ok(r.err.includes('TIMEOUT_GLOBAL: el script superó 3 s; navegador cerrado'), r.err)
  assert.ok(r.ms < 25000, `tardó ${r.ms} ms`)
})

test('5: tramos sin receta y sin declarar', async () => {
  const r = await correr('exito.mjs', { args: ['sin-declarar'] })
  assert.equal(r.code, 5, r.out + r.err)
  assert.match(r.err, /^ERROR recetas: 1 tramo\(s\) hechos sin receta \(ver recetas-candidatas\.md\)/m)
  assert.ok(r.informe, 'el informe se escribe igual')
  assert.match(readFileSync(r.informe, 'utf8'), /\*\*INCOMPLETO: hubo tramos sin receta y no se declaró qué hacer/)
})

test('5: recetas declaradas como creadas que no existen', async () => {
  const r = await correr('exito.mjs', { args: ['creadas-falsas'] })
  assert.equal(r.code, 5, r.out + r.err)
  assert.match(r.err, /^ERROR recetas: recetas declaradas como creadas que no existen en .*zz\.mjs: no-existe$/m)
})

test('0: declararRecetas() antes de cerrar() con una receta que sí existe', async () => {
  const r = await correr('exito.mjs', { args: ['creadas'] })
  assert.equal(r.code, 0, r.err)
  assert.match(r.out, /^recetas creadas: abrir-bandeja$/m)
})
