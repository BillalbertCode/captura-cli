import type { BrowserContext, Page } from 'playwright';
export declare function grabarAcciones(ctx: BrowserContext, page: Page): Promise<void>;
/** Tramos con acciones propias (no hechas por una receta): lo que todavía no es receta. */
export declare const sinReceta: (page: Page) => import("./estado.js").Tramo[];
