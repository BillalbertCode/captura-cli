import type { Page } from 'playwright';
import { type Cambio, type Caso } from './estado.js';
/** Registra un caso para informe.md: { nombre, esperado, observado, ok, captura? } */
export declare function caso(page: Page, c: Caso): void;
/** Diario de cambios: todo lo que se escribió (siempre por la UI/API de la app, nunca SQL) y si se revirtió. */
export declare function cambio(page: Page, c: Cambio): void;
export interface BloqueConfiguracion {
    revertido(): void;
    fin(): Promise<void>;
}
export declare function configuracion(page: Page, { que, reversion }: {
    que: string;
    reversion?: boolean;
}): BloqueConfiguracion;
export declare function escribirInforme(page: Page): void;
