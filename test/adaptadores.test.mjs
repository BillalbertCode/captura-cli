// Contrato de adaptadores (versión 1) y adaptadores incluidos, sin navegador.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { CONTRATO, validarFabrica, validarInstancia } from '../dist/adaptadores/index.js'
import { INCLUIDOS } from '../dist/adaptadores/cargar.js'

const ctx = { raiz: '.', base: '.', slot: 0, dirSlot: '.' }
const crear = (n, o = {}, c = ctx) => INCLUIDOS[n].crear(o, c)

test('validador: contrato, tipo y métodos', () => {
  assert.equal(CONTRATO, 1)
  assert.deepEqual(validarFabrica({ contrato: 1, tipo: 'correo', crear() {} }, 'correo'), [])
  assert.match(validarFabrica({ contrato: 2, tipo: 'correo', crear() {} }, 'correo')[0], /declara contrato 2 y esta versión de captura-cli usa el 1/)
  assert.match(validarFabrica({ tipo: 'correo', crear() {} }, 'correo')[0], /falta "contrato: 1"/)
  assert.match(validarFabrica({ contrato: 1, tipo: 'entorno', crear() {} }, 'correo')[0], /declara tipo "entorno" y se usa como "correo"/)
  assert.deepEqual(validarInstancia({ url() {}, buscar() {} }, 'correo'), [])
  assert.deepEqual(validarInstancia({ url() {} }, 'correo'), ['falta el método buscar()'])
  for (const [n, f] of Object.entries(INCLUIDOS)) {
    assert.deepEqual(validarFabrica(f, f.tipo), [], n)
    assert.deepEqual(validarInstancia(f.crear({}, ctx), f.tipo), [], n)
  }
})

test('builtin:env: prefijo, alias, entorno sobre archivo y faltantes en orden', () => {
  process.env.ZZT_JEFE_USUARIO = 'B-777'
  process.env.ZZT_JEFE_CLAVE = 'x'
  const a = crear('env', { prefijo: 'ZZT_', alias: { 'Jefe de área': 'JEFE' } })
  assert.deepEqual(a.resolver('jefe de área'), { usuario: 'B-777', clave: 'x', letra: 'B', numero: '777' })
  assert.deepEqual(a.resolver('Otro Rol'), { faltan: ['ZZT_OTRO_ROL_USUARIO', 'ZZT_OTRO_ROL_CLAVE'], donde: '.env' })
})

test('builtin:patron: neutro por defecto, mayúsculas configurables', () => {
  const p = crear('patron')
  assert.equal(p.validar('mi-tarea.1'), null)
  assert.match(p.validar('con espacio'), /^id requerido, formato/)
  assert.equal(p.carpeta('abc-1'), 'ABC-1')
  assert.equal(crear('patron', { mayusculas: false }).carpeta('abc-1'), 'abc-1')
})

test('builtin:comando: URL por slot y comando con marcadores, sin stdin', async () => {
  const e = crear('comando', { puertoPorSlot: 100, comandos: { estado: 'node -e "console.log(\'slot \' + process.env.CAPTURA_SLOT)"' } }, { ...ctx, slot: 3 })
  assert.equal(e.url('a', { baseUrl: 'http://localhost:5173' }, 0), 'http://localhost:5173')
  assert.equal(e.url('a', { baseUrl: 'http://localhost:5173' }, 3), 'http://localhost:5473')
  assert.deepEqual(await e.estado({ slot: 3 }), { ok: true, salida: 'slot 3' })
  assert.equal((await e.levantar('a', { slot: 3, args: [] })).ok, false)
})

test('builtin:mailpit: busca y resume adjuntos', async () => {
  const server = http.createServer((q, r) => {
    r.setHeader('content-type', 'application/json')
    if (q.url.startsWith('/api/v1/search')) return r.end(JSON.stringify({ messages: [{ ID: 'm1' }] }))
    r.end(JSON.stringify({ Subject: 'Hola', To: [{ Address: 'a@b.c' }], Date: '2026-01-01', Attachments: [{ FileName: 'x.pdf', ContentType: 'application/pdf', Size: 9 }] }))
  })
  await new Promise((ok) => server.listen(0, ok))
  try {
    const m = crear('mailpit', { url: `http://localhost:${server.address().port}` })
    const r = await m.buscar({ destinatario: 'a@b.c', asunto: 'Hola' })
    assert.deepEqual(r, [{ id: 'm1', asunto: 'Hola', para: ['a@b.c'], fecha: '2026-01-01', adjuntos: [{ nombre: 'x.pdf', tipo: 'application/pdf', bytes: 9 }] }])
    await assert.rejects(crear('mailpit', { variable: 'ZZT_NO_DEFINIDA' }).buscar({}), /definir ZZT_NO_DEFINIDA/)
  } finally { server.close() }
})
