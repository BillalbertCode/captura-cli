import { foto } from './fotos.js';
import { limpiar, marcar } from './marcas.js';
// Desplegable cuyas opciones cargan después de abrirlo: reabre hasta que aparezca la opción.
// react-select (el input con aria-label): el elemento se trae a la vista, se enfoca y se abre con ArrowDown; el clic
// solo no siempre abre el menú, y con `force: true` el elemento puede quedar fuera del viewport.
export async function abrirSelectHasta(locator, texto, { intentos = 6, ms = 4000 } = {}) {
    const page = locator.page();
    const op = () => page.getByRole('option', { name: texto }).first();
    const appeared = async () => op().waitFor({ timeout: ms }).then(() => true).catch(() => false);
    for (let i = 0; i < intentos; i++) {
        await locator.scrollIntoViewIfNeeded().catch(() => { });
        await locator.click().catch(() => { });
        if (await appeared())
            return op();
        await locator.focus().catch(() => { });
        await page.keyboard.press('ArrowDown');
        if (await appeared())
            return op();
        await page.keyboard.press('Escape');
    }
    throw new Error(`abrirSelectHasta: la opción "${String(texto)}" no apareció tras ${intentos} intentos (react-select: getByLabel exacto -> scrollIntoViewIfNeeded -> focus -> ArrowDown -> getByRole('option') -> clic)`);
}
// Botón deshabilitado mientras el sistema busca (p. ej. una fecha): espera a que se habilite.
// Desviación deliberada (docs/desviaciones.md): la referencia volvía enseguida sin esperar.
export async function esperarHabilitado(locator, ms = 30000) {
    const hasta = Date.now() + ms;
    await locator.waitFor({ timeout: ms });
    const resto = Math.max(1, hasta - Date.now());
    await locator.page().waitForFunction((el) => !!el && !el.disabled, await locator.elementHandle({ timeout: resto }), { timeout: resto });
    return true;
}
// Toast efímero: espera su texto, lo devuelve y, si se pide, captura de inmediato (antes de que desaparezca).
export async function esperarToast(page, patron, { ms = 15000, foto: desc, leyenda } = {}) {
    const el = page.getByText(patron).first();
    await el.waitFor({ timeout: ms });
    const texto = (await el.innerText()).trim();
    if (desc) {
        await marcar(page, el, texto.slice(0, 60));
        await foto(page, desc, { leyenda: leyenda || `Aviso: ${texto.slice(0, 80)}` });
        await limpiar(page);
    }
    return texto;
}
