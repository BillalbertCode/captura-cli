// Registro de un workspace la primera vez que se usa. Quien invoca suele ser un agente sin teclado: el CLI y la API
// salen con WORKSPACE_NUEVO (código 6) e imprimen las preguntas y los valores propuestos; el agente se las hace al
// usuario y ejecuta `captura-cli init --yes …`. La respuesta queda guardada y se cambia con `captura-cli config`.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { dirWorkspace, excluirDeGit, guardarConfigUsuario, guardarRegistro, home, idWorkspace, leerConfigUsuario, leerRegistro, propuesta } from './almacen.js';
import { VERSION } from './version.js';
/** Esquema de captura.config.json para el editor (autocompletado y validación). */
export const ESQUEMA = 'https://raw.githubusercontent.com/BillalbertCode/captura-cli/main/schema/captura.config.schema.json';
export function mensajeWorkspaceNuevo(raiz) {
    const p = propuesta(raiz);
    return [
        `WORKSPACE_NUEVO: ${raiz} no está registrado en ${home()}.`,
        'Preguntale al usuario estas tres cosas y después ejecutá el comando de abajo con sus respuestas:',
        `  1. salidas: ¿dónde van las capturas e informes? "global" (recomendado, fuera del repo: ${p.salidasGlobal}) o una ruta propia.`,
        `  2. proyecto: ¿dónde viven captura.config.json, adaptadores/ y recetas/? propuesto: ${p.proyecto}`,
        '     (una carpeta del repo si el equipo los comparte; la herramienta no escribe nada en el repo por su cuenta)',
        '  3. estadisticas: ¿registrar estadísticas de uso locales (no se envían a ningún lado)? propuesto: si',
        `captura-cli init --yes --salidas global --proyecto "${p.proyecto}" --estadisticas si`,
    ].join('\n');
}
/**
 * ¿Hay una persona al teclado? Sí en una terminal interactiva. CAPTURA_INTERACTIVO=1 fuerza preguntar leyendo stdin
 * (respuestas por tubería: `printf 'S\n\n\n\n\n' | CAPTURA_INTERACTIVO=1 captura-cli config`); =0 nunca pregunta.
 * Un agente no tiene teclado: ahí la herramienta no pregunta, sale con WORKSPACE_NUEVO (6) y las preguntas.
 */
export function hayTeclado() {
    const v = process.env['CAPTURA_INTERACTIVO'];
    if (v === '0')
        return false;
    if (v === '1')
        return true;
    return !!process.stdin.isTTY && !!process.stdout.isTTY;
}
/**
 * Preguntas una a una con una cola de respuestas. `readline.question` pierde las líneas que llegan antes de la
 * siguiente pregunta (respuestas por tubería o pegadas de golpe): aquí se guardan en una cola. Devuelve null si la
 * entrada se cerró o se canceló (Ctrl+C) antes de contestar: no hay quién responda.
 */
function crearPreguntador(rl) {
    const cola = [];
    let cerrado = false;
    let espera = null;
    const sinTerminal = !process.stdin.isTTY;
    rl.on('line', (l) => {
        const r = l.trim();
        if (!espera) {
            cola.push(r);
            return;
        }
        const e = espera;
        espera = null;
        if (sinTerminal)
            process.stdout.write('\n'); // nada hace eco de la respuesta: se separa la siguiente salida
        e(r);
    });
    rl.on('close', () => { cerrado = true; const e = espera; espera = null; e?.(null); });
    rl.on('SIGINT', () => rl.close());
    return (pregunta) => new Promise((ok) => {
        const siguiente = cola.shift();
        if (siguiente !== undefined) {
            process.stdout.write(`${pregunta}${sinTerminal ? '\n' : ''}`);
            ok(siguiente);
            return;
        }
        if (cerrado) {
            ok(null);
            return;
        }
        espera = ok;
        rl.setPrompt(pregunta);
        rl.prompt();
    });
}
/**
 * Registra el workspace preguntando en la terminal: las mismas tres cosas que imprime WORKSPACE_NUEVO, más, solo la
 * primera vez en la máquina, la ruta base de las salidas de todos los workspaces. Devuelve false si la persona
 * prefiere no configurarlo ahora, cancela o la entrada se cierra: en ese caso no se registra nada.
 * `confirmar: false` salta el «¿configurarla ahora?» (cuando la persona ya lo pidió con `init`).
 */
export async function configurarInteractivo(raiz, { confirmar = true } = {}) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const preguntar = crearPreguntador(rl);
    try {
        if (confirmar) {
            console.log(`Esta carpeta no está configurada en captura-cli:\n  ${raiz}\ncaptura-cli guarda aquí lo que necesita de este workspace (salidas, proyecto, estadísticas); no escribe nada en tu repo.`);
            const r = await preguntar('¿Configurarla ahora? [S/n]: ');
            if (r === null || /^n/i.test(r))
                return false;
        }
        const u = leerConfigUsuario();
        if (u.salidasBasePreguntada !== true) {
            console.log(`Primera vez en esta máquina. Las salidas (capturas e informes) de cada workspace van, por defecto, a ${home()}.`);
            const r = await preguntar('¿Otra carpeta base para las salidas de TODOS tus workspaces? (Enter = esa): ');
            if (r === null)
                return false;
            guardarConfigUsuario({ ...u, ...(r ? { salidasBase: resolve(r) } : {}), salidasBasePreguntada: true });
        }
        const p = propuesta(raiz);
        console.log(`Salidas de este workspace — Enter = ${p.salidasGlobal}`);
        const salidas = await preguntar('Ruta para otra carpeta (o Enter): ');
        if (salidas === null)
            return false;
        console.log(`Proyecto (captura.config.json, adaptadores, recetas) — Enter = ${p.proyecto}`);
        const proyecto = await preguntar('Ruta para otra carpeta (o Enter): ');
        if (proyecto === null)
            return false;
        const est = await preguntar('¿Registrar estadísticas de uso locales (no se envían a ningún lado)? [S/n]: ');
        if (est === null)
            return false;
        const { avisos } = registrar(raiz, { salidas: salidas || 'global', ...(proyecto ? { proyecto } : {}), estadisticas: !/^n/i.test(est) });
        for (const a of avisos)
            console.log(a);
        return true;
    }
    finally {
        rl.close();
    }
}
/** Registra el workspace. Devuelve el registro y avisos para imprimir (exclusiones de git agregadas). */
export function registrar(raiz, o) {
    const p = propuesta(raiz);
    const salidas = o.salidas === 'global' ? p.salidasGlobal : resolve(o.salidas);
    const proyecto = resolve(o.proyecto ?? p.proyecto);
    const avisos = [];
    mkdirSync(salidas, { recursive: true });
    mkdirSync(join(proyecto, 'recetas'), { recursive: true });
    mkdirSync(join(proyecto, 'adaptadores'), { recursive: true });
    const cfg = join(proyecto, 'captura.config.json');
    if (!existsSync(cfg)) {
        writeFileSync(cfg, JSON.stringify({ $schema: ESQUEMA, apps: {} }, null, 2) + '\n');
        avisos.push(`config: creado ${cfg} (declarar las apps a probar)`);
    }
    const ex = excluirDeGit(salidas);
    if (ex)
        avisos.push(`salidas dentro de un repo: agregado "${ex}" a .git/info/exclude (el .gitignore no se toca)`);
    const ahora = new Date().toISOString();
    const previo = leerRegistro(raiz);
    const registro = {
        version: 1, origen: raiz, nombre: idWorkspace(raiz), registrado: previo?.registrado ?? ahora, ultimoUso: ahora,
        salidas, proyecto, estadisticas: o.estadisticas ?? true,
    };
    guardarRegistro(raiz, { ...registro, ...{ cli: VERSION } });
    avisos.push(`workspace registrado: ${dirWorkspace(raiz)}`);
    return { registro, avisos };
}
