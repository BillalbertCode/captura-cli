import { estado } from './estado.js';
// Corre en el navegador: se serializa con toString(), así que no puede usar nada de fuera.
function enNavegador() {
    const acc = (a) => { window.__acc(a); };
    const q = (s) => String(s).replace(/[\\']/g, '\\$&');
    const raro = (s) => !s || /[:«]|\d{3,}|^radix|^headlessui|^react-/.test(s);
    const rol = (t) => t.getAttribute('role') || { button: 'button', a: 'link' }[t.tagName.toLowerCase()] || '';
    const sel = (el) => {
        const t = el.closest('button,a,[role=button],[role=menuitem],[role=option],[role=tab],[role=checkbox],[role=switch],input,textarea,select,label') || el;
        const tag = t.tagName.toLowerCase();
        const txt = (t.innerText || t.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
        const tid = t.getAttribute('data-testid'), ph = t.getAttribute('placeholder'), aria = t.getAttribute('aria-label'), nm = t.getAttribute('name');
        if (tid)
            return "page.locator('[data-testid=\"" + tid + "\"]')";
        if (rol(t) && txt)
            return "page.getByRole('" + rol(t) + "', { name: '" + q(txt) + "' })";
        if (ph)
            return "page.getByPlaceholder('" + q(ph) + "')";
        if (aria)
            return "page.getByLabel('" + q(aria) + "')";
        if (nm)
            return "page.locator('" + tag + "[name=\"" + nm + "\"]')";
        if (t.id && !raro(t.id))
            return "page.locator('#" + t.id + "')";
        if (txt)
            return "page.getByText('" + q(txt) + "').first()";
        return "page.locator('" + tag + "') /* sin selector estable: revisar */";
    };
    const esTexto = (t) => (t.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|file)$/.test(t.type)) || t.tagName === 'TEXTAREA';
    document.addEventListener('click', (e) => {
        const t = e.target;
        if (!t || !t.closest)
            return;
        const c = t.closest('input,textarea,select') || t;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(c.tagName) && !/^(checkbox|radio|button|submit)$/.test(c.type || ''))
            return;
        acc({ t: 'click', sel: sel(t) });
    }, true);
    document.addEventListener('change', (e) => {
        const t = e.target;
        if (t.tagName === 'SELECT')
            acc({ t: 'select', sel: sel(t), valor: (t.options[t.selectedIndex] || { text: '' }).text || t.value });
    }, true);
    // 'input' (no 'change'): queda en el orden real, no al salir del campo. Las entradas seguidas del mismo campo se funden.
    document.addEventListener('input', (e) => {
        const t = e.target;
        if (esTexto(t))
            acc({ t: 'fill', sel: sel(t), valor: t.type === 'password' ? '<clave>' : t.value });
    }, true);
}
const SCRIPT_GRABAR = '(' + enNavegador.toString() + ')()';
export async function grabarAcciones(ctx, page) {
    const e = estado(page);
    e.grabar = true;
    await ctx.exposeBinding('__acc', (_src, a) => {
        if (!e.grabar)
            return;
        const ult = e.acciones[e.acciones.length - 1];
        if (a.t === 'fill' && ult && ult.t === 'fill' && ult.sel === a.sel)
            ult.valor = a.valor;
        else
            e.acciones.push(a);
    });
    await ctx.addInitScript(SCRIPT_GRABAR);
    const ir = page.goto.bind(page);
    page.goto = (url, o) => {
        e.ultimoPaso = `ir a ${url}`;
        if (e.grabar) {
            let u = String(url);
            try {
                const x = new URL(u);
                if (x.origin === (e.app ? new URL(e.app.baseUrl).origin : x.origin))
                    u = x.pathname + x.search;
            }
            catch { /* ruta relativa */ }
            e.acciones.push({ t: 'ir', url: u });
        }
        return ir(url, o);
    };
}
/** Tramos con acciones propias (no hechas por una receta): lo que todavía no es receta. */
export const sinReceta = (page) => estado(page).tramos.filter((t) => t.acciones.some((a) => a.t !== 'receta'));
