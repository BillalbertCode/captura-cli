// Códigos de salida (contrato público) y salida ordenada: todo navegador abierto se cierra antes de salir.

export const CODIGOS = {
  OK: 0,
  ERROR: 1,
  ESCENARIO_INVALIDO: 2,
  FALTAN_CREDENCIALES: 3,
  TIMEOUT_GLOBAL: 4,
  RECETAS_SIN_DECLARAR: 5,
  WORKSPACE_NUEVO: 6,
  PAGINA_COLGADA: 7,
} as const

type Cierre = () => void
const cierres = new Set<Cierre>()

/** Registra algo que debe cerrarse si el proceso termina (navegadores, carpeta temporal). Devuelve el des-registro. */
export function alSalir(fn: Cierre): () => void {
  cierres.add(fn)
  return () => { cierres.delete(fn) }
}

export function cerrarTodo(): void {
  for (const fn of [...cierres]) {
    try { fn() } catch { /* cerrar lo demás igual */ }
  }
  cierres.clear()
}

/** Imprime el mensaje en stderr, cierra todo y termina con el código. */
export function salir(mensaje: string, codigo: number): never {
  if (mensaje) console.error(mensaje)
  cerrarTodo()
  process.exit(codigo)
}
