# Planner Estrellas

Planner personal para iPhone. Anotas tus tareas del día, la app las ordena en tus horas libres alrededor de tus clases, cronometras cuánto le dedicas a cada una y ganas estrellas para canjear en tu tienda de permisos.

Es una PWA (app web instalable): se publica gratis en GitHub Pages y se agrega a la pantalla de inicio del iPhone. Tus datos se guardan solo en el teléfono.

## Qué hace

- **Hoy**: tu día ordenado automáticamente. Lo que vence hoy o marcas "sí o sí" va primero, lo fácil y corto va entre clases y lo que no alcanza se puede pasar a mañana. Si un día no hay clase, la marcas con "No hay" y se libera ese tiempo.
- **Tareas** con tiempo estimado, dificultad, fecha de entrega, ramo, tipo de actividad y subtareas que se pueden avanzar en momentos distintos.
- **Foco**: cronómetro por tarea o subtarea. Sigue contando aunque cierres la app, porque guarda la hora de inicio.
- **Calendario** con evaluaciones, entregas y eventos, más tu horario semanal de clases.
- **Semana**: horas de foco por día, tareas hechas y una tabla de **carga académica** por ramo y tipo de actividad, con botón para copiarla. Úsala con "Semana pasada" cuando llenes la encuesta.
- **Asistencia**: en Hoy marcas cada clase como "Fui", "Falté" o "No hubo". Ir a clases suma estrellas y en Semana ves tu porcentaje de asistencia por ramo.
- **Colores**: cada ramo y cada categoría de actividad (coro, salidas, etc.) tiene su color, de la paleta o elegido a mano, y así se pintan en el horario y en tu día.
- **Tienda de permisos**: 1 estrella por minuto de foco, bono por tarea terminada según dificultad, estrellas por ir a clases y multiplicador por racha. Los premios y precios los defines tú.
- **Temas**: en Ajustes cada persona elige los colores de toda la app: 9 temas listos (incluidos dos oscuros) o uno propio con su color principal, su acento y modo oscuro. Los datos y el tema viven en cada teléfono, así que cada amiga tiene el suyo.
- **Ajustes**: ramos, tipos de actividad, horario del día, reglas de estrellas y respaldo (descargar e importar).

## Subirla a GitHub y publicarla

Necesitas [Node.js 22](https://nodejs.org) y una cuenta de GitHub.

1. Crea un repositorio nuevo en GitHub, por ejemplo `planner`. Puede ser público o privado (Pages en repos privados requiere GitHub Pro, que es gratis con el [GitHub Student Developer Pack](https://education.github.com/pack)).
2. En la carpeta del proyecto:
   ```bash
   npm install
   git init
   git add .
   git commit -m "Primera versión del planner"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/planner.git
   git push -u origin main
   ```
3. En GitHub, entra a **Settings → Pages** y en **Source** elige **GitHub Actions**.
4. Ve a la pestaña **Actions**: el workflow "Publicar en GitHub Pages" corre los tests, compila y publica. Cuando termine, tu app queda en `https://TU-USUARIO.github.io/planner/`.

Cada vez que hagas `git push` a `main` se vuelve a publicar sola, y la app del iPhone se actualiza la próxima vez que la abras.

## Instalarla en el iPhone

1. Abre el link en **Safari** (tiene que ser Safari).
2. Toca el botón **Compartir** y luego **Agregar a pantalla de inicio**.
3. Ábrela desde el ícono: se ve a pantalla completa, como app.

Importante: los datos de la app instalada quedan separados de los de Safari. Úsala siempre desde el ícono y descarga un respaldo en Ajustes de vez en cuando.

## Desarrollo

```bash
npm install
npm run dev        # servidor local en http://localhost:5173
npm test           # tests de la lógica (orden del día, estrellas, estadísticas)
npm run build      # compila a dist/
```

Para probarla en tu iPhone mientras desarrollas, corre `npm run dev -- --host` y abre en el teléfono la dirección "Network" que aparece (ambos en la misma red Wi-Fi).

## Estructura

```
src/
├── types.ts              Modelo de datos
├── lib/                  Lógica pura, sin React (testeada)
│   ├── scheduler.ts      Ordena las tareas en los huecos libres del día
│   ├── rewards.ts        Rachas y cálculo de estrellas
│   ├── stats.ts          Estadísticas semanales y carga académica
│   └── time.ts           Fechas y horas
├── store/
│   ├── useStore.ts       Estado de la app (Zustand), guardado en localStorage
│   ├── useUI.ts          Navegación y avisos
│   └── defaults.ts       Datos iniciales y ajustes por defecto
├── hooks/                useNow (reloj), useDerived (saldo, racha)
├── components/           Piezas reutilizables: navegación, hoja modal, íconos
├── screens/              Una carpeta por pantalla, con su CSS module
└── styles/               tokens.css (colores y medidas) y global.css
```

Los colores del tema original están en `src/styles/tokens.css`. Los demás temas se definen en `src/lib/theme.ts` (`THEME_PRESETS`): cada uno indica solo fondo, superficie, texto, color principal y acento, y el resto de los tonos se calcula cuidando que el texto se lea (lo revisa `theme.test.ts`).

### Cómo ordena el día

`planDay()` en `src/lib/scheduler.ts`:

1. Calcula los huecos libres entre tu hora de inicio y fin, descontando clases, actividades y eventos con hora. Si es hoy, parte desde la hora actual.
2. Un hueco es "corto" si dura menos de 60 min o si está entre dos bloques y dura hasta 90 min. Ahí solo entran tareas fáciles o medias que quepan, prefiriendo las más fáciles.
3. En los huecos largos va primero lo urgente (vence hoy o "sí o sí"), luego lo que vence mañana, y a igual urgencia lo más difícil. Si una tarea no cabe entera, se agenda un trozo de al menos 25 min.
4. Las subtareas se agendan en orden y el tiempo que ya cronometraste se descuenta del estimado.
5. Lo que no cabe aparece en "No alcanza hoy".
6. Los días con clases agrega dos traslados (ida y vuelta, 1 h cada uno, ajustable en Ajustes). Cuentan como tiempo ocupado y solo reciben tareas marcadas "Se puede en el transporte". Puedes moverlos, quitarlos ese día o darles inicio con "Salgo ahora".
7. Las tareas que arrastras (desde el ícono de puntitos) quedan fijadas en esa hora o traslado, y el resto se reordena alrededor. Tocar los puntitos abre "Mover" para elegir la hora exacta; "Fijada ×" la suelta.
