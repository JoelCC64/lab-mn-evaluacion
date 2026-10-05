# Progreso

Plan: [PROYECTO_LABORATORIOS_v4.md](PROYECTO_LABORATORIOS_v4.md). Al empezar una sesión, leer el plan y este archivo; al terminar una fase, actualizar este archivo y hacer commit.

## Estado

| Fase | Estado | Fecha |
|---|---|---|
| 0. Preparación y configuración del semestre | ✅ Completa | 3-oct-2026 |
| 1. Lectura del Excel, navegación y respaldo | ✅ Completa | 3-oct-2026 |
| 2. La clase: prácticas, control oral, asistencia y preparatorio | ✅ Completa | 3-oct-2026 |
| 3. Escritura en el Excel (Mac, Chrome) | ✅ Completa | 3-oct-2026 |
| 4. Talleres | ✅ Completa | 3-oct-2026 |
| 5. Trabajos en casa (SQI) | ✅ Completa | 3-oct-2026 |
| 6. Nota bimestral, excepciones y coordinación | ✅ Completa | 4-oct-2026 |
| 7. Feedback | ✅ Completa | 4-oct-2026 |
| 8. Métricas | ✅ Completa | 4-oct-2026 |
| 9. Respaldo completo y varios dispositivos | ✅ Completa | 4-oct-2026 |

## Fase 0 (3-oct-2026)

**Hecho**
- **Entorno aislado:**
  - `.venv` (uv) con Python, nodeenv y openpyxl.
  - Node 24.21.0 dentro del mismo `.venv`.
  - Dependencias en `node_modules`.
  - `scripts/crear-entorno.sh` lo recrea. Una guarda impide `npm install` y `npm test` con un Node global.
- **Stack final:**
  - HTML + JavaScript (módulos ES) sin paso de compilación.
  - Preact + htm (13 KB, un solo archivo) para la interfaz.
  - Dexie 4 (IndexedDB).
  - ExcelJS 4.4 para el Excel; se carga solo al leerlo o escribirlo.
  - Pruebas con el corredor de Node, fake-indexeddb y Ajv.
  - Las librerías del navegador están copiadas en `src/vendor` (con licencias).
- **Configuración real** en `/config`:
  - 10 cursos y calendario 2026B (Anexo H).
  - 4 cronogramas: A/B × Clásica/SQI.
  - Esquemas de nota TRAD/SQI B1/B2 (Anexo A).
  - Catálogo de actividades.
  - Aspectos SQI y aspectos por práctica.
  - P1-TRAD, P1-SQI, T1 y TC1–TC7 (Anexos B, C, D y G).
  - Control oral, trabajo preparatorio, Planificación y conocimiento, asistencia y estructura del Excel.
- **Esquemas JSON** en `config/schemas/`. `npm run config` valida forma y reglas cruzadas: pesos que suman 1, TC que suman 10, aspectos oficiales y referencias de etiquetas. También genera `config/manifest.json`.
- **Datos ficticios** en `datos-ejemplo/`, generados con openpyxl copiando el formato de `generar.py`:
  - Excel del semestre con 10 hojas de curso (17 a 22 estudiantes), grupos de 3 y 4, algunos sin grupo, 2 pendientes en fila ámbar y correos falsos.
  - Excel de asistencia de la semana 1.
- **Documentación:** `docs/modelo-datos.md` y `docs/reglas-oficiales.md`.
- **Pruebas** (23): configuración, casos que deben fallar, calendario con las sesiones perdidas del Anexo H y forma del Excel ficticio.

**Decisiones de implementación**
- **Los eventos se calculan desde la configuración; no se guardan.** Id `PARALELO:CÓDIGO`. Solo se guardan los cambios manuales de estado.
- **Sesiones sin nota.** Introducción, refuerzo y revisión de notas también son eventos, para registrar su asistencia (columnas S1…S18).
- **El TC sigue a su práctica.** Si la práctica se pierde, el TC queda excluido.
- **Valores definidos por defecto** (se cambian en la configuración):
  - «Salió» en el control cuenta como control con nota 0 (`control-oral.json → salio`). Pierde la actividad, pero ya tuvo su control.
  - Frases rápidas de observación: «Está pero no trabaja», «Llegó tarde», «Participa poco», «Trabajo destacado» (`asistencia.json`).
- **Planificación y conocimiento.** Su JSON incluye `valor: 1.5`. Los esquemas PLIC del B2 llevan `items: { PLIC: 1 }` para enlazar la actividad.
- **El plan se movió a la raíz de este repositorio** (Anexo E).

## Fase 1 (3-oct-2026) · versión 0.2.0

**Hecho**
- **Base local** (Dexie, una base por semestre: `lab-mn-2026B`) con el modelo de `docs/modelo-datos.md`.
- **Lectura del Excel del semestre** (`src/nucleo/excel-lectura.js`):
  - Busca los encabezados por su texto, en cualquier fila y orden.
  - No lee la columna de correo y quita cualquier correo colado en el nombre o la observación.
  - Reporta errores: filas sin código y códigos repetidos.
  - Avisa de hojas desconocidas, columnas faltantes y diferencias de cronograma o metodología.
- **Importación con vista previa** antes de guardar (nuevos, actualizados, bajas, por curso). Al volver a leer:
  - Agrega a los nuevos.
  - Marca «baja» a quien ya no está, sin borrar sus evaluaciones.
  - Reactiva a quien vuelve.
  - Si una hoja falta, no da de baja a nadie de ese curso.
- **Asistencia de la semana 1** (opcional): presente/no vino en la Introducción, con el pase cerrado. Los cursos sin clase (GR2QB) quedan «sin clase».
- **Navegación** Curso → Evento → Grupo:
  - Metodología y cronograma visibles.
  - Estado de cada evento: pendiente, en curso, pase hecho, evaluado, feriado o sin clase.
  - Sesión sugerida: la de la semana; el fin de semana, la próxima.
- **Grupos por evento** (`src/nucleo/grupos.js`): instantánea propia → evento anterior → Excel. El TC usa los de su práctica.
- **Respaldo JSON:**
  - Exportar (en el iPhone, hoja de compartir para AirDrop; en la Mac, descarga).
  - Restaurar con validación (formato, versión, semestre) y confirmación «Reemplazar todo».
- **PWA:**
  - Manifiesto, íconos (péndulo) y service worker generado por `npm run build` con todos los archivos.
  - Sin conexión: en localhost primero la red; publicada, primero la caché.
  - Una versión nueva se instala solo cuando Joel toca «Actualizar».
- **Demostración** (`?demo=1`): una base aparte con el Excel ficticio, para probar sin tocar los datos reales.
- **Pruebas** (44 en total):
  - Lector del Excel.
  - Importación y relectura.
  - Ningún «@» guardado.
  - Respaldo: exportar → borrar → restaurar → idéntico.
  - Grupos.
  - PWA al día.

**Verificado en el navegador** (375 px):
- Se lee el Excel ficticio y se navega por cursos, eventos y grupos.
- La asistencia de la semana 1 queda registrada.
- Los datos persisten al recargar.
- Con el servidor apagado, la app abre desde la caché con sus datos.

**Notas**
- El panel de vista previa no pudo lanzar el servidor (el proceso quedaba detenido antes de arrancar, probablemente por un permiso de macOS). Se usa `npm run servidor` desde la terminal y el panel se conecta a http://localhost:8765.
- Para instalar la app en el iPhone hace falta publicarla con HTTPS (por ejemplo GitHub Pages). Sin eso, el service worker no se registra fuera de localhost.

## Fase 2 (3-oct-2026) · versión 0.3.0

**Hecho**
- **Motor de notas** (`src/nucleo/motor.js`), funciones puras con desglose de cada nota:
  - Nota de actividad (Clásica, SQI, taller y TC).
  - Elegibilidad según el pase. La falta deja 0 en la actividad, en el preparatorio y, en SQI, en el TC de esa práctica.
  - Replicación de la nota del grupo a sus integrantes presentes.
  - Exclusión por feriado con renormalización, y recuperación.
  - Penalización total y ajuste individual con motivo.
  - Preparatorio derivado de la revisión en la puerta.
  - Control oral y Planificación y conocimiento.
  - Componentes del bimestre: nota acumulada y proyectada, sin mezclarlas.
- **Sorteo del control oral** (`src/nucleo/sorteo.js`):
  - Prioridad a quien no tiene control en el bimestre.
  - Cobertura «faltan N; quedan M sesiones; conviene K», con aviso si K pasa de 4.
  - Excluye a quien no ingresó, faltó o ya fue sorteado.
  - Sorteo con el generador criptográfico.
- **Acciones** (`src/datos/acciones.js`): cada toque se guarda de inmediato. La primera escritura de grupo del evento crea su instantánea de grupos.
- **Pantallas del evento:**
  - **Puerta:** «Revisión hecha: todos cumplieron» y novedades buscando por apellido. Clásica: «incompleto», «no lo hizo» o «no lo hizo y no ingresa»; SQI: «no ingresa».
  - **Control:** indicador de cobertura, Sortear 3/4/+1 o elegir a mano. Hasta 3 preguntas con 0/1/2 (Clásica) o aprobado/no aprobado (SQI). «No está» sortea un reemplazo y «Salió» queda como falta.
  - **Grupos:** estado de cada grupo (nota, pase, firmado, faltas), estudiantes sin grupo y cierre del pase con avisos.
  - **Resumen:** nota de cada estudiante con el motivo de cada 0 o pendiente, y detalle con ajuste individual.
- **Pantalla del grupo:**
  - Rúbrica configurada: Clásica con 3 secciones 0–4; SQI solo con los aspectos que aplican. Guía con indicadores y descriptores.
  - Etiquetas rápidas y nota del profesor dictable.
  - Pase de los integrantes (presente por defecto, no vino, se retiró), observaciones con frases rápidas y mover de grupo o agregar.
  - Trabajo firmado y penalización total con motivo.
  - «Listo · siguiente grupo».
- **Interfaz:** Preact 10.29.8 + htm. El paquete «standalone» de htm traía un Preact antiguo que reordenaba elementos en pantalla.
- **Pruebas** (76):
  - Los 15 casos mínimos del §4.
  - Sorteo: GR2QB pide 5, 5, 4, 4, 4 y cubre a los 22.
  - Una clase completa de P1 contra la base (ausentes, «salió», pendiente de nómina, estudiante movido, penalización y ajuste).

**Verificado en el navegador** (375 px, demostración con datos ficticios), clase de P1 en GR2QB:
- Revisión en la puerta con dos novedades.
- Control: 4 sorteados, preguntas, «no está» y «salió».
- 6 grupos evaluados: cada uno con 3 toques más «Listo».
- Observación con frase rápida, firmado y cierre del pase.
- El resumen coincide con el cálculo manual.
- También SQI (GR1AA): aspectos de P1, revisión sin nota y control aprobado/no aprobado.

**Decisiones de implementación**
- **Tocar un nivel siempre lo elige.** Un doble toque accidental no borra la nota; para quitar puntajes hay «Borrar los puntajes de este grupo», con confirmación.
- **Pestaña inicial del evento:** la primera con algo por hacer (puerta → control → grupos; con el pase cerrado, resumen). Se elige una sola vez al abrir el evento.
- **Taller:** la puerta, el control y el pase ya sirven. La evaluación integral del grupo queda para la Fase 4, como dice el plan.
- **«Se retiró antes» en una práctica:** conserva la nota del grupo; Joel puede registrar un ajuste.

## Fase 3 (3-oct-2026) · escritura en el Excel

Detalle en [docs/excel.md](docs/excel.md).

**Hecho**
- **Pantalla «Excel del semestre»** (Datos › Escribir las notas en el Excel), pensada para Chrome en la Mac:
  - Importa el respaldo del iPhone.
  - Recuerda la carpeta del Excel.
  - Revisa, pregunta por las ediciones a mano y escribe sobre el mismo archivo con la API de acceso a archivos de Chrome.
  - En el iPhone explica el camino; en la demostración usa el Excel ficticio y descarga el resultado.
- **Zonas de la app** (Anexo J.2):
  - En cada hoja de curso, columnas a la derecha tras una columna vacía: «Grupo actual», eventos por bimestre en el orden del cronograma, componentes, nota del bimestre y observaciones.
  - Hojas «Asistencia (app)» (S1…S18) y «Detalle (app)».
  - Hoja oculta «_app».
  - Cada estudiante se ubica por su código.
- **Ediciones a mano:** se detectan comparando con lo último que escribió la app, guardado en «_app». Cada una se puede conservar o reemplazar. Conservar una nota de evento la convierte en ajuste «editado en el Excel»; queda fijada y no se vuelve a preguntar mientras no cambie.
- **Seguridad antes de guardar:**
  - Revisión de las partes del archivo: no escribe si hay algo que la librería no conserva, como gráficos, tablas o formato condicional avanzado.
  - Excel cerrado (archivo `~$`) y archivo sin cambios desde la revisión.
  - Comparación celda por celda (valor y formato) fuera de las zonas.
  - Copia del archivo anterior en Descargas.
  - Comprobación final de que el archivo guardado quedó al día.
- **Prueba de ida y vuelta** con el Excel ficticio y una clase simulada en GR2QB y GR1AA:
  - Fuera de las zonas todo queda idéntico, con ExcelJS y con openpyxl (`scripts/comparar_excel.py`).
  - Las zonas tienen lo que calcula el motor.
  - Escribir dos veces no cambia nada.
  - Una edición a mano se detecta.
  - **8 pruebas nuevas.**

**Verificado en el navegador** (demostración, 375 px):
- Revisión de las 10 hojas: 568 celdas, zona desde la columna J.
- Escritura con la verificación previa y el archivo resultante revisado celda por celda.
- Segundo archivo con tres ediciones a mano: el aviso, las decisiones (conservar, usar la de la app) y el resultado, con la celda conservada fijada en «_app».

**Decisiones de implementación**
- **Los componentes y la nota del bimestre se escriben solo cuando están completos.** Mientras tanto, la celda queda vacía, como cualquier cosa sin evaluar. «Preparatorios» y «Control» muestran el promedio de lo que hay.
- **El PLIC va solo como componente** «PLIC (/0.5)», sin una columna de evento aparte.
- **Lo último escrito va en el Excel** (hoja «_app»), no en la base: la base de la Mac se reemplaza con cada respaldo del iPhone. Las celdas conservadas también se guardan ahí y entran al cálculo como ajustes.
- **Una nota de evento escrita a mano solo se conserva si es un número de 0 a 10.** Un texto («revisar») solo se puede reemplazar.
- **Columna adicional «Etiquetas»** en «Detalle (app)» (la lista del Anexo J no la tenía), para tener todo lo registrado.
- **Datos solo del dispositivo** (carpeta del Excel, último respaldo importado, registro de escrituras) en una base aparte que no va en el respaldo.
- **Criterios y aspectos con nombre corto** en la configuración (`corto`), para la columna «Puntajes» del detalle («diseño 3 · datos 4 · análisis 2»).

## Fase 4 (3-oct-2026) · talleres · versión 0.5.0

**Hecho**
- **Evaluación integral por grupo** con la escala configurada (0/1/2). La pantalla del grupo muestra:
  - Qué incluye y cómo se calcula la nota del taller: 50 % asistencia y permanencia + 50 % evaluación integral.
  - La guía con las tareas del taller.
  - El **banco de preguntas**, abierto en los talleres; en las prácticas aparece plegado.
  - Etiquetas, nota dictable, pase de los integrantes (presente 1, se retiró antes 0.5, no vino 0, con observaciones) y trabajo firmado.
- **Pestaña «Retro»** en los talleres:
  - Muestra los grupos de la última práctica realizada del curso: integrantes (quién faltó), control oral, rúbrica por aspecto (en rojo lo bajo), etiquetas y nota del profesor.
  - La casilla «Retro dada» se guarda en la tabla nueva `retroalimentaciones` (base versión 2).
  - Si la práctica anterior se perdió por feriado, usa la anterior que sí se hizo. En el cronograma B, el T1 no lleva retro.
- **Grupos y resumen:**
  - En «Grupos», el avance de la evaluación y el nivel de cada grupo («2/2»).
  - El cierre del pase avisa de los grupos sin evaluar.
  - El detalle del resumen muestra la asistencia y permanencia.
- **Puerta, control oral y pase** como en la Fase 2. El control tiene nota en Clásica.
- **Pruebas** (90 en total):
  - Un T1 completo contra la base: 1.0, 0.75 con integral 1/2 y 0.75 si «se retiró antes» (casos del §4).
  - GR2QB, que pierde el T2 por feriado: Talleres = (T1 + T3)/2 = 0.875; en el Excel, T2 «—» y Talleres 0.88.
  - La retroalimentación del T1 con los datos de P1.
  - La práctica perdida por feriado.
  - La actualización de la base de la versión 1 a la 2 sin perder datos, y un respaldo de la versión anterior que se restaura.

**Verificado en el navegador** (demostración): retro del T1 de GR2QB con los datos de la P1 evaluada en la Fase 2, casilla «Retro dada», evaluación integral 2/2, «se retiró» → 7.5 y pase cerrado con el resumen correcto.

**Decisiones de implementación**
- **La nota del grupo de un taller se muestra como nivel** («1/2»), no sobre 10: es la mitad grupal de la nota.
- **El trabajo firmado y la penalización total salen de la configuración** de cada actividad (`cierre`, `penalizacion_total`). Los talleres no tienen penalización total.

## Fase 9 (4-oct-2026) · respaldo completo y varios dispositivos · versión 0.11.0

Detalle en [docs/respaldo.md](docs/respaldo.md).

**Hecho**
- **Respaldo completo** (Datos › «Respaldo completo en CSV y JSON (.zip)»):
  - Un .zip con el JSON (se restaura), un CSV por tabla y un LEEME, todo con la fecha en el nombre.
  - CSV en UTF-8 con BOM, separador coma y punto decimal. La clave de la tabla va primero, y las listas y los objetos van como JSON en su celda.
  - El zip lo arma la app (`crearZip`, con CRC-32 y deflate del navegador). «Restaurar un respaldo…» acepta el .zip.
- **Paquete de eventos:**
  - Datos › «Enviar eventos…» (por curso, con los cambiados aquí ya marcados) y el menú ⋯ de cada evento, ahora también en los TC.
  - Datos › «Recibir eventos…». La pantalla del Excel en la Mac también lo acepta.
  - El paquete lleva las filas de esos eventos y sus visitantes. Se valida: semestre, demostración, eventos conocidos, filas propias y estudiantes presentes.
  - Muestra qué cambia en cada evento y, al confirmar, reemplaza solo esos eventos.
- **Aviso de lo que se perdería** (`src/nucleo/sincronia.js`), al recibir un paquete y al restaurar un respaldo completo: filas de aquí más recientes o posteriores al último respaldo restaurado. En la Mac, avisa si restaurar el respaldo del iPhone borraría TC calificados ahí.
- **Recordatorio:** el aviso de Inicio se vuelve urgente (rojo) si hay registros sin respaldar y pasaron más de `recordatorio_dias` desde el último respaldo (`config/respaldo.json`, 2 días).
- **Pruebas** (143 en total, 10 nuevas: 9 en `tests/respaldo.test.js` y 1 en `tests/pwa.test.js`):
  - Listo cuando: el .zip se exporta, se borra todo, se restaura y los datos quedan idénticos. Se comprueban también cada celda de cada CSV, el BOM y el CRC.
  - Listo cuando: un paquete pasa de la Mac al iPhone y los eventos quedan idénticos, con las mismas notas; lo demás no cambia.
  - Pérdidas, validación, recordatorio, CSV y zip, y claves de las tablas.
  - Ningún archivo publicado ni de `/config` está ignorado por git. La regla `respaldo*.json` del `.gitignore` ignoraba `config/respaldo.json`, y la app publicada no habría podido cargar la configuración. Ahora hay una excepción explícita y esta prueba lo vigila.
- El .zip se comprobó además con `unzip -t` y con `zipfile` y `csv` de Python.

**Verificado en el navegador** (demostración; 375 px, Mac y modo oscuro):
- Enviar eventos: lista por curso, «Todos / Ninguno», botón fijo al pie y «Archivo listo» con el paquete (1 KB).
- Recibir un paquete con cambios y un conflicto: la comparación por evento y el aviso en rojo; reemplazar; volver a recibirlo da «No hay cambios». Un paquete abierto desde «Restaurar un respaldo…» también se reconoce.
- Respaldo completo de la demostración: 55 KB, 22 archivos con CRC correcto y el JSON idéntico al leerlo de vuelta, en 21 ms.
- Restaurar un respaldo viejo avisa del TC1 calificado después.
- El menú ⋯ de un TC y de una sesión, y el aviso urgente de Inicio.
- Sin errores en la consola.

**Decisiones de implementación**
- **Un paquete reemplaza eventos enteros**, no fila por fila: es lo predecible. La app no guarda en qué dispositivo se registró cada fila ni lo que se borró, así que en vez de mezclar compara fechas y avisa.
- **Varios eventos en un paquete:** por ejemplo, los TC de los dos cursos SQI van en un solo archivo.
- **Los estudiantes no viajan en el paquete**, salvo los visitantes del evento: la nómina se lee del Excel en cada dispositivo.
- **Los CSV son para leer:** no se restauran. El JSON del mismo .zip es el que se restaura.
- **Sin registros nuevos no hay recordatorio**, aunque el último respaldo sea viejo.

## Fase 8 (4-oct-2026) · métricas · versión 0.10.0

Detalle en [docs/metricas.md](docs/metricas.md).

**Hecho**
- **Tablero** («Inicio › Métricas» y «Métricas del curso»):
  - Alcance: todos los cursos, una metodología o un curso.
  - Periodo: 1.er bimestre, 2.º bimestre o semestre.
  - Dos vistas: **Para presentar** (agregada, sin nombres) y **Profesor** (con quién falta, quién está en riesgo y los grupos por revisar).
- **Métricas** (`src/nucleo/metricas.js`, funciones puras sobre lo registrado):
  - Asistencia y permanencia por curso, grupo, sesión, día, franja y estudiante.
  - Distribución por criterio o aspecto en cada práctica, y de la evaluación integral en los talleres.
  - Etiquetas más marcadas.
  - TC: entregas y promedio por pregunta, de menor a mayor.
  - Control oral: cobertura por curso; respuestas 0/1/2 y aprobados; resultados por concepto.
  - Preparatorio por sesión (Clásica).
  - Evolución entre eventos, por metodología.
  - Feriados: sesiones perdidas, recuperaciones y sesiones que quedan para el control oral.
  - Comparación entre cursos.
  - Comparación entre metodologías: solo notas normalizadas de prácticas y talleres, nunca la nota total.
  - Estudiantes y grupos en riesgo.
- **Advertencias obligatorias** (`config/metricas.json`):
  - Muestras pequeñas.
  - Franjas de una sola metodología. Se calcula con los cursos: «la franja 07:00–09:00 solo tiene cursos SQI; las demás, solo Clásica».
  - Metodologías: descripción, no comparación causal.
- **Control oral por concepto:**
  - Cada práctica o taller puede listar `conceptos_control`. En la pantalla del control, cada pregunta tiene un selector opcional del concepto.
  - Se guarda en `controles.conceptos`; no hace falta cambiar la base.
  - Conceptos escritos para P1 (Clásica y SQI) y T1.
- **Gráficos SVG propios** (`src/nucleo/graficos.js`, sin librerías): barras, distribuciones, evolución y tablas.
  - En la pantalla se dibujan al ancho real (teléfono o Mac) y siguen el tema claro u oscuro.
  - En el navegador, el texto se mide con un lienzo para que nada se salga.
- **Exportar para presentar** (`src/nucleo/tablero.js`):
  - La lámina lleva las mismas secciones de la vista para presentar, con las advertencias y sin nombres.
  - **Imagen PNG** de una sola pieza.
  - **PDF** A4, con una imagen por página y sin cortar secciones. El escritor de PDF es propio, de unas 60 líneas (`src/nucleo/pdf.js`).
  - En el iPhone el archivo se prepara y se comparte con un toque; en la Mac se descarga.
- **Clases ficticias** en la demostración (Datos): simula hasta la semana 5, el 1.er bimestre o el semestre en todos los cursos.
  - Usa una semilla fija.
  - No toca lo registrado a mano y se niega a trabajar en la base real.
- **Pruebas** (133 en total, 10 nuevas):
  - Listo cuando: tablero con datos ficticios de varios eventos y lámina en páginas y continua, con las advertencias y **sin ningún nombre ni código**. PDF con estructura y desplazamientos válidos.
  - Simulador: solo demostración, no pisa lo registrado y es reproducible.
  - Asistencia, rúbricas (con penalización y escalas SQI distintas), control por concepto (y quitar una pregunta), preparatorio, TC, feriados y riesgo, contra cálculos a mano.
  - Advertencia de franjas calculada, recortes de texto y configuración.

**Verificado en el navegador** (demostración con el 1.er bimestre simulado; 375 px, 1100 px y modo oscuro):
- Tablero de todos los cursos y de GR7SA (asistencia por grupo).
- Vista del profesor.
- Concepto del control: elegir y quitar una pregunta.
- PNG de 1252 × 12779 px (2,3 MB) y PDF de 10 páginas (3,4 MB), generados en menos de 0,3 s cada uno.
- Sin errores en la consola.

**Decisiones de implementación**
- **Asistencia** = vinieron (presentes y quienes se retiraron antes) / registrados. **Permanencia** = se quedaron / vinieron. Solo cuentan los pases cerrados y los estudiantes activos.
- **Notas que se comparan:** la nota de grupo normalizada (prácticas y talleres) y la de cada unidad del TC. Así la asistencia no se mezcla con el desempeño, porque se muestra aparte.
- **Riesgo por rendimiento:** menos del 60 % de lo posible en lo evaluado, y solo desde 2 actividades con nota. Con una sola, una falta deja el componente en 0 y la proyección exagera. Los umbrales son valores por defecto, para revisar con Joel.
- **Talleres separados por metodología** en la distribución y en la evolución, para no mezclar Clásica y SQI.
- **La lámina se exporta solo desde la vista para presentar.** La vista del profesor no se exporta.

## Fase 7 (4-oct-2026) · feedback · versión 0.9.0

**Antes (0.8.1): el nombre del profesor pasa a un ajuste del dispositivo** (pedido de Joel: no quiere su nombre en el repositorio, que es público).
- Datos › «Este dispositivo» › «Tu nombre»: se guarda en la base local del dispositivo (`lab-mn-2026B-local`), no en la configuración, y no viaja en el respaldo. Se escribe una vez en el iPhone y otra en la Mac.
- Lo usan la columna PROFESOR de «Coordinación B1/B2» y la firma del texto para el profesor de un visitante. Sin él, esa columna queda vacía, la revisión del Excel lo avisa y lo pide en la misma pantalla, y el texto va sin firma.
- `semestre-2026B.json` ya no tiene `profesor`; las pruebas usan un nombre ficticio.

**Hecho**
- **Base versión 5** con la tabla `feedback`: solo lo que el profesor hizo con el texto (lo editado y si se copió). El texto generado no se guarda: se arma cada vez con lo registrado.
- **Generador** (`src/nucleo/feedback.js`, documentado en `docs/feedback.md`): arma el feedback solo con lo registrado.
  - Fuentes: puntajes por criterio o aspecto, etiquetas, nota del profesor (tal cual), control oral (sin decir quién) y puntajes por pregunta de los TC.
  - Estructura *lo mejor / a mejorar / sugerencia*; lo más bajo va primero.
  - Las etiquetas reemplazan la frase general de su criterio, aspecto o pregunta.
- **Plantillas en la configuración:**
  - Por etiqueta y por parte (criterio, aspecto, pregunta o `integral`), en cada actividad.
  - Por defecto en `config/feedback.json`, con el tono de cada metodología: Clásica concreto y correctivo («Sugerencia»); SQI con preguntas para explorar («Para explorar»).
  - Una frase puede ir por metodología (talleres comunes).
  - `npm run config` las valida contra las etiquetas y partes de cada actividad.
  - Escritas para P1 (Clásica y SQI), T1 y TC1, con frases en la voz del grupo («Respondieron sin explicar…»).
- **Pestaña «Feedback»** en prácticas, talleres y TC evaluados:
  - Por grupo: el texto editable (lo editado se guarda y se puede volver al generado), «Copiar», «Compartir» y «Copiar todos». Avisa si lo registrado cambió después de editar.
  - Corto: 2 o 3 líneas por grupo.
  - Curso: resumen sin nombres (promedios por sección o aspecto, preguntas de TC con más errores, etiquetas más marcadas, control oral y **qué reforzar**), con «Copiar».
- **Retro del taller:** ya no muestra los datos sueltos de la Fase 4. Muestra las 2 o 3 líneas de la práctica anterior y la nota del profesor, con un enlace al feedback completo.
- **Revisión de notas** (Notas del bimestre › «Revisión de notas»), para la semana 18:
  - Un estudiante a la vez, en letra grande, con su nota del bimestre y el desglose por componente.
  - Se pasa con ‹ › o se busca por apellido; no muestra las notas de los demás.
- **Pestañas en el iPhone:** cada una con su ancho natural. Las cinco de una práctica caben desde 390 px; con seis (talleres), la barra se desliza y la elegida queda a la vista.
- **Pruebas** (123 en total, 12 nuevas desde la 0.8.0):
  - Texto de grupos de Clásica y SQI, versión corta, resumen del curso, TC por pregunta, taller con frases por metodología y retro.
  - Ediciones guardadas y aviso de cambio; grupos sin evaluar y penalización total.
  - Validación de plantillas.
  - Que ningún texto lleve nombres ni códigos.
  - Nombre del profesor como ajuste del dispositivo (no viaja en el respaldo; sin él, aviso y columna vacía).
  - Base de la versión 4 a la 5.

**Verificado en el navegador** (demostración, 375 y 390 px):
- Feedback de P1 en GR2QB: textos, edición guardada al recargar, «Volver al texto generado», vistas Corto y Curso.
- Retro del T1, feedback del TC1 de GR1AA y revisión de notas de GR1AA y GR2QB.
- Ajuste «Tu nombre» en Datos y en la pantalla del Excel.
- Sin errores en la consola.

**Decisiones de implementación**
- «Nota baja» = 50 % o menos del máximo de la parte (`umbral_bajo`). En un TC, toda pregunta sin el puntaje completo va a «a mejorar».
- El control oral va sin nombres:
  - Si todos los integrantes consultados respondieron bien (75 % o más), va en «lo mejor».
  - Si alguno respondió por debajo del 50 %, va en «a mejorar», después de lo del trabajo del grupo.
- En SQI, un grupo sin nada que corregir recibe una pregunta para extender: la de una etiqueta positiva o una del banco de la práctica (distinta según el grupo).
- Copiar todos deja fuera a los grupos sin nada registrado.

## Fase 6 (4-oct-2026) · nota bimestral, excepciones y coordinación · versión 0.8.0

**Hecho**
- **Base versión 4** con dos tablas nuevas: `recuperaciones` y `plic`. Los estudiantes de otros cursos se guardan como «visitante» en `estudiantes` (ver `docs/modelo-datos.md`).
- **Notas del bimestre** (Curso › «Notas del bimestre»):
  - Tabla por estudiante con cada componente y el total. Se elige el 1.er o el 2.º bimestre.
  - Se ve la nota **acumulada** (lo pendiente cuenta 0) o la **proyectada** (lo pendiente sale como el promedio de lo evaluado), nunca mezcladas. ✓ marca la nota completa, la que va al Excel y a coordinación.
  - Desglose por estudiante: cada actividad con su peso renormalizado, su nota o el motivo (pendiente, feriado, falta, ajuste, recuperación). En Planificación y conocimiento, los preparatorios y los controles con sus promedios.
  - Arriba: lo que falta evaluar del bimestre (con el motivo) y el aviso de control oral (ver abajo).
- **Sesiones sin clase:** en cada sesión, el menú ⋯ permite:
  - Marcarla «sin clase» con motivo. Sus actividades (y el TC de esa práctica) quedan excluidas en ese curso y los componentes se renormalizan.
  - Indicar que en un feriado del calendario sí hubo clase.
  - Deshacer el cambio. Lo registrado nunca se borra.
- **Recuperaciones de estudiantes del curso:**
  - En el resumen del evento, quien faltó tiene «Registrar recuperación…», con tres estados: solicitada (nota pendiente), realizada (con la nota recibida) y no asistió (0).
  - En un feriado o una sesión sin clase, la pantalla del evento busca al estudiante y registra la recuperación, que es opcional.
  - Con la recuperación realizada, el preparatorio de la sesión que faltó no entra en su promedio. Las observaciones del Excel dicen dónde recuperó.
- **Estudiantes de otros docentes que recuperan aquí:**
  - En la pantalla del grupo: «+ Agregar integrante › Estudiante de otro curso». Se piden código, apellidos y nombres y, opcionalmente, su paralelo y su profesor.
  - Queda presente y se califica con su grupo. Solo aparece en ese evento: no entra en el sorteo ni en el TC, ni en el Excel o coordinación, y volver a leer el Excel no lo da de baja.
  - En el resumen, «Recuperan aquí» arma el texto con su nota para su profesor (asistencia, nota con su desglose, preparatorio, control y la firma), con «Copiar» y «Compartir».
- **PLIC** (en su evento, 2.º bimestre):
  - «Completó · 0.5» o «No válido · 0» por estudiante.
  - Un botón marca de una vez a los que faltan como «completó»; después se corrigen las excepciones.
  - En la lista del curso aparece «Calificado» cuando están todos.
- **Aviso de control oral al cierre:** cuando quedan 2 sesiones o menos del bimestre (`aviso_cierre_sesiones` en `control-oral.json`), el curso y las notas muestran quién sigue sin control.
- **Recordatorio del envío** en Inicio: los días que faltan para el 1-dic (o el 29-ene) y los eventos que ya pasaron y siguen sin evaluar en todos los cursos. Se destaca a 14 días o menos (`dias_aviso_envio`).
- **Excel:** hojas «Coordinación B1» y «Coordinación B2» (ver `docs/excel.md`):
  - APELLIDOS Y NOMBRES | NÚMERO ÚNICO | NOTA(/6) | PROFESOR. El nombre del profesor es un ajuste del dispositivo desde la 0.8.1 (ver Fase 7).
  - Orden alfabético; los pendientes van aparte, en ámbar.
  - La nota es la misma de la hoja del curso, con 2 decimales.
  - La verificación antes de guardar conoce las hojas nuevas.
- **Pruebas** (111 en total, 9 nuevas):
  - Un 1.er bimestre completo de Clásica (GR2QB) y otro de SQI (GR1AA) contra el cálculo a mano, con feriado, faltas, «salió», «se retiró antes», recuperación y un estudiante sin control. Las notas dan 5.01, 4.30, 5.11 y 5.28 en Clásica, y 5.46, 4.36 y 3.79 en SQI.
  - Recuperaciones (los tres estados y el feriado), PLIC, sesión sin clase y deshacer.
  - Visitantes: nota, texto para su profesor y que no aparezcan en el Excel.
  - Pendientes y aviso de control.
  - Hojas de coordinación: cuatro columnas, 2 decimales, profesor y pendientes aparte; también en la prueba de ida y vuelta con el Excel ficticio.
  - Base de la versión 3 a la 4.

**Verificado en el navegador** (demostración, 375 px):
- Notas de GR1AA (acumulada y proyectada) y el desglose de un estudiante.
- PLIC: todos marcados como «completó» y uno corregido a «no válido».
- Un visitante agregado al grupo 1 de P1 de GR2QB, con su nota y el texto para su profesor; también se probó quitarlo.
- Recuperación en el T2 de GR2QB (feriado): realizada con 9/10.
- P3 marcada sin clase y vuelta atrás.
- La revisión del Excel lista las cuatro hojas propias.
- Sin errores en la consola.

**Decisiones de implementación**
- **Recuperación realizada:** la nota recibida reemplaza la del evento y el preparatorio de esa sesión no cuenta.
- **«No asistió» a la recuperación:** 0 en la actividad y en el preparatorio.
- **Recuperación de un feriado:** solo cuenta si se realizó; «solicitada» la deja excluida.
- **Visitantes:**
  - Se agregan como presentes, porque están en la sala; se corrigen como cualquiera.
  - No se pueden sortear para el control. Su texto incluye el control si se registró.
- **Coordinación:** una sola lista por bimestre con todos los cursos, por orden alfabético, y la nota solo cuando el bimestre está completo.
- El nombre del profesor estuvo en la configuración hasta la 0.8.0; desde la 0.8.1 es un ajuste del dispositivo (ver Fase 7).

## Fase 5 (3-oct-2026) · trabajos en casa (SQI) · versión 0.7.0

**Hecho**
- **Tabla `trabajos_casa`** (base versión 3): una fila por TC y unidad, con la entrega, el puntaje de cada pregunta y las etiquetas. La unidad sale de `unidad_calificacion` en la configuración de cada TC: por grupo (como ahora) o por estudiante.
- **Pantalla del TC** (en el curso, debajo de su práctica). Tiene dos pestañas:
  - «Grupos»:
    - Los grupos de la práctica con su estado: sin calificar, «8.5/10», «no entregó · 0» o «6 · faltan 2».
    - Quién faltó a la práctica.
    - El botón «Empezar» o «Seguir», que lleva al siguiente grupo por calificar.
    - Un grupo en el que faltaron todos queda atenuado: tiene 0 y no hace falta calificarlo.
  - «Resumen»: la nota de cada estudiante con el motivo de cada 0 o pendiente, el detalle por pregunta y el ajuste individual (también vale en un TC).
- **Calificación de un grupo:**
  - Integrantes con su asistencia en la práctica. Quien faltó aparece en rojo con «no vino a P1 · 0».
  - «Entregó» o «No entregó (0)».
  - Rúbrica oficial pregunta por pregunta: un toque por nivel (1 · 0.5 · 0, etc.).
  - Suma sobre 10 siempre a la vista, en la barra superior: «6.5/10 · faltan 2».
  - Etiquetas de errores comunes debajo de su pregunta (por ahora solo el TC1 trae etiquetas).
  - Nota del profesor (dictable).
  - Borrar la calificación, con confirmación.
- **Avance automático:**
  - Cuando un toque completa el grupo (la última pregunta, o «No entregó»), aparece «✓ 8.5/10 · pasando al grupo 4…» y a los 1.5 s la app abre el siguiente grupo por calificar.
  - Salta los grupos ya calificados y los que faltaron completos, y da la vuelta al llegar al final.
  - Con «Quedarme», o con cualquier otro toque, se queda. Al terminar el último grupo va al resumen.
- **En el Excel:** las columnas TC1…TC7 y «Trabajos en casa (/2 o /1.5)» ya existían; ahora tienen valores. El detalle del TC lleva:
  - Los puntajes por pregunta.
  - La nota del grupo.
  - Las etiquetas, con su pregunta.
  - La nota del profesor.
- **Curso y navegación:**
  - El TC muestra «Calificado · 6/6 grupos» o «En curso · 3/6 grupos».
  - El TC6 dice «Sin nota».
- **Aviso en la Mac:** si el dispositivo trabaja con un respaldo importado del iPhone, la pantalla del TC avisa que lo calificado ahí no vuelve al iPhone. En el iPhone no se avisa, porque allí restaurar es una recuperación.
- **Pruebas** (102 en total, 8 nuevas):
  - Componente: TC1 = 40 % de 2 puntos = 0.80 como máximo; TC1, TC2 y TC3 ponderados 40/25/35.
  - «No entregó» y faltas a la práctica.
  - Preguntas pendientes y pase sin cerrar.
  - TC individual, TC6 sin nota y ajuste en un TC.
  - Un TC1 completo contra la base: grupos de P1, avance automático, etiquetas, corrección y borrado.
  - Prueba de ida y vuelta del Excel con el TC1 de GR1AA calificado: las celdas coinciden con el motor y no cambia nada fuera de las zonas.
  - Actualización de la base de la versión 2 a la 3.

**Verificado en el navegador** (demostración, 375 px):
- GR1AA, tras cerrar el pase de P1: 6 grupos del TC1 calificados.
- Grupo 1 con 8.5/10 y dos etiquetas, pasando solo al grupo 2.
- Grupo 2 «no entregó».
- «Quedarme» en el grupo 5.
- Grupo 6 → grupo 4 (vuelta al pendiente).
- Al terminar, el resumen con «TC1 calificado: 6 grupos.».
- Sin errores en la consola.

**Decisiones de implementación**
- **Calificar una pregunta deja el TC como entregado.** «No entregó» conserva los puntajes (no cuentan), por si fue un toque equivocado.
- **Calificar un TC no crea instantánea de grupos:** el TC sigue a los grupos de su práctica.
- **Avance automático con 1.5 s de margen** y botón «Quedarme», para poder agregar una etiqueta o una nota antes de pasar.
- **Los TC se califican en el iPhone.** La Mac trabaja con copias del iPhone: lo que se registre ahí se pierde con el próximo respaldo que se importe. Si Joel prefiere calificar en la Mac, haría falta una importación que solo sume los TC (trabajo en varios dispositivos, previsto para más adelante).
- **Etiquetas solo en el TC1** (las del Anexo C). Las de TC2–TC7 se pueden agregar cuando lleguen sus hojas.

## Respaldo del día (3-oct-2026) · versión 0.6.0

Pedido de Joel: un solo archivo por día con todo (notas, asistencia, etc.) para subirlo a Drive, como respaldo por si algo le pasa al celular o a la Mac.

**Hecho**
- **«Exportar el respaldo del día»** genera un Excel. En el iPhone abre la hoja de compartir (Drive, Archivos o AirDrop); en la Mac lo descarga. El archivo tiene:
  - «Léeme», con lo registrado ese día.
  - Una hoja por curso con las notas.
  - «Asistencia (app)» y «Detalle (app)».
  - Una hoja muy oculta con los datos completos para restaurar.
- **«Restaurar un respaldo…»** (en «Datos» y en «Excel del semestre») acepta ese Excel y también el JSON anterior.
- **Aviso en Inicio** cuando hay registros sin respaldar, con el botón para exportar. Cuando todo está respaldado, muestra «Respaldo al día · hoy a las …».
- **4 pruebas nuevas** (94 en total):
  - El Excel guarda exactamente los mismos datos que el JSON y se restaura igual, incluso con emojis, textos largos y espacios en los bordes.
  - Se puede leer: Léeme, cursos y detalle.
  - El Excel del semestre no se confunde con un respaldo.
  - La base avisa cada escritura.

**Verificado en el navegador** (demostración): aviso en Inicio, exportación (0.6 s, 76 KB, 14 hojas), aviso «al día» y restauración desde el mismo Excel.

**Nota técnica**
- La librería de Excel, cuando corre en Node, comprime el archivo en bloques y puede partir un emoji en dos.
- En el navegador no pasa (convierte todo el texto de una vez), y nunca afecta letras con tilde.
- Por eso los datos del respaldo guardan los emojis como escapes de JSON.

## Publicación

- GitHub CLI (`gh`) se instala **dentro de `.venv`** con `scripts/instalar-gh.sh` (versión fija y suma SHA-256 verificada). Se usa con `scripts/gh.sh`, que guarda su configuración en `.venv/gh`.
- Repositorio público `JoelCC64/lab-mn-evaluacion`. La app se publica con GitHub Pages desde `main` en https://joelcc64.github.io/lab-mn-evaluacion/.
- Los commits van con el autor `JoelCC64` y el correo privado de GitHub (`156632030+JoelCC64@users.noreply.github.com`). Están configurados solo en este repositorio (`git config --local`).
- El 4-oct-2026 se reescribió el historial con un force push autorizado. Se quitó un nombre real del commit de la Fase 6 y se cambió el autor de todos los commits. El contenido de cada commit quedó idéntico, salvo en la Fase 6.
- Todo lo de la app usa rutas relativas, así que funciona en la subcarpeta de GitHub Pages. El service worker solo borra sus propias cachés (`lab-mn-…`).

## Pendiente

- **Configuraciones de las próximas actividades** (§8 del plan), a partir de sus guías:
  - Joel recibe el material de la semana **los viernes** y lo pasa para cargarlo. Cada vez hay que:
    1. Agregar las configuraciones (`config/actividades/`).
    2. Correr `npm run build && npm test`.
    3. Hacer commit y `git push`.
    4. La app del iPhone ofrece «Actualizar».
  - Sin su configuración, el evento no se puede evaluar en la app; la puerta, el control y el pase sí funcionan, y la evaluación se puede cargar después.
  - Las primeras que hacen falta:
    - P2 (Clásica y SQI): cronograma A, semana 5, desde el 26-oct.
    - T2: cronograma B, semana 5; cronograma A, semana 6.
- Plantillas de feedback de TC2–TC7, con sus etiquetas, cuando lleguen sus hojas; las de P2, T2, … con cada guía (ver `docs/feedback.md`), y sus `conceptos_control` (ver `docs/metricas.md`).
- Revisar con Joel los umbrales de riesgo (`config/metricas.json`) y los conceptos del control de P1 y T1.
- Revisar con Joel los días del recordatorio de respaldo (`config/respaldo.json`, 2 por defecto).
- Probar en el iPhone real: «Respaldo completo» y «Enviar eventos…» con la hoja de compartir (AirDrop a la Mac), y «Recibir eventos…» desde Archivos.
