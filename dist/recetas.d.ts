import type { Page } from 'playwright';
import { type Declaracion } from './estado.js';
export interface Receta {
    version?: number;
    descripcion?: string;
    vistoEn?: string;
    verificar?: (page: Page, args: Record<string, unknown>) => unknown;
    hacer: (page: Page, args: Record<string, unknown>) => unknown;
}
/** Ids que no están en el catálogo de la app (comun + app). Para validar un escenario sin abrir el navegador. */
export declare function recetasFaltantes(app: string, ids: string[]): Promise<string[]>;
/** Índice compacto de lo que ya existe para una app: mirarlo ANTES de escribir un script nuevo. */
export declare function listarRecetas(app: string): Promise<string[]>;
export declare function receta(page: Page, id: string, args?: Record<string, unknown>, { app }?: {
    app?: string | undefined;
}): Promise<void>;
export declare function declararRecetas(page: Page, d: Declaracion): void;
export declare function cerrarRecetas(page: Page, d?: Declaracion): Promise<void>;
