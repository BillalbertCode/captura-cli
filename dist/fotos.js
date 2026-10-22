// Captura del viewport (lo que ve el usuario; fullPage corta sidebar/header fijos). Devuelve la ruta.
// Toda captura sale con LEYENDA (franja arriba, dentro de la imagen) y con MARCA ROJA activa (marcar() antes):
//   foto(page, 'descripcion', { leyenda: 'qué se ve y por qué importa' })
// Sin leyenda o sin marca lanza error. Única salida: { sinMarca: 'motivo' }, SOLO si el usuario pidió
// una captura sin marca; el motivo queda en el informe.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { estado } from './estado.js';
import { redibujarMarcas } from './marcas.js';
export const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
export async function foto(page, descripcion, { completa = false, leyenda, sinMarca } = {}) {
    if (!leyenda || !String(leyenda).trim())
        throw new Error(`foto("${descripcion}"): falta { leyenda } — toda captura lleva leyenda`);
    if (sinMarca !== undefined && !(typeof sinMarca === 'string' && sinMarca.trim())) {
        throw new Error(`foto("${descripcion}"): sinMarca exige un motivo (texto); solo si el usuario pidió una captura sin marca`);
    }
    const e = estado(page);
    const detalle = e.marcas.length ? await redibujarMarcas(page) : [];
    const marcas = detalle.length;
    if (!marcas && !sinMarca)
        throw new Error(`foto("${descripcion}"): no hay marca roja activa — usar marcar() antes (o { sinMarca: 'motivo' } si el usuario lo pidió)`);
    const n = readdirSync(e.dir).filter((f) => /^step\d+-/.test(f)).length + 1;
    const nn = String(n).padStart(2, '0');
    const ruta = join(e.dir, `step${nn}-${slug(descripcion)}.png`);
    const texto = `Paso ${nn} · ${String(leyenda).trim()}`;
    await page.evaluate((txt) => {
        const d = document.createElement('div');
        d.className = '__leyenda';
        d.style.cssText = 'position:fixed;z-index:100000;left:0;right:0;top:0;pointer-events:none;background:rgba(17,24,39,.92);color:#fff;font:600 14px sans-serif;padding:7px 14px';
        d.textContent = txt;
        document.body.appendChild(d);
    }, texto);
    try {
        await page.screenshot({ path: ruta, fullPage: completa });
    }
    finally {
        await page.evaluate(() => document.querySelectorAll('.__leyenda').forEach((x) => x.remove())).catch(() => { });
    }
    const url = (() => { try {
        return new URL(page.url()).pathname;
    }
    catch {
        return '';
    } })();
    e.tramos.push({ foto: `step${nn}-${slug(descripcion)}`, leyenda: String(leyenda).trim(), url, marca: detalle[0]?.texto || '', acciones: e.acciones.splice(0) });
    e.fotos.push({ ruta, paso: n, leyenda: String(leyenda).trim(), marcada: marcas > 0, sinMarca: sinMarca || '', marcas: detalle });
    e.ultimoPaso = `foto step${nn}-${slug(descripcion)}`;
    console.log(`captura: ${ruta}${marcas ? '' : ` (sin marca: ${sinMarca})`}`);
    // Modo texto: dónde quedó cada marca y qué dice el elemento, para no abrir el PNG.
    detalle.forEach((m, i) => console.log(`  marca ${i + 1} "${m.texto}" en (${m.x},${m.y}) ${m.w}x${m.h} dentro del viewport; contenido: "${m.zona}"`));
    return ruta;
}
export const paso = foto; // nombre histórico
