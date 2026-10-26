import type { Locator, Page } from 'playwright';
export declare const esperarTexto: (page: Page, texto: string | RegExp, ms?: number) => Promise<void>;
export declare function diagnostico(page: Page, { max }?: {
    max?: number;
}): Promise<{
    url: string;
    texto: string;
    botones: string[];
    cookies: string[];
}>;
export declare function detectarErrores(page: Page): Promise<string[]>;
export declare function explorar(page: Page, { max, completo, errores }?: {
    max?: number;
    completo?: boolean;
    errores?: boolean;
}): Promise<{
    titulos: string[];
    nuevas: string[];
    quitadas: string[];
    errores?: string[];
}>;
export declare function esperarExito(page: Page, patron: string | RegExp, { dentro, ms }?: {
    dentro?: Locator;
    ms?: number;
}): Promise<string>;
