// Almacén global por workspace: ~/.captura-cli/workspaces/<nombre>-<hash>/ (CAPTURA_HOME lo cambia).
// El workspace es la raíz del repo git; los worktrees cuentan como el mismo (directorio git común).
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

export const home = (): string => resolve(process.env['CAPTURA_HOME'] || join(homedir(), '.captura-cli'))

function git(cwd: string, ...args: string[]): string | null {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true })
  return r.status === 0 && r.stdout ? r.stdout.trim() : null
}

/** Directorio git común (el de la copia principal aunque se esté en un worktree), o null fuera de git. */
export function gitComun(cwd: string): string | null {
  const d = git(cwd, 'rev-parse', '--path-format=absolute', '--git-common-dir')
  return d ? resolve(d) : null
}

/** Raíz del workspace: la copia principal del repo git, o la carpeta actual si no hay git. */
export function raizWorkspace(cwd = process.cwd()): string {
  const comun = gitComun(cwd)
  if (!comun) return resolve(cwd)
  return basename(comun) === '.git' ? dirname(comun) : resolve(git(cwd, 'rev-parse', '--show-toplevel') || cwd)
}

const normal = (p: string): string => {
  const r = resolve(p).split(sep).join('/')
  return process.platform === 'win32' ? r.toLowerCase() : r
}

/** <nombre>-<hash6>: el hash de la ruta absoluta evita mezclar dos repos con el mismo nombre. */
export function idWorkspace(raiz: string): string {
  const nombre = basename(raiz).replace(/[^A-Za-z0-9._-]+/g, '-') || 'raiz'
  return `${nombre}-${createHash('sha256').update(normal(raiz)).digest('hex').slice(0, 6)}`
}

export interface Registro {
  version: 1
  origen: string
  nombre: string
  registrado: string
  ultimoUso: string
  /** Carpeta donde caen las capturas (una subcarpeta por id). */
  salidas: string
  /** Carpeta del proyecto: captura.config.json, adaptadores/, recetas/, helpers/, escenarios/. */
  proyecto: string
  estadisticas: boolean
}

export interface ConfigUsuario {
  /** Ruta base por defecto para las salidas de cada workspace nuevo (se vuelve a preguntar en cada uno). */
  salidasBase?: string
}

export const dirWorkspace = (raiz: string): string => join(home(), 'workspaces', idWorkspace(raiz))
const archivoRegistro = (raiz: string): string => join(dirWorkspace(raiz), 'workspace.json')

export function leerRegistro(raiz: string): Registro | null {
  const f = archivoRegistro(raiz)
  if (!existsSync(f)) return null
  try { return JSON.parse(readFileSync(f, 'utf8')) as Registro } catch { return null }
}

export function guardarRegistro(raiz: string, r: Registro): void {
  mkdirSync(dirWorkspace(raiz), { recursive: true })
  writeFileSync(archivoRegistro(raiz), JSON.stringify(r, null, 2) + '\n')
}

export function leerConfigUsuario(): ConfigUsuario {
  try { return JSON.parse(readFileSync(join(home(), 'config.json'), 'utf8')) as ConfigUsuario } catch { return {} }
}

export function guardarConfigUsuario(c: ConfigUsuario): void {
  mkdirSync(home(), { recursive: true })
  writeFileSync(join(home(), 'config.json'), JSON.stringify(c, null, 2) + '\n')
}

/** Valores que se proponen al registrar un workspace. */
export function propuesta(raiz: string): { salidasGlobal: string; proyecto: string; estadisticas: boolean } {
  const base = leerConfigUsuario().salidasBase
  return {
    salidasGlobal: base ? join(resolve(base), idWorkspace(raiz)) : join(dirWorkspace(raiz), 'captures'),
    proyecto: join(dirWorkspace(raiz), 'proyecto'),
    estadisticas: true,
  }
}

export const dentroDe = (padre: string, hijo: string): boolean => {
  const r = relative(resolve(padre), resolve(hijo))
  return r === '' || (!r.startsWith('..') && !isAbsolute(r))
}

/**
 * Si `ruta` cae dentro de un repo git, la agrega a .git/info/exclude (no toca el .gitignore versionado).
 * Devuelve la línea agregada, o null si no hizo falta.
 */
export function excluirDeGit(ruta: string): string | null {
  const existente = existsSync(ruta) ? ruta : dirname(ruta)
  const comun = gitComun(existente)
  if (!comun || basename(comun) !== '.git') return null
  const repo = dirname(comun)
  if (!dentroDe(repo, ruta)) return null
  const linea = '/' + relative(repo, ruta).split(sep).join('/') + '/'
  const f = join(comun, 'info', 'exclude')
  const actual = existsSync(f) ? readFileSync(f, 'utf8') : ''
  if (actual.split(/\r?\n/).includes(linea)) return null
  mkdirSync(dirname(f), { recursive: true })
  appendFileSync(f, (actual && !actual.endsWith('\n') ? '\n' : '') + linea + '\n')
  return linea
}
