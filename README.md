# Neon Syndicate — build web (GamePix)

Roguelike 2D de calle en una ciudad cyberpunk procedural. Esta carpeta es la **build HTML5**
que corre en el navegador y que se publica en GamePix. El juego original es una app de
Electron (`main.js`, `preload.js`, `netmain.js` + `package.json`); esos archivos **no** forman
parte de esta build porque GamePix solo distribuye juegos web.

## Cómo jugar localmente

```bash
python -m http.server 8787 --bind 127.0.0.1
# abrir http://127.0.0.1:8787/index.html
```

No abrir `index.html` con doble clic: el protocolo `file:` rompe la carga de `assets/` y el SDK de GamePix.

## Integración con GamePix

| Requisito de GamePix | Cómo se cumple |
| --- | --- |
| SDK como primer script del `<head>` | `index.html` carga `https://integration.gamepix.com/sdk/v3/gamepix.sdk.js` en la primera línea del `<head>` |
| Pantalla de carga inicial | overlay `#ld` en `index.html`, que el juego elimina al tener el arte listo |
| Progreso de carga | `js/art.js` reporta `GamePix.loading(0-100)` mientras precarga sus 30 imágenes |
| Aviso de "listo" | `js/main.js` llama a `GamePix.loaded()` en el primer fotograma real |
| Anuncios entre partidas | `js/missions.js` (`settleRun`) pide un interstitial cuando termina una partida, nunca durante el juego |
| Pausa durante el anuncio | `js/main.js` detiene el bucle mientras `GPx.blocked` es `true` y lo reanuda cuando el SDK resuelve |
| Score y nivel | `GamePix.updateScore()` / `updateLevel()` en el cierre de partida y en cada subida de nivel |
| Guardado en iframe | `GPx.store` usa `GamePix.localStorage` (el `localStorage` normal se purga en iframes) con respaldo local |
| Sin botón de cerrar | el botón SALIR y la ayuda de F11 quedan desactivados en la build web |
| Sin recursos externos | todos los assets usan rutas relativas; no hay analytics, ads ni SDKs de terceros |
| Iframe 640×480 | `js/ui.js` escala con `min(alto/720, ancho/1100)`, así que la UI entra sin recortes |
| Pausa al perder foco | Page Visibility API en `js/main.js` (no al hacer clic fuera del iframe) |

### `js/gpx.js`

Puente único hacia el SDK. Si `window.GamePix` no existe (desarrollo local, versión de
escritorio o fallo de red) **todas las llamadas se vuelven no-op** y el juego sigue funcionando.

## Estructura

```
index.html          entrada del juego (SDK + pantalla de carga)
js/                 lógica y render (canvas 2D)
assets/             30 imágenes webp (personajes, enemigos, jefes, armas)
icon.png            192x192
```
