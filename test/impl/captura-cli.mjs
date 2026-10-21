// Descriptor de ESTA implementación para las pruebas de paridad (ver test/paridad/README.md).
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const R = (rol) => rol.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_')
const casa = fileURLToPath(new URL('../.tmp/casa/', import.meta.url))

export default {
  nombre: 'captura-cli',
  modulo: new URL('../../dist/index.js', import.meta.url).href,
  cli: fileURLToPath(new URL('../../dist/cli.js', import.meta.url)),
  id: (n, sufijo = '') => `PRUEBA-${n}${sufijo ? `-${sufijo}` : ''}`,
  envCredenciales: (rol, usuario, clave) => ({ [`CAPTURA_${R(rol)}_USUARIO`]: usuario, [`CAPTURA_${R(rol)}_CLAVE`]: clave }),
  variablesFaltantes: (rol) => [`CAPTURA_${R(rol)}_USUARIO`, `CAPTURA_${R(rol)}_CLAVE`],
  // Almacén aislado para las pruebas: nunca el ~/.captura-cli real del usuario.
  env: () => { mkdirSync(casa, { recursive: true }); return { CAPTURA_HOME: casa } },
  capacidades: ['canal', 'cli'],
  defectos: [],
}
