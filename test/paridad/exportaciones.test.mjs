// Lista de exportaciones: las 22 funciones del núcleo con el mismo nombre y la misma aridad; el correo fuera.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { impl, falta } from './lib.mjs'

const esperado = JSON.parse(readFileSync(new URL('./exportaciones.json', import.meta.url), 'utf8'))
const C = await import(impl.modulo)

test('exporta las 22 del núcleo con su tipo y aridad', () => {
  const nombres = Object.keys(esperado.nucleo)
  assert.equal(nombres.length, 22)
  for (const n of nombres) {
    const e = esperado.nucleo[n]
    assert.ok(n in C, `falta la exportación ${n}`)
    assert.equal(typeof C[n], e.tipo, `${n}: tipo`)
    if (e.aridad !== undefined) assert.equal(C[n].length, e.aridad, `${n}: aridad`)
    if (e.aliasDe) assert.equal(C[n], C[e.aliasDe], `${n} es alias de ${e.aliasDe}`)
  }
})

test('no exporta nada fuera del contrato', () => {
  const permitidas = new Set([...Object.keys(esperado.nucleo), ...(impl.capacidades?.includes('correo-en-nucleo') ? esperado.fueraDelNucleo : []), 'default'])
  const sobran = Object.keys(C).filter((n) => !permitidas.has(n))
  assert.deepEqual(sobran, [])
})

test('el correo no es del núcleo', { skip: !falta('correo-en-nucleo') && 'la referencia trae el correo en el núcleo' }, () => {
  for (const n of esperado.fueraDelNucleo) assert.ok(!(n in C), `${n} debe vivir en el adaptador de correo`)
})
