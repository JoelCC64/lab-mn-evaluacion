# Feedback (Fase 7)

El feedback se arma **solo con lo que la app registró**:
- los puntajes por criterio (Clásica) o por aspecto (SQI);
- las etiquetas;
- la nota del profesor, que va tal cual;
- el control oral;
- los puntajes por pregunta de los TC.

La app no inventa ni sugiere notas: elige frases de la configuración según lo registrado. Cada texto nombra al grupo solo por su número. Ningún texto lleva nombres ni códigos, y una prueba automática lo comprueba.

## Dónde se ve

En cada práctica, taller o TC evaluado, la pestaña **Feedback** tiene tres vistas:
- **Por grupo:** un texto por grupo con la estructura *lo mejor / a mejorar / sugerencia* y, al final, el comentario del profesor.
  - Se puede editar antes de copiarlo: lo editado se guarda en la tabla `feedback`.
  - Si lo registrado cambia después de editar (por ejemplo, un puntaje), la app lo avisa y ofrece usar el texto nuevo.
  - «Copiar», «Compartir» (iPhone) y «Copiar todos». Cada grupo copiado queda marcado.
- **Corto:** 2 o 3 líneas por grupo, para decirlas en voz alta. La pestaña **Retro** del taller muestra estas líneas de la práctica anterior.
- **Curso:** resumen sin nombres:
  - Grupos evaluados y promedio.
  - Promedio por sección o aspecto, o, en un TC, las preguntas con más errores.
  - Etiquetas más marcadas y control oral.
  - **Qué reforzar.**

## Cómo se elige cada frase

| Sección | Qué entra | Orden |
|---|---|---|
| Lo mejor | Etiquetas positivas; criterios o aspectos con la nota máxima (si ninguna etiqueta los explica); en un TC, «Puntaje completo en …»; control oral bien (todos ≥ 75 %) | Por criterio; hasta 3 (`maximo.mejor`) |
| A mejorar | Penalización total o «no entregaron»; etiquetas negativas; criterios o aspectos con nota baja (≤ 50 %, `umbral_bajo`) si ninguna etiqueta los explica; en un TC, cada pregunta sin el puntaje completo; control oral con alguna respuesta bajo 50 % | Lo más bajo primero; el control al final |
| Sugerencia (Clásica) o Para explorar (SQI) | La sugerencia de cada cosa por mejorar, sin repetir. Si ninguna tiene plantilla, la general del tono. En SQI, con todo bien, una pregunta para extender (de una etiqueta positiva o del banco de preguntas de la práctica) | Hasta 2 (`maximo.sugerencia`) |
| Qué reforzar (resumen) | Preguntas de TC con errores en la mitad o más de los grupos; etiquetas negativas marcadas a 2 o más grupos; criterios con promedio ≤ 50 %; control oral bajo | Hasta 3 |

## Plantillas

Cada frase sale de la primera plantilla que la tenga, en este orden:
1. La plantilla de la **actividad** (`feedback` en `config/actividades/…json`):
   - `etiquetas`: por id de etiqueta.
   - `partes`: por id de criterio (Clásica), de aspecto (SQI), de pregunta (TC) o `integral` (taller).
2. La plantilla **por defecto** de `config/feedback.json`:
   - `partes`: por metodología, para los criterios de Clásica, los aspectos de SQI y la evaluación integral.
   - `control`: el control oral.
   - `trabajo_casa`: una sugerencia general para las preguntas de los TC.
3. El texto de la etiqueta, o el nombre de la parte con su nota.

Cada plantilla puede tener cuatro frases:
- `mejor`: lo mejor.
- `mejorar`: a mejorar.
- `sugerencia`.
- `reforzar`: para el resumen del curso.

Cada frase es un texto, o un texto por metodología: `{ "TRAD": "…", "SQI": "…" }`. Esto sirve para los talleres, que son comunes a las dos.

**Tono** (`tono` en `config/feedback.json`):
- **Clásica:** concreto y correctivo, qué corregir y cómo. La sección se llama «Sugerencia».
- **SQI:** invita a preguntar y dudar, sobre la confiabilidad de los datos, la puesta a prueba del modelo, la iteración y la extensión. La sección se llama «Para explorar» y sus sugerencias son preguntas.

Ejemplo (P1 de Clásica):

```json
"feedback": {
  "etiquetas": {
    "propagacion_mal": {
      "mejorar": "La propagación de la incertidumbre en h_exp fue incorrecta.",
      "sugerencia": "En h_exp = g·t²/2, la incertidumbre relativa de h es el doble de la del tiempo: δh/h = 2·δt/t (si g se toma sin incertidumbre).",
      "reforzar": "Propagación de la incertidumbre en h_exp = g·t²/2."
    }
  }
}
```

`npm run config` valida las plantillas:
- Cada una apunta a una etiqueta o parte que existe en la actividad.
- Una etiqueta positiva no lleva `mejorar` ni `reforzar`.
- Una negativa no lleva `mejor`.

**Estado (4-oct-2026):**
- Tienen plantillas: P1 de Clásica y de SQI, T1 y TC1.
- TC2–TC7 usan las frases por defecto; sus plantillas se agregarán con sus etiquetas, cuando lleguen sus hojas.
- Las actividades nuevas (P2, T2, …) se cargan con su sección `feedback`.
