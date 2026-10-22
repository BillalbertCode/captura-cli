const fabrica = {
    contrato: 1,
    tipo: 'identificador',
    crear(opciones) {
        const patron = typeof opciones['patron'] === 'string' ? opciones['patron'] : '^[A-Za-z0-9._-]+$';
        const re = new RegExp(patron);
        const mayusculas = opciones['mayusculas'] !== false;
        return {
            validar: (id) => (id && re.test(id) ? null : `id requerido, formato ${patron} (recibido: "${id ?? ''}")`),
            carpeta: (id) => (mayusculas ? id.toUpperCase() : id),
        };
    },
};
export default fabrica;
