/** Dónde actuar. Exactamente uno de rol | etiqueta | placeholder | texto | testid | css. */
export interface Selector {
    rol?: string;
    nombre?: string;
    etiqueta?: string;
    placeholder?: string;
    texto?: string;
    testid?: string;
    css?: string;
    /** Coincidencia exacta del texto (por defecto false; un texto "/…/i" es una expresión regular). */
    exacto?: boolean;
    /** Índice cuando hay varios (por defecto el primero). */
    n?: number;
    /** Buscar dentro de otro elemento (p. ej. un panel que no es role=dialog). */
    dentro?: Selector;
}
export type Paso = {
    ir: string;
} | {
    click: {
        en: Selector;
    };
} | {
    llenar: {
        en: Selector;
        valor: string;
    };
} | {
    elegir: {
        en: Selector;
        opcion: string;
    };
} | {
    esperar: string | {
        texto: string;
        ms?: number;
    };
} | {
    esperarExito: string | {
        texto: string;
        ms?: number;
        dentro?: Selector;
    };
} | {
    esperarToast: string | {
        texto: string;
        ms?: number;
        foto?: string;
        leyenda?: string;
    };
} | {
    esperarHabilitado: {
        en: Selector;
        ms?: number;
    };
} | {
    comprobar: {
        en: Selector;
        visible?: boolean;
        texto?: string;
        habilitado?: boolean;
    };
} | {
    marcar: {
        en: Selector;
        etiqueta: string;
        lado?: 'abajo' | 'arriba' | 'izq' | 'der' | 'dentro';
        numero?: number;
    };
} | {
    limpiar: true;
} | {
    foto: {
        descripcion: string;
        leyenda: string;
        sinMarca?: string;
        completa?: boolean;
    };
} | {
    cambio: {
        que: string;
        revertir?: string;
        revertido?: boolean;
    };
} | {
    api: {
        metodo: string;
        ruta: string;
        cuerpo?: unknown;
        status?: number;
    };
} | {
    receta: string | {
        id: string;
        args?: Record<string, unknown>;
    };
} | {
    explorar: true | {
        max?: number;
        completo?: boolean;
        errores?: boolean;
    };
};
export interface CasoEscenario {
    nombre: string;
    esperado?: string;
    pasos: Paso[];
}
export interface Escenario {
    version: 1;
    id: string;
    app?: string;
    rol: string;
    /** Declaración de recetas al cerrar (igual que cerrar({ creadas } | { ninguna })). */
    recetas?: {
        creadas?: string[];
        ninguna?: string;
    };
    casos: CasoEscenario[];
}
/** Forma correcta de cada paso, para los mensajes de error. */
export declare const FORMAS: Record<string, string>;
export declare const TIPOS_PASO: string[];
/** Valida la estructura. Devuelve el escenario tipado o la lista de errores (todos, no solo el primero). */
export declare function validarEscenario(x: unknown): {
    ok: true;
    escenario: Escenario;
} | {
    ok: false;
    errores: string[];
};
/** Ids de receta que usa el escenario (para comprobar que existen antes de abrir el navegador). */
export declare const recetasDe: (esc: Escenario) => string[];
/** "/patron/flags" es una expresión regular; cualquier otro texto, literal. */
export declare function patronDe(s: string): string | RegExp;
