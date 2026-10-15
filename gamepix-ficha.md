# Neon Syndicate — ficha para GamePix

Todo listo para pegar en el Dashboard. Los datos de la columna "estado" salen de revisar el
código y de haber probado el juego en el navegador, no de suposiciones.

## Datos de la ficha

| Campo | Valor sugerido |
| --- | --- |
| **Título** | `Neon Syndicate` |
| **Orientación** | Landscape (horizontal). El juego también se adapta a vertical: la UI escala con `min(alto/720, ancho/1100)` |
| **Jugadores** | 1 (ver "Cooperativo" abajo) |
| **Categorías / tags** | Acción · Shooter · Roguelike. *La lista exacta de categorías del Dashboard no está publicada; en las fichas públicas de GamePix se ven etiquetas cortas tipo "Battle", "War", "Io". Elegí las equivalentes a Acción/Shooter y sumá "Roguelike" si está disponible.* |
| **Allow Distribution** | Recomendado **activarlo**: el juego no tiene enlaces externos ni analytics, así que cumple para distribución en sitios de terceros, y además genera ingresos extra |

## Descripción corta (una línea)

> Roguelike de acción en una ciudad cyberpunk procedural: elegí tu pandillero, tomá contratos y sobreviví distrito por distrito.

## Descripción larga

> **Neon Syndicate** es un roguelike de acción con vista cenital ambientado en una megaciudad
> cyberpunk generada proceduralmente. Sos un pandillero que intenta hacerse un nombre calle por
> calle: aceptás contratos de los fixers, saqueás pisos francos, hackeás cajeros y te enfrentás a
> bandas rivales que defienden su territorio.
>
> En cada partida elegís entre cuatro personajes con estilo propio —Dante "Solo", Kira, Mox y
> Ronin—, cada uno con su arma inicial y su habilidad exclusiva. La ciudad nunca es la misma:
> calles, barrios, escondites y jefes se reordenan en cada intento. Al subir de nivel elegís
> mejoras e implantes que se acumulan entre partidas, y los Chips que juntás los gastás en el
> Taller para desbloquear armas, personajes y mejoras permanentes.
>
> El objetivo final del juego es liberar los cinco distritos y derribar al Hegemón, el jefe que
> controla la ciudad. La dificultad escala rápido y la muerte es parte del proceso: lo que ganaste
> en Chips queda tuyo para siempre, así que cada caída te acerca un poco más a la cima.
>
> **Cómo se juega:** movete con WASD (o el stick izquierdo en táctil), apuntá con el ratón o con
> el stick derecho, dispará con clic, esquivá con Shift y usá tu habilidad con Espacio. Podés
> cambiar de arma con la rueda o las teclas 1-9, abrir el mapa con M, guardar la partida desde la
> pausa con Esc y hablar con los fixers para tomar misiones nuevas.

## Assets promocionales

| Archivo | Uso | Nota |
| --- | --- | --- |
| [shots/cover-titulo.png](shots/cover-titulo.png) | Portada / cover (1879×1057) | Capturada del juego real en el menú principal |
| [shots/screenshot-1-juego.png](shots/screenshot-1-juego.png) | Captura de gameplay (1879×1057) | Partida en curso con enemigos, HUD y minimapa |
| [shots/screenshot-2-personajes.png](shots/screenshot-2-personajes.png) | Captura de la selección de personaje (1879×1057) | Muestra los cuatro personajes y sus estadísticas |
| [docs/icon.png](docs/icon.png) | Icono | **Ojo:** es de 192×192. GamePix pide que el icono sea representativo y de buena calidad pero no publica el tamaño mínimo; si el Dashboard te deja subir uno más grande, exportalo a 512×512 para que no se vea borroso |

## Checklist antes de enviar

- [x] SDK de GamePix cargado como **primer script** del `<head>`
- [x] `GamePix.loading()` durante la precarga y `GamePix.loaded()` al estar listo
- [x] Anuncio interstitial **entre partidas**, y el juego queda pausado mientras se muestra
- [x] `updateScore()` / `updateLevel()` informados al SDK
- [x] `GamePix.localStorage` para el guardado
- [x] Pantalla de carga inicial con barra de progreso
- [x] Sin enlaces externos, sin analytics, sin ads ni SDKs de terceros
- [x] Recursos con rutas relativas (funciona servido desde un subdirectorio)
- [x] Sin botón de cerrar/salir en el menú
- [x] Pausa por Page Visibility (no al hacer clic fuera del iframe)
- [x] Probado dentro de un iframe de 640×480 sin recortes
- [x] Sin `window.alert` ni `window.confirm`
- [x] Probado con el SDK real de GamePix: el aviso de `loaded()` se aceptó y el anuncio se mostró

## Riesgos que conviene que sepas

1. **El juego está 100% en español.** La guía de GamePix dice que si el juego tiene varios idiomas
   debe usar el idioma del sistema y, si no se soporta, usar inglés por defecto. Un juego solo en
   español puede ser objetado en la revisión. La solución limpia es traducir los textos (están
   centralizados en `js/data.js`, `js/screens.js` y `js/chars.js`).
2. **El cooperativo LAN no existe en la versión web.** Era TCP/UDP de Electron; el navegador no lo
   permite. La build web lo detecta y **oculta** el botón "COOPERATIVO LAN" automáticamente, así
   que no queda una opción rota a la vista; pero no lo anuncies en la descripción de GamePix.
3. **El aspect ratio es de pantalla completa.** El juego ocupa todo el iframe; si el Dashboard te
   deja elegir, marcalo como Landscape.
