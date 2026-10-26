import type { Page } from 'playwright';
import { type Declaracion } from './estado.js';
export interface OpcionesAbrir {
    ticket: string;
    browser?: 'chromium' | 'firefox' | 'webkit';
    headless?: boolean;
    viewport?: {
        width: number;
        height: number;
    };
    subcarpeta?: string;
    maxMs?: number;
    storageState?: string;
}
export interface Abierto {
    page: Page;
    cerrar: (declaracion?: Declaracion) => Promise<void>;
}
export declare function abrir({ ticket, browser, headless, viewport, subcarpeta, maxMs, storageState }: OpcionesAbrir): Promise<Abierto>;
