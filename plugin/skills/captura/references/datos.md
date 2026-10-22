# Escribir datos y configurar como admin

## Escribir datos

- **Solo por la UI o la API de la app**, nunca SQL directo. Las consultas a la base son solo de lectura, para
  verificar.
- Antes de un paso que escribe: **decirlo y esperar el sí** del usuario. Cada escritura se anota con `cambio`
  (`{ que, revertir }`).
- **Revertir lo reversible** por la misma pantalla y verificarlo. Lo que no se puede revertir (un expediente que
  cambió de estado) se declara en el informe.
- Mínima huella: datos de prueba, nunca de personas reales.

## Configuración como admin, paso a paso desde el inicio

Cuando la prueba depende de habilitar o deshabilitar un **parámetro, menú o permiso**, el cambio se hace con el rol
admin y se documenta con capturas de cada paso, porque la causa de lo que se prueba después tiene que quedar visible.

```js
const b = configuracion(page, { que: 'habilitar parámetro X para Supervisor', reversion: false })
// marcar + foto({ leyenda }) en cada paso: entrada al panel, la lista, el registro, el estado ANTES,
// el control que se toca, el guardado y su aviso, el estado DESPUÉS
await b.fin()
```

- Las capturas van a `<id>/config-<que>/`, separadas de la prueba del rol final.
- **`reversion`** (por defecto `false`): casi siempre el cambio **se deja**. Con `reversion: true` se invierten los
  mismos pasos con sus capturas, se llama `b.revertido()` y se verifica con una consulta de solo lectura; si no
  vuelve, se declara en el informe. `fin()` avisa si faltó `revertido()`.
- Después del cambio, probar la **consecuencia**: entrar con el rol afectado, capturar lo que apareció o desapareció
  y registrar un `caso` con antes y después.
- Sigue valiendo: decirlo y esperar el sí del usuario antes de tocar nada.
