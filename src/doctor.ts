// `captura-cli doctor`: qué falta para trabajar, con el comando exacto para arreglarlo. Con --instalar baja el
// Chromium de Playwright si falta (lo único que instala; nunca toca otra cosa).
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { cargarUno } from './adaptadores/cargar.js'
import { TIPOS } from './adaptadores/contrato.js'
import { ctx, hayContexto, preparar } from './contexto.js'
import { raizWorkspace } from './almacen.js'
import { VERSION } from './version.js'

export interface Chequeo { estado: 'ok' | 'FALTA' | 'AVISO'; que: string; arreglo?: string }

const requerir = createRequire(import.meta.url)
const dirPlaywright = (): string => dirname(requerir.resolve('playwright/package.json'))

export async function revisar({ instalar = false }: { instalar?: boolean } = {}): Promise<Chequeo[]> {
  const out: Chequeo[] = [{ estado: 'ok', que: `captura-cli ${VERSION}` }]
  const mayor = Number(process.versions.node.split('.')[0])
  out.push(mayor >= 20 ? { estado: 'ok', que: `Node ${process.versions.node}` } : { estado: 'FALTA', que: `Node ${process.versions.node} (hace falta 20 o más)`, arreglo: 'instalar Node 20 o posterior' })

  // Playwright y sus navegadores.
  let pw: typeof import('playwright') | null = null
  try {
    pw = await import('playwright')
    const v = (JSON.parse(readFileSync(join(dirPlaywright(), 'package.json'), 'utf8')) as { version: string }).version
    out.push({ estado: 'ok', que: `Playwright ${v}` })
  } catch (e) {
    out.push({ estado: 'FALTA', que: `Playwright no carga: ${(e as Error).message.split('\n')[0]}`, arreglo: 'reinstalar captura-cli' })
  }
  if (pw) {
    const instalarCmd = `node "${join(dirPlaywright(), 'cli.js')}" install chromium`
    let ruta = pw.chromium.executablePath()
    if (!existsSync(ruta) && instalar) {
      const r = spawnSync(process.execPath, [join(dirPlaywright(), 'cli.js'), 'install', 'chromium'], { stdio: ['ignore', 'inherit', 'inherit'], timeout: 600000 })
      if (r.status !== 0) out.push({ estado: 'FALTA', que: 'no se pudo instalar Chromium', arreglo: instalarCmd })
      ruta = pw.chromium.executablePath()
    }
    out.push(existsSync(ruta)
      ? { estado: 'ok', que: `Chromium de Playwright (${ruta})` }
      : { estado: 'FALTA', que: 'Chromium de Playwright no está descargado', arreglo: `captura-cli doctor --instalar   (o: ${instalarCmd})` })
    for (const b of ['firefox', 'webkit'] as const) {
      const p = pw[b].executablePath()
      if (!existsSync(p)) out.push({ estado: 'AVISO', que: `${b} no está descargado (solo hace falta con --browser ${b})`, arreglo: `node "${join(dirPlaywright(), 'cli.js')}" install ${b}` })
    }
    const canal = process.env['CAPTURA_CANAL']
    if (canal) out.push({ estado: 'ok', que: `CAPTURA_CANAL=${canal} (se usa el navegador instalado; si falla al abrir, quitar la variable)` })
  }

  // Workspace, config y adaptadores.
  const raiz = raizWorkspace()
  await preparar()
  if (!hayContexto()) {
    out.push({ estado: 'AVISO', que: `workspace ${raiz} sin registrar (o con la config inválida)`, arreglo: 'captura-cli init   (registra esta carpeta; cualquier otro comando también lo ofrece en una terminal)' })
    return out
  }
  const c = ctx()
  out.push({ estado: 'ok', que: `workspace ${c.registro.nombre}; salidas en ${c.rutas.salidas}` })
  out.push({ estado: 'ok', que: `config ${c.configArchivo ?? '(sin archivo: valores por defecto)'}; apps: ${Object.keys(c.cfg.apps).join(', ') || 'ninguna'}` })
  if (!Object.keys(c.cfg.apps).length) out.push({ estado: 'AVISO', que: 'no hay apps declaradas', arreglo: `declararlas en ${c.configArchivo ?? 'captura.config.json'} (ver docs/configuracion.md)` })
  out.push(existsSync(c.rutas.recetas) ? { estado: 'ok', que: `recetas en ${c.rutas.recetas}` } : { estado: 'AVISO', que: `no existe la carpeta de recetas ${c.rutas.recetas}`, arreglo: 'crearla al registrar la primera receta' })
  for (const t of TIPOS) {
    const ref = c.cfg.adaptadores[t]
    if (!ref) continue
    try { await cargarUno(t, ref, c.cfg, { raiz: c.raiz, base: c.base, slot: c.slot, dirSlot: c.dirSlot }); out.push({ estado: 'ok', que: `adaptador ${t} (${typeof ref === 'string' ? ref : ref.usa})` }) } catch (e) {
      out.push({ estado: 'FALTA', que: (e as Error).message, arreglo: 'ver docs/adaptadores.md' })
    }
  }
  if (!c.registro.estadisticas) out.push({ estado: 'AVISO', que: 'estadísticas apagadas (captura-cli stats no tendrá datos)', arreglo: 'captura-cli config estadisticas si' })
  return out
}

export const formatearChequeos = (cs: Chequeo[]): string =>
  cs.map((c) => `${c.estado.padEnd(5)} ${c.que}${c.arreglo ? `\n      → ${c.arreglo}` : ''}`).join('\n')
