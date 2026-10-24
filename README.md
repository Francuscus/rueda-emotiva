# Rueda emotiva

Una aplicación en español para voz y habla, presentaciones y slam: una rueda de Plutchik interactiva, música en auriculares y grabación del poema con acompañamiento.

## Publicar con GitHub Pages

1. Abre **Settings → Pages** en este repositorio.
2. En **Build and deployment**, elige **Deploy from a branch**.
3. Selecciona **main** y **/docs**; pulsa **Save**.
4. Cuando GitHub termine de publicar, abre https://francuscus.github.io/rueda-emotiva/.

No hay instalación, dependencias de JavaScript, servidor ni claves. Los archivos de la aplicación son `index.html`, `styles.css` y `app.js`. Se puede alojar también en cualquier servidor HTTPS estático. Las fuentes de Google son opcionales; hay tipografías alternativas locales.

## Dos modos

**Explorar la rueda:** pulsa cualquiera de los 24 sectores. Hay ocho familias y tres intensidades; las intensidades altas están cerca del centro. Cada familia comparte su colección de pasajes entre sus tres intensidades. Al pulsar, se elige aleatoriamente un pasaje de esa colección. Puedes grabar también en este modo.

**Reto de interpretación:** conecta auriculares, confirma la casilla y pulsa **Elegir pasaje al azar**. La aplicación selecciona un pasaje de la colección habilitada, sin mostrar la familia ni el título. Escucha unos segundos, pulsa **Grabar poema** y recita el texto editable. El público puede proponer una emoción pulsando la rueda sin cambiar la música. Pulsa **Terminar** y después **Revelar emoción y pasaje**. La toma permite escuchar y descargar **voz + música** y **voz sola**. También puedes revelar una toma anterior desde su propia tarjeta. Las votaciones se hacen en esta pantalla; no hay conexión entre dispositivos ni análisis automático de emociones.

## Audio incluido y grabaciones reales

La aplicación funciona de inmediato con **dos bocetos musicales originales sintetizados por cada familia**. Son ejemplos de demostración, no interpretaciones ni grabaciones de Bernstein, Dolphy, Bartók u otros compositores recomendados. Las asociaciones emocionales son propuestas para el ejercicio, no clasificaciones universales o validadas.

En **Pasajes musicales** puedes:

- Añadir varios archivos por familia: MP3, WAV, M4A u OGG según los formatos compatibles con tu navegador.
- Especificar el inicio y el final del fragmento en segundos. El fragmento se repite hasta detenerlo.
- Desactivar los bocetos para que el azar elija exclusivamente tus archivos. Sin archivos para una familia, explorar esa familia mostrará un aviso.
- Conservar los archivos en IndexedDB, en este navegador y para este sitio. Si no hay almacenamiento disponible, quedan en memoria durante la sesión y la aplicación lo indica.
- Exportar la colección a JSON con el audio incluido e importarla en otra computadora. La colección no se distribuye automáticamente a los alumnos desde GitHub. El máximo es 40 MB por archivo y 100 MB de audio para exportar una colección.

Hay enlaces de búsqueda en YouTube para las obras sugeridas. **Estas grabaciones comerciales no están incluidas.** El reproductor incrustado de YouTube no proporciona una fuente de audio que esta aplicación pueda mezclar con el micrófono; utiliza archivos de audio autorizados. La licencia MIT del código no concede derechos sobre grabaciones añadidas por el profesor.

## Grabación, privacidad y uso en clase

- Usa HTTPS (GitHub Pages lo proporciona) o localhost y permite el micrófono cuando el navegador lo solicite.
- Selecciona los auriculares como salida en el sistema. El sitio no puede garantizar que la salida elegida sea privada. Haz una prueba antes de la actividad. El público oirá la voz en vivo, pero no debe oír la música.
- La música se envía a los auriculares y a la mezcla de grabación por controles de volumen separados. La voz se envía a la grabación y a la pista de voz sola; **no** se devuelve al altavoz ni a los auriculares.
- La toma comienza cuando el micrófono está listo. El acompañamiento se graba desde ese mismo momento, después del periodo de escucha inicial.
- Ajusta **Música en la grabación** y **Voz en la grabación** antes o durante la toma. Esos ajustes quedan incorporados a la mezcla original. Las nuevas tomas conservan además pistas independientes para ajustar el balance después.
- La grabación termina automáticamente a los cinco minutos y libera el micrófono. Un corte del micrófono también detiene la toma.
- Las tomas solo permanecen en memoria hasta cerrar o recargar la página. **Descarga las tomas para conservarlas.** Se avisa al salir, aunque algunos navegadores pueden omitir ese aviso.
- No se envían grabaciones a GitHub, a un profesor ni a otro servidor. No se necesitan cuentas de alumno.
- La descarga es WebM, M4A u OGG, según los formatos de MediaRecorder que permita el navegador.
- Cada nueva reproducción de una toma detiene la música en directo y pausa otras tomas. La grabación bloquea la reproducción de tomas para evitar realimentación.

## Comprobaciones

Ejecuta `node --check app.js` y `node --test tests/audio.test.cjs` (sin instalar paquetes). Las pruebas verifican la estructura de la rueda, las oposiciones, la privacidad del encaminamiento de audio, el final de la grabación y el ámbito de revelación de cada reto. No sustituyen una prueba real de micrófono y auriculares en los dispositivos del aula.

Prueba de clase: explora dos emociones; carga un archivo y recórtalo; desactiva bocetos; inicia un reto; graba unos segundos; adivina; revela; reproduce y descarga ambas versiones. Repite en los navegadores y teléfonos que utilizarán los estudiantes.

## Licencia

Código bajo MIT; consulta `LICENSE`. Audio añadido por los usuarios sujeto a sus respectivos permisos y licencias.

## Carpeta de publicación

GitHub Pages debe publicar desde `main` → `/docs`. La carpeta `docs/` contiene la copia publicada de `index.html`, `styles.css` y `app.js`; sincroniza esos archivos cuando cambies la aplicación de la raíz.

## Ajustar la mezcla después de grabar

Las nuevas tomas guardan voz y música por separado, antes de los controles de volumen de grabación. En la tarjeta de cada toma, usa **Voz** y **Música**, pulsa **Escuchar mezcla** y ajusta los niveles durante la reproducción. Puedes pausar y cambiar de posición. **Descargar mezcla ajustada (WAV)** renderiza ambas pistas con los niveles seleccionados al pulsar el botón. La mezcla incluye un limitador; la voz sola y la mezcla original siguen disponibles en el desplegable. La exportación WAV es estéreo PCM de 16 bits a 44,1 kHz. Las grabaciones anteriores que solo tienen una mezcla no se pueden separar retroactivamente. Las tomas siguen en memoria durante la sesión: descarga antes de cerrar o recargar.
