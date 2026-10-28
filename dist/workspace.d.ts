import { type Registro } from './almacen.js';
/** Esquema de captura.config.json para el editor (autocompletado y validación). */
export declare const ESQUEMA = "https://raw.githubusercontent.com/BillalbertCode/captura-cli/main/schema/captura.config.schema.json";
export declare function mensajeWorkspaceNuevo(raiz: string): string;
/**
 * ¿Hay una persona al teclado? Sí en una terminal interactiva. CAPTURA_INTERACTIVO=1 fuerza preguntar leyendo stdin
 * (respuestas por tubería: `printf 'S\n\n\n\n\n' | CAPTURA_INTERACTIVO=1 captura-cli config`); =0 nunca pregunta.
 * Un agente no tiene teclado: ahí la herramienta no pregunta, sale con WORKSPACE_NUEVO (6) y las preguntas.
 */
export declare function hayTeclado(): boolean;
/**
 * Registra el workspace preguntando en la terminal: las mismas tres cosas que imprime WORKSPACE_NUEVO, más, solo la
 * primera vez en la máquina, la ruta base de las salidas de todos los workspaces. Devuelve false si la persona
 * prefiere no configurarlo ahora, cancela o la entrada se cierra: en ese caso no se registra nada.
 * `confirmar: false` salta el «¿configurarla ahora?» (cuando la persona ya lo pidió con `init`).
 */
export declare function configurarInteractivo(raiz: string, { confirmar }?: {
    confirmar?: boolean;
}): Promise<boolean>;
export interface OpcionesInit {
    salidas: string;
    /** Conserva «valor por defecto» al volver a registrar con la ruta literal (config proyecto|estadisticas). */
    salidasPorDefecto?: boolean;
    proyecto?: string;
    estadisticas?: boolean;
}
/** De dónde sale la carpeta de salidas: la ruta propia del workspace manda; la global es solo el valor por defecto. */
export declare function origenSalidas(porDefecto: boolean): string;
/** Registra el workspace. Devuelve el registro y avisos para imprimir (exclusiones de git agregadas). */
export declare function registrar(raiz: string, o: OpcionesInit): {
    registro: Registro;
    avisos: string[];
};
