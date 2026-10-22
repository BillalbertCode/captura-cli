# Medir tokens

La reducción de tokens se decide con números, no a ojo. captura-cli da dos medidas que se complementan:

| Medida | De dónde sale | Qué dice |
|---|---|---|
| Libro de uso (`uso.jsonl`) | Cada comando del CLI y cada script con la API, al salir | Cuánto texto le devolvió la herramienta al agente (caracteres y tokens **estimados**, ≈4 caracteres por token), tiempo, código de salida, recetas, casos, capturas y 5xx |
| Transcrito de Claude Code (`--transcrito`) | El `.jsonl` de una sesión (`~/.claude/projects/<proyecto>/<sesión>.jsonl`) | Los tokens **reales** de la sesión (`usage` de cada respuesta) y qué parte de lo que devolvieron las herramientas vino de captura-cli |

El libro solo se escribe si al registrar el workspace se aceptó guardar estadísticas
(`captura-cli config estadisticas si`). Nunca sale de la máquina.

```sh
captura-cli stats                      # este workspace: por comando, recetas, casos y espacio ocupado
captura-cli stats --desde 7d --json    # para otra herramienta
captura-cli stats --todos              # todos los workspaces del almacén
captura-cli stats --transcrito ~/.claude/projects/<proyecto>/<sesión>.jsonl
```

Ejemplo de `--transcrito`:

```
tokens reales (286 respuestas): entrada 578 · caché escrita 1.5M · caché leída 110.3M · salida 383.2k · total 112.2M
herramientas: 404 llamadas; sus resultados ≈ 97.0k tokens
captura-cli: 7 llamadas; sus resultados ≈ 4.0k tokens (4.1% de lo que devolvieron las herramientas)
más caras:
    1.9k    1×  timeout 120 node test/paridad/escenarios/exito.mjs < /dev/null
```

- **Respuestas** se cuentan una vez por `requestId`: una respuesta partida en varios bloques no se suma dos veces.
- **De captura-cli** cuenta una llamada cuyo comando *empieza* por `captura-cli` (admite variables, `timeout` y `npx`
  delante) o cuya salida tiene las marcas de la herramienta (`captura: `, `informe: `, `FALTAN_CREDENCIALES`, …).
  Una ruta que contiene `captura-cli` o el cuerpo de un heredoc no cuentan.
- Los tokens de cada resultado son estimados; el total de la sesión es real. La caché leída domina el total en
  sesiones largas: el contexto acumulado se relee en cada respuesta.

## Cómo comparar un flujo (F7)

Para saber si la herramienta baja el gasto, se repite un flujo ya hecho a mano y se comparan las dos sesiones.

1. Elegir un ticket ya verificado a mano y anotar el total real de esa sesión
   (`captura-cli stats --transcrito <sesión vieja>.jsonl`).
2. En una sesión nueva, pedir el mismo flujo con la skill `captura` (escenario o script, recetas del catálogo).
3. Al terminar: `captura-cli stats --transcrito <sesión nueva>.jsonl` y `captura-cli stats --desde 1d`.
4. Comparar el total real, las llamadas a herramientas y cuánto vino de captura-cli. Donde un comando aparezca entre
   «más caras», ese es el candidato a recortar (salida más compacta, receta nueva). Solo se recorta lo que la medición
   señala.

En la ronda de referencia, casi todo el gasto fue prueba y error con controles propios (calendarios, borradores que
se retoman), no las capturas. Por eso la palanca principal son las recetas: un tramo que ya es receta no se vuelve a
explorar.
