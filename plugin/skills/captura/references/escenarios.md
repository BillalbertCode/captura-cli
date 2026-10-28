# Escenarios en JSON

La forma preferida de pedir un flujo: sin código, validado entero antes de abrir el navegador.

```sh
captura-cli validar flujo.json           # código 2 con cada campo a corregir
captura-cli run flujo --rol supervisor   # por nombre, desde la carpeta de escenarios del proyecto
```

```json
{
  "version": 1, "id": "TAREA-12", "app": "web", "rol": "supervisor",
  "recetas": { "ninguna": "flujo de una sola vez" },
  "casos": [{
    "nombre": "Registrar visita", "esperado": "La fila pasa a Entregada",
    "pasos": [
      { "receta": "abrir-registrar-visita" },
      { "elegir": { "en": { "etiqueta": "Resultado" }, "opcion": "Entregada" } },
      { "marcar": { "en": { "rol": "button", "nombre": "Guardar" }, "etiqueta": "Guarda la visita" } },
      { "foto": { "descripcion": "visita-lista", "leyenda": "El diálogo listo para guardar" } },
      { "limpiar": true },
      { "click": { "en": { "rol": "button", "nombre": "Guardar" } } },
      { "esperarExito": "Visita registrada" }
    ]
  }]
}
```

`rol` solo hace falta si la app tiene login; en una app sin login se omite (y `explorar` tampoco pide `--rol`).

**Pasos:** `ir`, `click`, `llenar`, `elegir`, `esperar`, `esperarExito`, `esperarToast`, `esperarHabilitado`,
`comprobar` (aserción: `visible`, `texto`, `habilitado`), `marcar`, `limpiar`, `foto`, `cambio`, `api` (con
`status` falla si difiere), `receta`, `explorar` (con `errores`).

**Listados paginados:** la tabla aparece antes que las filas. Esperar por el **dato** que falta, no por la pantalla:
`{ "esperar": "/<patrón del dato>/" }` antes de `marcar`/`foto`, o capturar con
`{ "foto": { …, "esperarRed": true } }` (espera a que la app termine de pedir datos).

**Desplegables que no son `<select>`** (react-select): el paso `elegir` los abre solo (trae el control a la vista,
lo enfoca, pulsa `ArrowDown` y elige la opción por rol `option`). Un `click` a pelo sobre un elemento fuera de la
ventana falla con «Element is outside of the viewport»: el paso `click` ya lo trae a la vista antes de clicar.

**Selector `en`:** exactamente uno de `rol` (+ `nombre`), `etiqueta`, `placeholder`, `texto`, `testid`, `css`.
Opcionales: `exacto`, `n` (índice) y `dentro` (otro selector que lo contiene, p. ej. un panel que no es
`role=dialog`). Un texto `"/patron/i"` es una expresión regular.

**Resultado:** cada caso es OK o FALLA. Una falla imprime el paso exacto (`casos[0].pasos[3] (click): …`), el
diagnóstico, los errores visibles (`! campo …`) y, si hubo, el 5xx del servidor en ese paso; luego sigue con el caso
siguiente. Sale con 1 si algún caso falló y con 5 si faltó declarar recetas.

**Límite:** el escenario no ejecuta código. Un control raro (calendario propio, asistente con borrador) va en una
receta y se llama con el paso `receta`.
