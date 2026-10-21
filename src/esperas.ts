// Esperas por estado, nunca por tiempo.
import type { Locator, Page } from 'playwright'
import { foto } from './fotos.js'
import { limpiar, marcar } from './marcas.js'

// Desplegable cuyas opciones cargan después de abrirlo: reabre hasta que aparezca la opción.
export async function abrirSelectHasta(locator: Locator, texto: string | RegExp, { intentos = 6, ms = 4000 }: { intentos?: number; ms?: number } = {}): Promise<Locator> {
  const page = locator.page()
  for (let i = 0; i < intentos; i++) {
    await locator.click()
    const op = page.getByRole('option', { name: texto }).first()
    if (await op.waitFor({ timeout: ms }).then(() => true).catch(() => false)) return op
    await page.keyboard.press('Escape')
  }
  throw new Error(`abrirSelectHasta: la opción "${String(texto)}" no apareció tras ${intentos} intentos`)
}

// Botón deshabilitado mientras el sistema busca (p. ej. una fecha): espera a que se habilite.
// Desviación deliberada (docs/desviaciones.md): la referencia volvía enseguida sin esperar.
export async function esperarHabilitado(locator: Locator, ms = 30000): Promise<true> {
  const hasta = Date.now() + ms
  await locator.waitFor({ timeout: ms })
  const resto = Math.max(1, hasta - Date.now())
  await locator.page().waitForFunction((el) => !!el && !(el as HTMLButtonElement).disabled, await locator.elementHandle({ timeout: resto }), { timeout: resto })
  return true
}

// Toast efímero: espera su texto, lo devuelve y, si se pide, captura de inmediato (antes de que desaparezca).
export async function esperarToast(page: Page, patron: string | RegExp, { ms = 15000, foto: desc, leyenda }: { ms?: number; foto?: string; leyenda?: string } = {}): Promise<string> {
  const el = page.getByText(patron).first()
  await el.waitFor({ timeout: ms })
  const texto = (await el.innerText()).trim()
  if (desc) {
    await marcar(page, el, texto.slice(0, 60))
    await foto(page, desc, { leyenda: leyenda || `Aviso: ${texto.slice(0, 80)}` })
    await limpiar(page)
  }
  return texto
}
