// Descriptor de ESTA implementación para las pruebas de paridad (ver test/paridad/README.md).
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const R = (rol) => rol.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_')
const tmp = (p) => fileURLToPath(new URL(`../.tmp/${p}`, import.meta.url))
// Almacén y carpeta de proyecto aislados para las pruebas: nunca el ~/.captura-cli real del usuario.
const casa = tmp('casa/')
const proyecto = tmp('proyecto/')
const cli = fileURLToPath(new URL('../../dist/cli.js', import.meta.url))

export default {
  nombre: 'captura-cli',
  modulo: new URL('../../dist/index.js', import.meta.url).href,
  cli,
  id: (n, sufijo = '') => `PRUEBA-${n}${sufijo ? `-${sufijo}` : ''}`,
  envCredenciales: (rol, usuario, clave) => ({ [`CAPTURA_${R(rol)}_USUARIO`]: usuario, [`CAPTURA_${R(rol)}_CLAVE`]: clave }),
  variablesFaltantes: (rol) => [`CAPTURA_${R(rol)}_USUARIO`, `CAPTURA_${R(rol)}_CLAVE`],
  env: () => ({ CAPTURA_HOME: casa }),
  // Registra el workspace de las pruebas (la raíz de este repo) con un proyecto que resuelve el slot por puertos.
  preparar() {
    mkdirSync(proyecto, { recursive: true })
    writeFileSync(`${proyecto}captura.config.json`, JSON.stringify({
      apps: {},
      adaptadores: { entorno: { usa: 'builtin:comando', puertoPorSlot: 100 } },
    }, null, 2) + '\n')
    const r = spawnSync(process.execPath, [cli, 'init', '--yes', '--salidas', 'global', '--proyecto', proyecto, '--estadisticas', 'si'], {
      env: { ...process.env, CAPTURA_HOME: casa }, encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'],
    })
    if (r.status !== 0) throw new Error(`no se pudo registrar el workspace de prueba: ${r.stdout}${r.stderr}`)
  },
  capacidades: ['canal', 'workspace', 'slot-por-puertos', 'api-sin-cookie', 'pagina-colgada'],
  defectos: [],
}
