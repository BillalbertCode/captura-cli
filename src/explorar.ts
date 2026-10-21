// Exploración y esperas por contenido. Barato en tokens: texto, nunca imágenes.
import type { Locator, Page } from 'playwright'
import { estado } from './estado.js'

// Espera por contenido, no por tiempo (una SPA puede tardar hasta ~40 s en la primera carga).
export const esperarTexto = (page: Page, texto: string | RegExp, ms = 45000): Promise<void> => page.getByText(texto).first().waitFor({ timeout: ms })

// Ante una falla: texto, URL, botones y cookies (nombres). Barato y suficiente para decidir; no reintentar a ciegas.
export async function diagnostico(page: Page, { max = 400 }: { max?: number } = {}): Promise<{ url: string; texto: string; botones: string[]; cookies: string[] }> {
  const url = page.url()
  const texto = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, max)
  const botones = (await page.getByRole('button').allInnerTexts().catch(() => [] as string[])).filter(Boolean).slice(0, 30)
  const cookies = (await page.context().cookies()).map((c) => c.name)
  console.log(`diagnostico: url=${url}
  texto=${texto}
  botones=${botones.slice(0, 15).join(' | ')}
  cookies=${cookies.join(',')}`)
  return { url, texto, botones, cookies }
}

interface Item { rol: string; nombre: string; testid: string; ph: string; nm: string; off: boolean }

// Exploración barata para hallar selectores: lista compacta de lo interactivo y los títulos de la pantalla, con un
// selector sugerido por elemento. La primera llamada en una ruta imprime todo (tope `max`); las siguientes en la
// misma ruta imprimen SOLO lo que apareció (+) o desapareció (-) desde la llamada anterior, así un reintento no
// repite el volcado. `completo: true` fuerza el listado entero.
export async function explorar(page: Page, { max = 40, completo = false }: { max?: number; completo?: boolean } = {}): Promise<{ titulos: string[]; nuevas: string[]; quitadas: string[] }> {
  const info = await page.evaluate(() => {
    const visible = (el: Element): boolean => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
    const rol = (el: Element): string => el.getAttribute('role') || ({ BUTTON: 'button', A: 'link', SELECT: 'combobox', TEXTAREA: 'textbox' } as Record<string, string>)[el.tagName] || (el.tagName === 'INPUT' ? ({ checkbox: 'checkbox', radio: 'radio', submit: 'button', button: 'button' } as Record<string, string>)[(el as HTMLInputElement).type] || 'textbox' : 'elemento')
    const nombre = (el: Element): string => (el.getAttribute('aria-label') || (el as HTMLInputElement).placeholder || (el as HTMLElement).innerText || (el as HTMLInputElement).value || (el as HTMLInputElement).name || '').replace(/\s+/g, ' ').trim().slice(0, 50)
    const els = [...document.querySelectorAll('button,a[href],input,select,textarea,[role=button],[role=tab],[role=menuitem],[role=checkbox],[role=combobox],[role=option],[data-testid]')].filter(visible)
    const items = els.map((el) => ({ rol: rol(el), nombre: nombre(el), testid: el.getAttribute('data-testid') || '', ph: (el as HTMLInputElement).placeholder || '', nm: el.getAttribute('name') || '', off: (el as HTMLButtonElement).disabled === true }))
    const titulos = [...document.querySelectorAll('h1,h2,h3')].filter(visible).map((h) => (h as HTMLElement).innerText.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 6)
    return { items, titulos }
  })
  const sel = (i: Item): string => i.testid ? `[data-testid="${i.testid}"]`
    : ['button', 'link', 'tab', 'checkbox', 'menuitem', 'option', 'radio'].includes(i.rol) && i.nombre ? `getByRole('${i.rol}',{name:'${i.nombre}'})`
      : i.ph ? `input[placeholder="${i.ph}"]` : i.nm ? `[name="${i.nm}"]` : ''
  const lineas = new Set<string>()
  for (const i of info.items) lineas.add(`${i.rol}${i.off ? '(deshab.)' : ''} "${i.nombre}"${sel(i) ? `  ${sel(i)}` : ''}`)
  const ruta = new URL(page.url()).pathname
  const e = estado(page)
  const previo = e.explorado
  const mismaRuta = !!previo && previo.ruta === ruta && !completo
  const nuevas = [...lineas].filter((l) => !mismaRuta || !previo.lineas.has(l))
  const quitadas = mismaRuta ? [...previo.lineas].filter((l) => !lineas.has(l)) : []
  e.explorado = { ruta, lineas }
  console.log(`explorar ${ruta} | títulos: ${info.titulos.join(' ; ') || '(ninguno)'}${mismaRuta ? ' | cambios desde la anterior' : ''}`)
  if (mismaRuta && !nuevas.length && !quitadas.length) console.log('  = sin cambios')
  nuevas.slice(0, max).forEach((l) => console.log(`  ${mismaRuta ? '+ ' : ''}${l}`))
  if (nuevas.length > max) console.log(`  … +${nuevas.length - max} más (usar max o completo)`)
  quitadas.slice(0, max).forEach((l) => console.log(`  - ${l}`))
  return { titulos: info.titulos, nuevas, quitadas }
}

// Éxito estricto: espera el texto de confirmación DENTRO de un ámbito (por defecto avisos/diálogos: role status,
// alert, dialog), nunca como subcadena suelta de toda la página (un texto parecido en otro lado da un falso OK).
// Un string se compara completo (exacto); para parcial, usar una regex /…/i.
export async function esperarExito(page: Page, patron: string | RegExp, { dentro, ms = 20000 }: { dentro?: Locator; ms?: number } = {}): Promise<string> {
  const ambito = dentro || page.locator('[role=status],[role=alert],[role=dialog],[data-sonner-toast],[class*=toast i]')
  const el = ambito.getByText(patron, typeof patron === 'string' ? { exact: true } : {}).first()
  await el.waitFor({ timeout: ms })
  return (await el.innerText()).trim()
}
