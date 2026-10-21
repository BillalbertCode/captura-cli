// Registro de un workspace la primera vez que se usa. Quien invoca suele ser un agente sin teclado: el CLI y la API
// salen con WORKSPACE_NUEVO (código 6) e imprimen las preguntas y los valores propuestos; el agente se las hace al
// usuario y ejecuta `captura-cli init --yes …`. La respuesta queda guardada y se cambia con `captura-cli config`.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { type Registro, dirWorkspace, excluirDeGit, guardarRegistro, home, idWorkspace, leerRegistro, propuesta } from './almacen.js'
import { VERSION } from './version.js'

/** Esquema de captura.config.json para el editor (autocompletado y validación). */
export const ESQUEMA = 'https://raw.githubusercontent.com/BillalbertCode/captura-cli/main/schema/captura.config.schema.json'

export function mensajeWorkspaceNuevo(raiz: string): string {
  const p = propuesta(raiz)
  return [
    `WORKSPACE_NUEVO: ${raiz} no está registrado en ${home()}.`,
    'Preguntale al usuario estas tres cosas y después ejecutá el comando de abajo con sus respuestas:',
    `  1. salidas: ¿dónde van las capturas e informes? "global" (recomendado, fuera del repo: ${p.salidasGlobal}) o una ruta propia.`,
    `  2. proyecto: ¿dónde viven captura.config.json, adaptadores/ y recetas/? propuesto: ${p.proyecto}`,
    '     (una carpeta del repo si el equipo los comparte; la herramienta no escribe nada en el repo por su cuenta)',
    '  3. estadisticas: ¿registrar estadísticas de uso locales (no se envían a ningún lado)? propuesto: si',
    `captura-cli init --yes --salidas global --proyecto "${p.proyecto}" --estadisticas si`,
  ].join('\n')
}

export interface OpcionesInit {
  salidas: string
  proyecto?: string
  estadisticas?: boolean
}

/** Registra el workspace. Devuelve el registro y avisos para imprimir (exclusiones de git agregadas). */
export function registrar(raiz: string, o: OpcionesInit): { registro: Registro; avisos: string[] } {
  const p = propuesta(raiz)
  const salidas = o.salidas === 'global' ? p.salidasGlobal : resolve(o.salidas)
  const proyecto = resolve(o.proyecto ?? p.proyecto)
  const avisos: string[] = []
  mkdirSync(salidas, { recursive: true })
  mkdirSync(join(proyecto, 'recetas'), { recursive: true })
  mkdirSync(join(proyecto, 'adaptadores'), { recursive: true })
  const cfg = join(proyecto, 'captura.config.json')
  if (!existsSync(cfg)) {
    writeFileSync(cfg, JSON.stringify({ $schema: ESQUEMA, apps: {} }, null, 2) + '\n')
    avisos.push(`config: creado ${cfg} (declarar las apps a probar)`)
  }
  const ex = excluirDeGit(salidas)
  if (ex) avisos.push(`salidas dentro de un repo: agregado "${ex}" a .git/info/exclude (el .gitignore no se toca)`)
  const ahora = new Date().toISOString()
  const previo = leerRegistro(raiz)
  const registro: Registro = {
    version: 1, origen: raiz, nombre: idWorkspace(raiz), registrado: previo?.registrado ?? ahora, ultimoUso: ahora,
    salidas, proyecto, estadisticas: o.estadisticas ?? true,
  }
  guardarRegistro(raiz, { ...registro, ...{ cli: VERSION } })
  avisos.push(`workspace registrado: ${dirWorkspace(raiz)}`)
  return { registro, avisos }
}
