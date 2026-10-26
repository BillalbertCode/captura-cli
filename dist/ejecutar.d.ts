import type { Locator, Page } from 'playwright';
import { type Escenario, type Selector } from './escenario.js';
export interface OpcionesRun {
    browser?: 'chromium' | 'firefox' | 'webkit';
    headless?: boolean;
    viewport?: {
        width: number;
        height: number;
    };
    maxMs?: number;
    reutilizar?: boolean;
}
export declare function localizar(page: Page, s: Selector): Locator;
/** Ejecuta el escenario. Devuelve el código de salida (0, 1 si algún caso falló, o 5 si faltó declarar recetas). */
export declare function ejecutarEscenario(esc: Escenario, o?: OpcionesRun): Promise<number>;
