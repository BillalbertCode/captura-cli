import type { Page } from 'playwright';
import { type AppConfig, type Credenciales } from './adaptadores/contrato.js';
import { type Abierto, type OpcionesAbrir } from './navegador.js';
/** Apps del config (un script puede registrar otra en memoria: apps.mia = {...}). */
export declare const apps: Record<string, AppConfig>;
export declare function credenciales(rol: string): Credenciales;
export interface OpcionesSesion extends Omit<OpcionesAbrir, 'storageState'> {
    app?: string;
    reutilizar?: boolean;
}
/** Las apps del config se cargan una vez (al importar la API o en el primer uso desde el CLI); las de memoria se suman. */
export declare function cargarApps(): void;
export declare function sesion(rol: string | null | undefined, { app, reutilizar, ...opts }: OpcionesSesion): Promise<Abierto>;
export declare function api(page: Page, metodo: string, ruta: string, cuerpo?: unknown): Promise<{
    status: number;
    texto: string;
    json: unknown;
}>;
