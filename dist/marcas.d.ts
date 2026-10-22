import type { Locator, Page } from 'playwright';
import { type DetalleMarca, type Lado } from './estado.js';
export declare function marcar(page: Page, locator: Locator, texto: string, { lado, numero }?: {
    lado?: Lado;
    numero?: number;
}): Promise<void>;
/** Re-mide y vuelve a dibujar todas las marcas registradas. Devuelve [{texto, x, y, w, h, zona}] (texto, sin imagen). */
export declare function redibujarMarcas(page: Page): Promise<DetalleMarca[]>;
export declare const limpiar: (page: Page) => Promise<void>;
