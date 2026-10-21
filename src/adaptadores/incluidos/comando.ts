// builtin:comando — entorno sin escribir código: ejecuta los comandos que declare la config, por ejemplo un script
// de shell que ya existe. Marcadores: {app}, {slot}, {args}. Opciones:
//   comandos: { levantar?, estado?, parar? }   cwd?: carpeta (relativa al config)   timeoutSeg?: 400
//   puertoPorSlot?: n   -> la URL de la app suma n·slot a su puerto (slot 0 = la URL del config)
import { spawnSync } from 'node:child_process'
import { isAbsolute, join } from 'node:path'
import type { AdaptadorEntorno, ContextoAdaptador, Fabrica, ResultadoEntorno } from '../contrato.js'

const fabrica: Fabrica<'entorno'> = {
  contrato: 1,
  tipo: 'entorno',
  crear(opciones, contexto: ContextoAdaptador): AdaptadorEntorno {
    const comandos = (opciones['comandos'] && typeof opciones['comandos'] === 'object' ? opciones['comandos'] : {}) as Record<string, unknown>
    const cwdOpt = typeof opciones['cwd'] === 'string' ? opciones['cwd'] : '.'
    const cwd = isAbsolute(cwdOpt) ? cwdOpt : join(contexto.base, cwdOpt)
    const tope = (typeof opciones['timeoutSeg'] === 'number' ? opciones['timeoutSeg'] : 400) * 1000
    const paso = typeof opciones['puertoPorSlot'] === 'number' ? opciones['puertoPorSlot'] : 0

    const correr = (nombre: string, vars: Record<string, string>): ResultadoEntorno => {
      const plantilla = comandos[nombre]
      if (typeof plantilla !== 'string') return { ok: false, salida: `entorno: no hay comando "${nombre}" en adaptadores.entorno.comandos` }
      const cmd = plantilla.replace(/\{(app|slot|args)\}/g, (_m, k: string) => vars[k] ?? '')
      // Sin stdin y con tope: un comando que espera entrada o no termina no cuelga al agente.
      const r = spawnSync(cmd, { cwd, shell: true, encoding: 'utf8', timeout: tope, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, env: { ...process.env, CAPTURA_SLOT: String(contexto.slot) } })
      const salida = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim()
      if (r.error) return { ok: false, salida: `${salida}\nentorno: "${cmd}" no terminó: ${r.error.message}`.trim() }
      return { ok: r.status === 0, salida }
    }

    return {
      url(_app, cfg, slot) {
        if (!paso || !slot) return cfg.baseUrl
        const u = new URL(cfg.baseUrl)
        u.port = String(Number(u.port || (u.protocol === 'https:' ? 443 : 80)) + paso * slot)
        return u.origin
      },
      levantar: async (app, { slot, args }) => correr('levantar', { app, slot: String(slot), args: args.join(' ') }),
      estado: async ({ slot }) => correr('estado', { app: '', slot: String(slot), args: '' }),
      parar: async (app, { slot }) => correr('parar', { app: app ?? '', slot: String(slot), args: '' }),
    }
  },
}
export default fabrica
