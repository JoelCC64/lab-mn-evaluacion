# Respaldo y varios dispositivos (Fase 9)

La app guarda todo en el dispositivo (IndexedDB), sin servidor. Para no perder nada y para trabajar en el iPhone y en la Mac hay tres archivos:

| Archivo | Para qué | Dónde |
|---|---|---|
| **Respaldo del día** (`respaldo-lab-mn-2026B-AAAA-MM-DD-HHMM.xlsx`) | Subirlo a Drive cada día. Se lee en Excel (notas por curso, asistencia, detalle) y se restaura | Datos › «Exportar el respaldo del día» (y el aviso de Inicio) |
| **Respaldo completo** (`respaldo-lab-mn-2026B-AAAA-MM-DD-HHMM.zip`) | Todo en JSON (se restaura) y cada tabla en CSV, para abrirla en Excel, Sheets, Python o R | Datos › «Respaldo completo en CSV y JSON (.zip)» |
| **Paquete de eventos** (`eventos-lab-mn-2026B-GR6CD-TC1-AAAA-MM-DD-HHMM.json`) | Pasar lo registrado en uno o varios eventos de un dispositivo a otro, sin reemplazar todo | Datos › «Enviar eventos…», o el menú ⋯ de un evento |

Los tres tienen datos de estudiantes: se guardan en un lugar seguro y el `.gitignore` impide que entren al repositorio. Ninguno lleva los ajustes del dispositivo (el nombre del profesor, la carpeta del Excel). En la demostración, los nombres llevan `-demo` y un paquete de la demostración no se abre con los datos reales (ni al revés).

En el iPhone, la hoja de compartir necesita un toque reciente. Por eso el archivo se prepara primero («Archivo listo») y se comparte con un segundo toque: Drive, Archivos o AirDrop a la Mac. En la Mac se descarga.

## Respaldo completo (.zip)

```
respaldo-lab-mn-2026B-2026-10-04-1530.zip
└── respaldo-lab-mn-2026B-2026-10-04-1530/
    ├── LEEME.txt
    ├── respaldo-lab-mn-2026B-2026-10-04-1530.json
    └── csv/
        ├── asistencia-2026-10-04-1530.csv
        ├── controles-2026-10-04-1530.csv
        └── … (una por tabla, también las vacías)
```

- **El JSON** es el respaldo de siempre (ver `docs/modelo-datos.md`). «Restaurar un respaldo…» acepta el .zip y busca ese JSON adentro. Ignora lo que agrega el Finder al volver a comprimir (`__MACOSX`).
- **Los CSV** son para leer: la app no los restaura.
  - UTF-8 con BOM (Excel reconoce las tildes), separador coma, punto decimal y fin de línea CRLF (RFC 4180).
  - Las primeras columnas son la clave de la tabla (`CLAVES` en `src/nucleo/tablas.js`). Las demás van en el orden en que aparecen.
  - Las listas y los objetos van como JSON en su celda: por ejemplo, los puntajes de un control `[2,1]` o los de un TC `{"1a":1}`.
  - Las notas no están: la app las calcula. Están en el respaldo del día (Excel).
  - En Python: `pandas.read_csv(ruta, encoding='utf-8-sig')`. En Excel: Datos › Desde texto/CSV, origen UTF-8, delimitador coma.
- **LEEME.txt** explica lo anterior y cuenta las filas de cada tabla.

El zip lo arma la app sin librerías (`crearZip` en `src/nucleo/zip.js`): deflate con `CompressionStream` (Safari 16.4+, Chrome 80+), y cada archivo va tal cual si comprimido ocupa más. Un semestre ficticio completo pesa unos 75 KB.

## Paquete de eventos

Sirve, por ejemplo, para calificar los TC en la Mac y pasarlos al iPhone, sin perder lo que el iPhone registró mientras tanto en otros eventos.

**Enviar** (en el dispositivo donde se registró):
- Datos › «Enviar eventos…» muestra los eventos con algo registrado, por curso, con cuántos registros tienen y su último cambio.
  - Ya vienen marcados los que cambiaron después del último respaldo restaurado en este dispositivo. En la Mac, eso es lo que se hizo ahí. Si nunca se restauró un respaldo, vienen marcados los que cambiaron hoy.
- O, en un evento, el menú ⋯ › «Enviar este evento a otro dispositivo».

**Recibir** (en el otro dispositivo): Datos › «Recibir eventos…». En la Mac, «Importar el respaldo del iPhone…» también acepta un paquete.
- Primero se comprueba el paquete. Se rechaza si:
  - es de otro semestre o versión, o de la demostración y no de los datos reales (o al revés);
  - tiene eventos que esta app no conoce;
  - trae filas de otro evento o tablas que no van en un paquete;
  - nombra estudiantes que este dispositivo no tiene (hay que leer antes el Excel del semestre).
- Después muestra, por evento, lo que hay aquí y lo que trae («Nuevo aquí», «Igual a lo que hay aquí», o cuántos registros y su último cambio a cada lado).
- **Avisa si se perdería algo de aquí** (ver abajo). Si es así, el botón «Reemplazar» va en rojo.
- Al confirmar, reemplaza **solo esos eventos** en una sola transacción: borra sus filas en las tablas de evento y sus visitantes, y guarda las del paquete. Lo demás no se toca.

```json
{
  "formato": "lab-mn-paquete",
  "version": 1,
  "semestre": "2026B",
  "demo": false,
  "creado": "2026-10-21T02:00:00.000Z",
  "app": "0.11.0",
  "config": "1085d56a757f",
  "eventos": ["GR6CD:TC1", "GR2QB:P1"],
  "tablas": { "trabajos_casa": [ … ], "asistencia": [ … ], "estudiantes": [ visitantes de esos eventos ] }
}
```

Un evento abarca sus filas en las tablas de evento (`TABLAS_DE_EVENTO`, todas con `evento`) y sus **visitantes**, que son estudiantes de otros docentes agregados a esa sesión. Un TC es su propio evento: usa los grupos de su práctica, pero no los lleva.

## Qué se perdería al reemplazar

La app no guarda en qué dispositivo se registró cada fila ni lo que se borró. Por eso compara las fechas de las filas (`fecha`; en los pases, `cerrado_en` y `reabierto_en`; en los visitantes, `actualizado`) y cuenta como pérdida:
- una fila de aquí con la misma clave que una del paquete, pero distinta y **más reciente**;
- una fila de aquí que el paquete no trae y que se guardó **después del último respaldo restaurado en este dispositivo**, porque eso se registró aquí. Si nunca se restauró uno, cuenta la que es posterior a lo último que trae el paquete de ese evento.

Es una estimación prudente: puede avisar de más (por ejemplo, una etiqueta que se quitó en el otro dispositivo), pero no deja pasar un cambio hecho aquí después de lo que trae el paquete.

**Al restaurar un respaldo completo** se hace la misma revisión con todos los eventos. Si la Mac calificó TC que aún no pasaron al iPhone, restaurar el respaldo del iPhone los borraría. La app lo avisa y sugiere enviarlos antes como paquete. La pantalla del Excel en la Mac lo recuerda junto a «Importar el respaldo del iPhone…».

### Flujo sugerido: TC en la Mac

1. En el iPhone: exportar el respaldo del día. En la Mac: «Importar el respaldo del iPhone…».
2. En la Mac: calificar los TC.
3. En la Mac: Datos › «Enviar eventos…». Ya vienen marcados los TC calificados ahí. Pasar el paquete al iPhone por AirDrop.
4. En el iPhone: Datos › «Recibir eventos…», revisar y «Reemplazar».
5. Desde ahí, el iPhone tiene todo: el próximo respaldo del día lo lleva.

## Recordatorio de respaldo

- Inicio avisa **cuando hay registros sin respaldar** en este dispositivo.
  - Cada escritura en la base anota la hora.
  - Exportar un respaldo (del día o completo) o restaurar uno anota la hora del respaldo.
- Si además pasaron **más de `recordatorio_dias`** desde el último respaldo (`config/respaldo.json`, por defecto 2), el aviso se vuelve urgente, en rojo: «Hace N días que no respaldas».
  - Si nunca hubo un respaldo, los días se cuentan desde el primer cambio sin respaldar.
  - Se cuentan días de calendario. La app vuelve a mirar al volver a primer plano, por si es otro día.
- Sin registros nuevos no hay aviso, aunque el último respaldo sea viejo: los datos son los mismos que ya están respaldados.
- Estas horas se guardan en `localStorage`, solo en este dispositivo (`lab-mn:ultimo-respaldo`, `lab-mn:ultimo-cambio`, `lab-mn:primer-cambio`, con el nombre de la base).

## Pruebas (`tests/respaldo.test.js`)

- **Listo cuando (1):** en una demostración con un bimestre simulado, más filas en todas las tablas y textos difíciles (comas, comillas, saltos de línea, ñ y emojis):
  - se exporta el .zip;
  - se comprueban los nombres con la fecha, el BOM, el CRC de cada archivo y cada celda de cada CSV;
  - se borra todo, se restaura desde el .zip y los datos quedan idénticos.
- **Listo cuando (2):** el iPhone (sin el TC1 de GR6CD) y la Mac, que restaura su respaldo, califica ese TC1 y agrega un visitante en P1 de GR2QB.
  - El paquete pasa al iPhone y los dos eventos quedan idénticos en los dos dispositivos, con las mismas notas calculadas.
  - Lo demás del iPhone no cambia.
  - Recibirlo otra vez no cambia nada.
- **Pérdidas:**
  - restaurar el respaldo viejo en la Mac avisa del TC1 y del visitante;
  - tras recibir el paquete y respaldar, ya no avisa;
  - un paquete nuevo de la Mac no da falsas alarmas;
  - un cambio posterior en el iPhone sí se avisa.
- Validación del paquete, recordatorio, CSV y zip (incluido el CRC frente a zlib), claves de las tablas y configuración.
