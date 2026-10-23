import type { Locator, Page } from 'playwright';
export declare function abrirSelectHasta(locator: Locator, texto: string | RegExp, { intentos, ms }?: {
    intentos?: number;
    ms?: number;
}): Promise<Locator>;
export declare function esperarHabilitado(locator: Locator, ms?: number): Promise<true>;
export declare function esperarToast(page: Page, patron: string | RegExp, { ms, foto: desc, leyenda }?: {
    ms?: number;
    foto?: string;
    leyenda?: string;
}): Promise<string>;
