// Utilidades de las pruebas de paridad. Las pruebas no conocen la implementación: la reciben por un DESCRIPTOR
// (CAPTURA_IMPL=<ruta a un .mjs>; por defecto test/impl/captura-cli.mjs). Así las mismas pruebas corren contra
// captura-cli y contra cualquier implementación de referencia, sin que el repo nombre a ninguna.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
export const rutaImpl = process.env.CAPTURA_IMPL ? resolve(process.env.CAPTURA_IMPL) : join(aqui, '..', 'impl', 'captura-cli.mjs')
export const impl = (await import(pathToFileURL(rutaImpl).href)).default
if (impl.preparar) await impl.preparar()
export const RECETAS = join(aqui, 'fixtures', 'recetas')

const matarArbol = (pid) => {
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true, timeout: 15000 })
  else try { process.kill(-pid, 'SIGKILL') } catch {}
}

// Corre un escenario en un proceso propio, con tope de tiempo y sin stdin. Devuelve código, salidas y las rutas que
// la herramienta imprimió (captura:, informe:, recetas candidatas:).
export function correr(escenario, { args = [], env = {}, ms = 120000 } = {}) {
  const archivo = join(aqui, 'escenarios', escenario)
  return new Promise((ok) => {
    const t0 = Date.now()
    const p = spawn(process.execPath, [archivo, ...args], {
      cwd: impl.cwd || process.cwd(),
      env: { ...process.env, ...(impl.env ? impl.env() : {}), CAPTURA_IMPL: rutaImpl, CAPTURA_RECETAS: RECETAS, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      detached: process.platform !== 'win32',
    })
    let out = '', err = '', vencido = false
    p.stdout.on('data', (d) => { out += d })
    p.stderr.on('data', (d) => { err += d })
    const tope = setTimeout(() => { vencido = true; matarArbol(p.pid) }, ms)
    p.on('close', (code) => {
      clearTimeout(tope)
      const linea = (re) => [...out.matchAll(re)].map((m) => m[1].trim())
      ok({
        code, out, err, vencido, ms: Date.now() - t0,
        capturas: linea(/^captura: (.+?\.png)/gm),
        informe: linea(/^informe: (.+?informe\.md)/gm)[0] || '',
        candidatas: linea(/^recetas candidatas: (.+?recetas-candidatas\.md)/gm)[0] || '',
      })
    })
  })
}

export const leerJson = (f) => JSON.parse(readFileSync(f, 'utf8'))
export const esPng = (f) => existsSync(f) && statSync(f).size > 100 && readFileSync(f).subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
export const tiene = (impl.capacidades || [])
export const falta = (cap) => (tiene.includes(cap) ? false : `la implementación "${impl.nombre}" no declara la capacidad "${cap}"`)

// Lee píxeles de un PNG con el Chromium de Playwright (sin dependencias extra): [{x,y}] -> [[r,g,b,a]].
export async function pixeles(png, puntos) {
  const { chromium } = await import('playwright')
  const b = await chromium.launch()
  try {
    const page = await b.newPage()
    const src = 'data:image/png;base64,' + readFileSync(png).toString('base64')
    return await page.evaluate(async ({ src, puntos }) => {
      const img = new Image()
      img.src = src
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.width; c.height = img.height
      const g = c.getContext('2d')
      g.drawImage(img, 0, 0)
      return { ancho: img.width, alto: img.height, valores: puntos.map(({ x, y }) => [...g.getImageData(x, y, 1, 1).data]) }
    }, { src, puntos })
  } finally { await b.close() }
}
