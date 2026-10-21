// Libro de uso (uso.jsonl, una línea por evento) en el almacén del workspace. Es el punto de enganche de
// `captura-cli stats` (fase 2): solo se escribe si el usuario aceptó registrar estadísticas al registrar el workspace.
import { appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { ctx, hayContexto } from './contexto.js'

export function anotarUso(datos: Record<string, unknown>): void {
  if (!hayContexto()) return
  const c = ctx()
  if (!c.registro.estadisticas) return
  try {
    appendFileSync(join(c.dirWs, 'uso.jsonl'), JSON.stringify({ fecha: new Date().toISOString(), corrida: c.corrida, slot: c.slot, ...datos }) + '\n')
  } catch { /* el libro nunca hace fallar una corrida */ }
}
