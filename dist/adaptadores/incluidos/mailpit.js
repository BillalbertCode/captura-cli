// builtin:mailpit — correo de solo lectura desde una instancia de Mailpit. Opciones:
//   url?: "http://host:8025"    variable?: nombre de la variable de entorno con la URL (CAPTURA_MAILPIT_URL)
import { FALTA_CONFIGURACION } from '../contrato.js';
export class CorreoSinConfigurar extends Error {
    variable;
    constructor(variable) { super(`definir ${variable} (URL de Mailpit) o adaptadores.correo.url`); this.variable = variable; this.name = FALTA_CONFIGURACION; }
}
const fabrica = {
    contrato: 1,
    tipo: 'correo',
    crear(opciones) {
        const variable = typeof opciones['variable'] === 'string' ? opciones['variable'] : 'CAPTURA_MAILPIT_URL';
        const url = () => (typeof opciones['url'] === 'string' ? opciones['url'] : process.env[variable]) || undefined;
        return {
            url,
            async buscar({ buscar, destinatario, asunto }) {
                const base = url();
                if (!base)
                    throw new CorreoSinConfigurar(variable);
                const q = buscar || [destinatario && `to:${destinatario}`, asunto && `subject:"${asunto}"`].filter(Boolean).join(' ');
                const r = await fetch(`${base}/api/v1/search?query=${encodeURIComponent(q)}&limit=10`, { signal: AbortSignal.timeout(15000) });
                if (!r.ok)
                    throw new Error(`mailpit ${r.status}`);
                const lista = (await r.json()).messages ?? [];
                const out = [];
                for (const m of lista) {
                    const d = (await (await fetch(`${base}/api/v1/message/${m.ID}`, { signal: AbortSignal.timeout(15000) })).json());
                    out.push({
                        id: m.ID, asunto: d.Subject ?? '', para: (d.To ?? []).map((x) => x.Address), fecha: d.Date ?? '',
                        adjuntos: (d.Attachments ?? []).map((a) => ({ nombre: a.FileName, tipo: a.ContentType, bytes: a.Size })),
                    });
                }
                console.log(`mailpit: ${out.length} correo(s) para "${q}"`);
                return out;
            },
        };
    },
};
export default fabrica;
