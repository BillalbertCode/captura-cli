import { estado } from './estado.js';
// Espera por contenido, no por tiempo (una SPA puede tardar hasta ~40 s en la primera carga).
export const esperarTexto = (page, texto, ms = 45000) => page.getByText(texto).first().waitFor({ timeout: ms });
// Ante una falla: texto, URL, botones y cookies (nombres). Barato y suficiente para decidir; no reintentar a ciegas.
export async function diagnostico(page, { max = 400 } = {}) {
    const url = page.url();
    const texto = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, max);
    const botones = (await page.getByRole('button').allInnerTexts().catch(() => [])).filter(Boolean).slice(0, 30);
    const cookies = (await page.context().cookies()).map((c) => c.name);
    console.log(`diagnostico: url=${url}
  texto=${texto}
  botones=${botones.slice(0, 15).join(' | ')}
  cookies=${cookies.join(',')}`);
    return { url, texto, botones, cookies };
}
// Validaciones silenciosas: campos inválidos (aria-invalid o la validación nativa) y mensajes de error visibles.
// Sirve cuando "Siguiente" o "Consultar" no hace nada y no hay ninguna petición: casi siempre es un campo inválido.
export async function detectarErrores(page) {
    return page.evaluate(() => {
        const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
        const limpio = (t) => (t || '').replace(/\s+/g, ' ').trim().slice(0, 160);
        const porIds = (ids) => (ids || '').split(/\s+/).map((i) => limpio(document.getElementById(i)?.textContent)).filter(Boolean).join(' · ');
        const out = [];
        const vistos = new Set();
        const campos = [...document.querySelectorAll('input,select,textarea,[role=textbox],[role=combobox],[role=checkbox],[role=radio]')];
        for (const el of campos) {
            if (!visible(el))
                continue;
            const f = el;
            const aria = el.getAttribute('aria-invalid') === 'true';
            const nativo = !!f.validity && !f.validity.valid;
            if (!aria && !nativo)
                continue;
            const nombre = limpio(f.labels?.[0]?.innerText || el.getAttribute('aria-label') || f.placeholder || f.name || el.id || el.tagName.toLowerCase());
            const msg = porIds(el.getAttribute('aria-errormessage')) || porIds(el.getAttribute('aria-describedby')) || limpio(f.validationMessage) || (aria ? 'aria-invalid' : 'no cumple la validación');
            vistos.add(msg);
            out.push(`campo "${nombre}"${f.pattern ? ` (patrón ${f.pattern})` : ''}: ${msg}`);
        }
        const avisos = [...document.querySelectorAll('[role=alert],[aria-live=assertive],[class*=error i],[class*=invalid i],[class*=danger i]')];
        for (const el of avisos) {
            if (!visible(el) || out.length >= 20)
                continue;
            const t = limpio(el.innerText);
            if (!t || t.length > 160 || vistos.has(t))
                continue;
            vistos.add(t);
            out.push(`mensaje: "${t}"`);
        }
        return out;
    });
}
// Exploración barata para hallar selectores: lista compacta de lo interactivo y los títulos de la pantalla, con un
// selector sugerido por elemento. La primera llamada en una ruta imprime todo (tope `max`); las siguientes en la
// misma ruta imprimen SOLO lo que apareció (+) o desapareció (-) desde la llamada anterior, así un reintento no
// repite el volcado. `completo: true` fuerza el listado entero.
// `errores: true` agrega los campos inválidos y los mensajes de error visibles (ver detectarErrores).
export async function explorar(page, { max = 40, completo = false, errores = false } = {}) {
    const info = await page.evaluate(() => {
        const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
        const rol = (el) => el.getAttribute('role') || { BUTTON: 'button', A: 'link', SELECT: 'combobox', TEXTAREA: 'textbox' }[el.tagName] || (el.tagName === 'INPUT' ? { checkbox: 'checkbox', radio: 'radio', submit: 'button', button: 'button' }[el.type] || 'textbox' : 'elemento');
        const nombre = (el) => (el.getAttribute('aria-label') || el.placeholder || el.innerText || el.value || el.name || '').replace(/\s+/g, ' ').trim().slice(0, 50);
        const els = [...document.querySelectorAll('button,a[href],input,select,textarea,[role=button],[role=tab],[role=menuitem],[role=checkbox],[role=combobox],[role=option],[data-testid]')].filter(visible);
        const items = els.map((el) => ({ rol: rol(el), nombre: nombre(el), testid: el.getAttribute('data-testid') || '', ph: el.placeholder || '', nm: el.getAttribute('name') || '', off: el.disabled === true }));
        const titulos = [...document.querySelectorAll('h1,h2,h3')].filter(visible).map((h) => h.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 6);
        return { items, titulos };
    });
    const sel = (i) => i.testid ? `[data-testid="${i.testid}"]`
        : ['button', 'link', 'tab', 'checkbox', 'menuitem', 'option', 'radio'].includes(i.rol) && i.nombre ? `getByRole('${i.rol}',{name:'${i.nombre}'})`
            : i.ph ? `input[placeholder="${i.ph}"]` : i.nm ? `[name="${i.nm}"]` : '';
    const lineas = new Set();
    for (const i of info.items)
        lineas.add(`${i.rol}${i.off ? '(deshab.)' : ''} "${i.nombre}"${sel(i) ? `  ${sel(i)}` : ''}`);
    const ruta = new URL(page.url()).pathname;
    const e = estado(page);
    const previo = e.explorado;
    const mismaRuta = !!previo && previo.ruta === ruta && !completo;
    const nuevas = [...lineas].filter((l) => !mismaRuta || !previo.lineas.has(l));
    const quitadas = mismaRuta ? [...previo.lineas].filter((l) => !lineas.has(l)) : [];
    e.explorado = { ruta, lineas };
    console.log(`explorar ${ruta} | títulos: ${info.titulos.join(' ; ') || '(ninguno)'}${mismaRuta ? ' | cambios desde la anterior' : ''}`);
    if (mismaRuta && !nuevas.length && !quitadas.length)
        console.log('  = sin cambios');
    nuevas.slice(0, max).forEach((l) => console.log(`  ${mismaRuta ? '+ ' : ''}${l}`));
    if (nuevas.length > max)
        console.log(`  … +${nuevas.length - max} más (usar max o completo)`);
    quitadas.slice(0, max).forEach((l) => console.log(`  - ${l}`));
    if (!errores)
        return { titulos: info.titulos, nuevas, quitadas };
    const err = await detectarErrores(page);
    console.log(err.length ? `errores: ${err.length}` : 'errores: ninguno visible');
    err.forEach((l) => console.log(`  ! ${l}`));
    return { titulos: info.titulos, nuevas, quitadas, errores: err };
}
// Éxito estricto: espera el texto de confirmación DENTRO de un ámbito (por defecto avisos/diálogos: role status,
// alert, dialog), nunca como subcadena suelta de toda la página (un texto parecido en otro lado da un falso OK).
// Un string se compara completo (exacto); para parcial, usar una regex /…/i.
export async function esperarExito(page, patron, { dentro, ms = 20000 } = {}) {
    const ambito = dentro || page.locator('[role=status],[role=alert],[role=dialog],[data-sonner-toast],[class*=toast i]');
    const el = ambito.getByText(patron, typeof patron === 'string' ? { exact: true } : {}).first();
    await el.waitFor({ timeout: ms });
    return (await el.innerText()).trim();
}
