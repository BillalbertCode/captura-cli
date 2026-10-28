import type { Page } from 'playwright';
export declare const slug: (s: string) => string;
export interface OpcionesFoto {
    completa?: boolean;
    leyenda?: string;
    sinMarca?: string;
    /** Esperar a que la app termine de pedir datos antes de capturar (tabla que se dibuja vacía y se llena después). */
    esperarRed?: boolean;
}
export declare function foto(page: Page, descripcion: string, { completa, leyenda, sinMarca, esperarRed }?: OpcionesFoto): Promise<string>;
export declare const paso: typeof foto;
