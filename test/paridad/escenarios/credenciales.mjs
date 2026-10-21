// Rol sin credenciales: la herramienta sale con código 3 y nombra las variables exactas.
import { C, id, sitio, registrarApp } from './_comun.mjs'
const s = await sitio()
registrarApp(s.url)
await C.sesion('rol sin datos', { ticket: id(3), app: 'zz' })
console.log('ERROR_ESPERADO_NO_OCURRIO')
await s.cerrar()
