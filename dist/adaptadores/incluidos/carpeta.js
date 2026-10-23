const fabrica = {
    contrato: 1,
    tipo: 'publicacion',
    crear() {
        return { publicar: async () => { } };
    },
};
export default fabrica;
