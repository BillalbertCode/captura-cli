// App sin login: sesion(null) la abre en su inicio, sin rol ni credenciales. Una app con login sin rol falla claro.
import { C, id, rechaza, sitio, registrarApp, registrarAppSinLogin } from './_comun.mjs'
const s = await sitio()
registrarApp(s.url) // zz, con login
registrarAppSinLogin(s.url) // pub, sin login
const { page, cerrar } = await C.sesion(null, { ticket: id(15), app: 'pub' })
console.log(`PRUEBA url=${new URL(page.url()).pathname}`)
await C.marcar(page, page.getByRole('heading', { name: 'Publico' }), 'Pantalla pública')
await C.foto(page, 'publico', { leyenda: 'La pantalla pública' })
await C.limpiar(page)
C.caso(page, { nombre: 'app sin login', esperado: '/publico', observado: new URL(page.url()).pathname, ok: true })
await cerrar({ ninguna: 'prueba' })
await rechaza('app con login sin rol', () => C.sesion(null, { ticket: id(15), app: 'zz' }))
await s.cerrar()
