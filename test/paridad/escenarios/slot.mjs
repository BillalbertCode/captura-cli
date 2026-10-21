// CAPTURA_SLOT=N apunta la app a su bloque de puertos (+100·N), cuando la implementación resuelve el slot por puertos.
import { C, id, conCredenciales, sitio, registrarApp } from './_comun.mjs'
const base = 20000 + Math.floor(Math.random() * 9000)
const s = await sitio({ puerto: base + 100 * Number(process.env.CAPTURA_SLOT || 0) })
registrarApp(`http://localhost:${base}`)
conCredenciales('zz')
const { page, cerrar } = await C.sesion('zz', { ticket: id(12), app: 'zz', reutilizar: false })
console.log(`PRUEBA puerto=${new URL(page.url()).port} base=${base}`)
await cerrar()
await s.cerrar()
