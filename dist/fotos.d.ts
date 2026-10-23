import type { Page } from 'playwright';
export declare const slug: (s: string) => string;
export interface OpcionesFoto {
    completa?: boolean;
    leyenda?: string;
    sinMarca?: string;
}
export declare function foto(page: Page, descripcion: string, { completa, leyenda, sinMarca }?: OpcionesFoto): Promise<string>;
export declare const paso: typeof foto;
