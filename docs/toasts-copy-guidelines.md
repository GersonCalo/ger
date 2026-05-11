# Lineamientos de Copy para Toasts

## Principios generales

1. **Brevedad**: ideal ≤ 80 caracteres, máximo 120.
2. **Resultado primero**: usar verbos en pasado o estado completado ("Guardado", "No se pudo crear").
3. **Lenguaje directo**: evitar tecnicismos de backend; hablar en términos de usuario.
4. **Consistencia**: unificar textos repetidos para evitar variantes inconsistentes.

## Severidad y tono

| Tipo     | Cuándo usar                          | Tono                        | Ejemplo                          |
|----------|--------------------------------------|-----------------------------|----------------------------------|
| `success`| Acción completada sin errores        | Afirmativo, conciso         | "Movimiento registrado"          |
| `info`   | Orientación no bloqueante            | Neutral, informativo        | "Selecciona un grupo primero"    |
| `error`  | Fallo que impide completar la acción | Explicar + siguiente paso   | "No se pudo crear el gasto"      |

## Patrones de copy

### Éxito
- `[Sustantivo] + [verbo en pasado]`: "Gasto añadido", "Categoría creada"
- Evitar: "Se ha añadido el gasto exitosamente" (demasiado largo)

### Error
- `No se pudo + [acción]`: "No se pudo eliminar el miembro"
- Si hay causa conocida: mencionar brevemente
- Evitar: mostrar stack traces o códigos HTTP

### Info
- Instrucción corta o contexto: "Selecciona un grupo para continuar"
- Evitar: sonar a error o advertencia

## Acciones opcionales

Cuando el toast incluye `action`, el label debe ser un verbo imperativo corto:
- "Ver", "Deshacer", "Reintentar"
- Máximo 12 caracteres

## Localización

Todos los mensajes están en español (latinoamérica). Mantener consistencia en:
- "Movimiento" (no "transacción" en UI)
- "Gasto" (no "expense")
- "Grupo" (no "group")
