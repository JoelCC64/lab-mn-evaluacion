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
| 5–9 | — | |

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

## Publicación

- GitHub CLI (`gh`) se instala **dentro de `.venv`** con `scripts/instalar-gh.sh` (versión fija y suma SHA-256 verificada). Se usa con `scripts/gh.sh`, que guarda su configuración en `.venv/gh`.
- Repositorio público `JoelCC64/lab-mn-evaluacion`. La app se publica con GitHub Pages desde `main` en https://joelcc64.github.io/lab-mn-evaluacion/.
- Los commits usan el correo privado de GitHub (`156632030+JoelCC64@users.noreply.github.com`).
- Todo lo de la app usa rutas relativas, así que funciona en la subcarpeta de GitHub Pages. El service worker solo borra sus propias cachés (`lab-mn-…`).

## Pendiente

- **Configuraciones de las próximas actividades** (§8 del plan), a partir de sus guías. Las primeras que hacen falta:
  - P2 (Clásica y SQI): cronograma A, semana 5, desde el 26-oct.
  - T2: cronograma B, semana 5; cronograma A, semana 6.
  - Sin su configuración, el evento no se puede evaluar en la app.
- Antes de la Fase 6: nombre del profesor para la columna PROFESOR de las hojas de coordinación.
- Fase 5: trabajos en casa (SQI).
