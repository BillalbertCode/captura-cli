import { ctx } from './contexto.js';
import { estado } from './estado.js';
export async function marcar(page, locator, texto, { lado = 'abajo', numero } = {}) {
    await locator.scrollIntoViewIfNeeded();
    const b = await locator.boundingBox();
    if (!b)
        throw new Error('marcar: el elemento no tiene caja visible');
    await pintar(page, b, texto, lado, numero);
    const e = estado(page);
    e.marcas.push({ locator, texto, lado, numero });
    e.ultimoPaso = `marcar "${texto}"`;
}
const dentroDelViewport = (b, vp) => !!b && b.x + b.width > 0 && b.x < vp.width && b.y + b.height > 0 && b.y < vp.height;
/** Re-mide y vuelve a dibujar todas las marcas registradas. Devuelve [{texto, x, y, w, h, zona}] (texto, sin imagen). */
export async function redibujarMarcas(page) {
    await page.evaluate(() => document.querySelectorAll('.__marca').forEach((e) => e.remove()));
    const vp = page.viewportSize() || ctx().cfg.viewport;
    const marcas = estado(page).marcas;
    for (const m of marcas) { // 1) acercar al viewport lo que quedó fuera o bajo la franja de leyenda
        const b = await m.locator.boundingBox().catch(() => null);
        if (!b || !dentroDelViewport(b, vp) || b.y < 40)
            await m.locator.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' })).catch(() => { });
    }
    const out = [];
    for (const m of marcas) { // 2) medir y dibujar con la posición final
        const b = await m.locator.boundingBox().catch(() => null);
        if (!b)
            throw new Error(`marca "${m.texto}": el elemento ya no está en la página; volver a marcar`);
        if (!dentroDelViewport(b, vp))
            throw new Error(`marca "${m.texto}": el elemento quedó fuera del viewport (x=${Math.round(b.x)}, y=${Math.round(b.y)}); no se pudo traer a la vista`);
        await pintar(page, b, m.texto, m.lado, m.numero);
        const zona = (await m.locator.innerText({ timeout: 1500 }).catch(() => '')).replace(/\s+/g, ' ').slice(0, 80);
        out.push({ texto: m.texto || '', x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), zona });
    }
    return out;
}
async function pintar(page, b, texto, lado, numero) {
    await page.evaluate(({ b, texto, lado, numero }) => {
        const p = 8;
        const mk = (css, txt) => {
            const e = document.createElement('div');
            e.className = '__marca';
            e.style.cssText = `position:fixed;z-index:99999;pointer-events:none;${css}`;
            if (txt)
                e.textContent = txt;
            document.body.appendChild(e);
        };
        mk(`border:3px solid #e11d1d;border-radius:14px;background:rgba(225,29,29,.06);left:${b.x - p}px;top:${b.y - p}px;width:${b.width + 2 * p}px;height:${b.height + 2 * p}px`);
        const etiqueta = (numero ? `${numero}. ` : '') + (texto || '');
        if (!etiqueta)
            return;
        const W = 290;
        const pos = {
            abajo: [b.x - p, b.y + b.height + p + 6],
            arriba: [b.x - p, b.y - p - 34],
            izq: [b.x - p - W - 8, b.y],
            der: [b.x + b.width + p + 8, b.y],
            dentro: [b.x + 4, b.y + 4],
        }[lado];
        const left = Math.max(8, Math.min(pos[0], innerWidth - W - 8));
        const top = Math.max(42, Math.min(pos[1], innerHeight - 40)); // 42: debajo de la franja de leyenda de foto()
        mk(`background:#e11d1d;color:#fff;font:600 14px sans-serif;padding:4px 10px;border-radius:6px;left:${left}px;top:${top}px;max-width:${W}px`, etiqueta);
    }, { b, texto, lado, numero });
}
export const limpiar = (page) => {
    estado(page).marcas = [];
    return page.evaluate(() => document.querySelectorAll('.__marca').forEach((e) => e.remove()));
};
