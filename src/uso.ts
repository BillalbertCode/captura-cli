// Libro de uso (uso.jsonl): una línea por proceso (un comando del CLI o un script que usa la API), escrita al salir.
// Mide lo que le cuesta al agente leer la salida (caracteres y tokens estimados), el tiempo, el código de salida, y
// qué pasó con recetas, casos, capturas y 5xx. Solo se escribe si el usuario aceptó registrar estadísticas al
// registrar el workspace; nunca sale de la máquina. `captura-cli stats` lo resume.
import { appendFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { ctx, hayContexto } from './contexto.js'

/** Estimación de tokens de un texto (≈ 4 caracteres por token; el transcrito da los reales). */
export const tokensEstimados = (caracteres: number): number => Math.ceil(caracteres / 4)

export interface Contadores {
  recetas: { yaEstaba: number; ejecutada: number; rota: number; creadas: number; candidatas: number }
  casos: { ok: number; falla: number }
  capturas: number
  errores5xx: number
  ids: string[]
}

let activo: { comando: string; script: string; t0: number; caracteres: number; c: Contadores } | null = null

/** Empieza a medir este proceso. Una sola vez; los comandos internos (hook, stats) no se miden. */
export function iniciarLibro(comando: string, script = ''): void {
  if (activo) return
  activo = {
    comando, script, t0: Date.now(), caracteres: 0,
    c: { recetas: { yaEstaba: 0, ejecutada: 0, rota: 0, creadas: 0, candidatas: 0 }, casos: { ok: 0, falla: 0 }, capturas: 0, errores5xx: 0, ids: [] },
  }
  const medir = (s: NodeJS.WriteStream): void => {
    const original = s.write.bind(s) as (...a: unknown[]) => boolean
    s.write = ((trozo: unknown, ...resto: unknown[]) => {
      if (activo) activo.caracteres += typeof trozo === 'string' ? trozo.length : Buffer.isBuffer(trozo) ? trozo.toString('utf8').length : 0
      return original(trozo, ...resto)
    }) as typeof s.write
  }
  medir(process.stdout)
  medir(process.stderr)
  process.on('exit', (codigo) => escribir(codigo))
}

/** Suma a los contadores de esta corrida (si se está midiendo). */
export function contar(f: (c: Contadores) => void): void {
  if (activo) f(activo.c)
}

function escribir(codigo: number): void {
  const a = activo
  activo = null
  if (!a || !hayContexto()) return
  const c = ctx()
  if (!c.registro.estadisticas) return
  const linea = {
    fecha: new Date(a.t0).toISOString(), corrida: c.corrida, slot: c.slot, comando: a.comando,
    ...(a.script ? { script: a.script } : {}),
    ms: Date.now() - a.t0, codigo, salida: { caracteres: a.caracteres, tokens: tokensEstimados(a.caracteres) },
    ...a.c, ids: [...new Set(a.c.ids)],
  }
  try { appendFileSync(join(c.dirWs, 'uso.jsonl'), JSON.stringify(linea) + '\n') } catch { /* el libro nunca hace fallar una corrida */ }
}

/** Para la API: el nombre del script que la importó. */
export const nombreScript = (): string => (process.argv[1] ? basename(process.argv[1]) : '')
