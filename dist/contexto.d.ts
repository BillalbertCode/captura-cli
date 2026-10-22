import type { Adaptadores } from './adaptadores/contrato.js';
import { type Registro } from './almacen.js';
import { type Config } from './config.js';
export interface Rutas {
    /** Carpeta de las capturas: una subcarpeta por id. */
    salidas: string;
    recetas: string;
    helpers: string;
    escenarios: string;
    estadoRecetas: string;
    /** Sesiones guardadas (storageState) del slot: tienen cookies de usuarios reales, nunca van a un repo. */
    sesiones: string;
    servicios: string;
    cache: string;
}
export interface Contexto {
    raiz: string;
    dirWs: string;
    registro: Registro;
    configArchivo: string | null;
    /** Base de las rutas relativas del config (su carpeta, o la raíz del workspace). */
    base: string;
    cfg: Config;
    slot: number;
    dirSlot: string;
    rutas: Rutas;
    adaptadores: Adaptadores;
    /** Identificador de esta corrida (carpeta temporal, libro de uso). */
    corrida: string;
}
export declare function preparar(cwd?: string): Promise<void>;
/** El contexto listo; si el workspace no está registrado o la config es inválida, sale con su código. */
export declare function ctx(): Contexto;
/** true si el contexto está listo (sin salir). */
export declare const hayContexto: () => boolean;
/** Carpeta temporal de la corrida dentro del slot; se borra al terminar, aunque falle. */
export declare function carpetaTemporal(): string;
