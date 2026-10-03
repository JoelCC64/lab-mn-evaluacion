# Escritura en el Excel del semestre (Fase 3)

Rige desde la versión 0.5.0. Implementa el Anexo J.2 del plan.

## Cómo se usa (Mac, Chrome)

1. En el iPhone: «Datos» › «Exportar respaldo» › AirDrop a la Mac.
2. En la Mac, en Chrome, abre la app y entra a «Datos» › «Escribir las notas en el Excel».
3. «Importar el respaldo del iPhone…» (reemplaza los datos de la app en la Mac).
4. «Elegir la carpeta del Excel»: la carpeta donde está `Cursos_Lab_MN_2026B.xlsx`. Chrome pide permiso para editarla. La app recuerda la carpeta.
5. «Revisar qué se escribirá»: muestra, hoja por hoja, cuántas celdas cambian, los avisos y las celdas editadas a mano.
6. Si editaste a mano una celda de la app, decide en cada una (ver abajo).
7. «Escribir en el Excel»: **con el Excel cerrado**. La app descarga una copia del archivo tal como estaba (en «Descargas», con la fecha en el nombre) y guarda sobre el mismo archivo.

En el iPhone (Safari) esta pantalla solo explica el camino: Safari no puede guardar sobre un archivo existente.
En la demostración (`?demo=1`) se usa el Excel ficticio y el resultado se descarga.

## Qué escribe la app (zonas de la app)

**En cada hoja de curso**, a la derecha de las columnas existentes, tras una columna vacía (con el Excel actual, desde la columna J):

| Fila | Contenido |
|---|---|
| Encabezados − 1 (fila 3) | Franja «1.er bimestre · notas sobre 10 · lo llena la app» y «2.º bimestre …» |
| Encabezados (fila 4) | Encabezados de la app (fondo verde) |
| Una por estudiante | Valores, ubicando la fila por el **código único** |

Columnas, en orden:
- «Grupo actual»: el grupo de la instantánea más reciente.
- Una columna por evento con nota de cada bimestre, en el orden del cronograma del curso. Por ejemplo, A · Clásica: P1, T1, P2, T2, P3, T3. A · SQI: P1, TC1, T1, P2, TC2, T2, P3, TC3, T3.
- Componentes del bimestre:
  - Clásica: Preparatorios (/10), Control (/10), Planificación y conocimiento (/1.5), Diseño, datos y análisis (/3.5 o /3), Talleres (/1) y PLIC (/0.5) en el 2.º.
  - SQI: Control (sí/no), Prácticas (/3), Trabajos en casa (/2 o /1.5), Talleres (/1) y PLIC (/0.5) en el 2.º.
- «Nota B1 (/6)» y «Nota B2 (/6)».
- «Observaciones de la app», por ejemplo: «P1: no vino · T2: no se hizo (Día de los Difuntos) · B1: sin control oral».

Valores:
- Número con 2 decimales si está evaluado.
- Vacío si falta evaluar o cerrar el pase.
- «—» si el evento no se hizo en el curso (feriado o sin clase).
- 0 si el estudiante faltó; el motivo va en las observaciones.

Componentes y notas:
- Los componentes y la nota del bimestre se escriben **solo cuando están completos**, es decir, cuando todo lo del bimestre está evaluado. Mientras tanto quedan vacíos; la nota acumulada y la proyectada se ven en la app (Fase 6).
- «Preparatorios» y «Control» muestran el promedio de lo que ya hay.
- Si el bimestre termina (todas sus sesiones con el pase cerrado) y un estudiante no tuvo control oral, Planificación y conocimiento sale solo de los preparatorios, con la observación «B1: sin control oral».

**Hojas propias**, que se reescriben completas en cada escritura:
- «Asistencia (app)»: todos los cursos uno debajo de otro, con estas columnas:
  - Paralelo, N°, Código único, Apellidos y nombres.
  - S1 … S18: P presente, F no vino o salió, R se retiró antes, «—» sin clase o feriado, vacío sin pase.
  - Asistencias (P + R) y % sobre las sesiones con pase.
- «Detalle (app)»: una fila por estudiante y evento ya ocurrido, con todo lo registrado. Además de las columnas del Anexo J lleva «Etiquetas».
- Los pendientes de nómina van en fila ámbar.

**Hoja oculta «_app»**:
- Guarda el formato, la versión de la app y el momento de la escritura.
- Guarda **lo último que escribió la app en cada celda de sus columnas** (por hoja, código y columna, no por posición). También guarda las celdas que Joel decidió conservar («fijadas») y una huella de cada hoja propia.
- Sirve para detectar las ediciones a mano. Viaja con el Excel, así que no se pierde cuando la Mac importa un respaldo nuevo del iPhone.

## Ediciones a mano

Si una celda de la app cambió desde la última escritura y no coincide con lo que la app escribiría ahora, la app la muestra y pregunta:
- **Conservar el del Excel:** la celda queda «fijada» y la app no la vuelve a tocar mientras siga igual. En una nota de evento cuenta como ajuste con motivo «editado en el Excel», así que entra en los componentes y en la nota del bimestre. Solo se puede conservar un número de 0 a 10.
- **Usar el de la app:** se reemplaza y deja de estar fijada.

Si una celda fijada se vuelve a editar, se pregunta otra vez. Si alguien edita a mano una hoja propia, la app avisa y la reescribe.

## Reglas de seguridad

- **Nunca se escribe fuera de las zonas de la app.** Antes de guardar, la app lee el archivo nuevo y lo compara celda por celda con el original. Compara valor y formato de todas las celdas fuera de las zonas, más anchos, altos, paneles, celdas combinadas y hojas. Si algo difiere, no guarda.
- **Revisión de partes del archivo.** La librería de escritura (ExcelJS) no conserva algunas cosas. Si el Excel tiene gráficos, imágenes o formas, tablas de Excel, tablas dinámicas, vínculos externos, macros, segmentaciones, comentarios con respuestas o formato condicional avanzado, la app no escribe y lo explica. Las propiedades personalizadas del archivo y la configuración de impresora se pierden; la app avisa antes.
- **Excel cerrado.** Si existe el archivo de bloqueo de Excel (`~$…`) junto al libro, la app no escribe. Tampoco escribe si el archivo cambió entre la revisión y la escritura.
- **Copia previa.** Siempre se descarga una copia del archivo tal como estaba.
- **Estudiantes que no coinciden.** Si un código del Excel no está en la app, o al revés, se avisa y esa fila no se escribe. Tampoco se escriben las filas con códigos repetidos.
- **Zona movida o renombrada.** Si los encabezados de la app no tienen la forma esperada, esa hoja no se escribe y se explica qué columna no coincide.
- **Escribir dos veces seguidas no cambia nada.** Si el Excel ya está al día, la app lo dice y no lo toca.

## Prueba de ida y vuelta

`tests/excel-escritura.test.js` simula una clase de P1 en GR2QB (Clásica) y en GR1AA (SQI), con ausentes, «se retiró», novedades y control, sobre el Excel ficticio. Después escribe y comprueba:
- que fuera de las zonas de la app todo quede idéntico, con ExcelJS y además con openpyxl (`scripts/comparar_excel.py`), la librería que generó el Excel real;
- que las zonas tengan lo que calcula el motor de notas;
- que escribir dos veces seguidas no cambie nada;
- que las ediciones a mano se detecten y que conservar o reemplazar funcione;
- los avisos por estudiantes que no coinciden, zona movida y hoja propia editada;
- la revisión de partes del archivo.

El Excel real (`Cursos_Lab_MN_2026B.xlsx`, generado con openpyxl 3.1.5) tiene la misma estructura interna que el ficticio. No tiene nada de lo que la librería no conserva: solo anchos de columna, paneles inmovilizados, rellenos y fuentes.
