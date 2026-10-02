# MINSA ERP — app (v0.6.0, fase 5: Gastos)

PWA del ERP de MINSA ENERGY (`erp.minsaenergy.com`). Sustituirá a MINSA Proyectos: mismo login de Entra
(se **reusa su app registration**), mismas listas `PROY_*` del sitio Administración, cara nueva. El plan vive en
`../docs/plan.md`; v0.1.0 fue su fase 3 (el motor traído); **v0.2.0 arranca la fase 4** con la maqueta aprobada el
2026-10-01 (forma) y `esquema.json` (nombres de datos).

## De dónde sale el motor

Copiado de `minsa-proyectos-app/app` **v0.160.0, commit `2489517`** (2026-10-01):

| Traído tal cual | Ajustado | Nuevo en el ERP |
|---|---|---|
| `graph.js` · `reglas.js` · `lote.js` · `esquema.json` · `servidor-local.js` · `minsa-ui.css` · `vendor/` · `iconos/` · `marca/` · `_config.yml` · `.gitignore` · `.gitattributes` · `test/reglas.test.js` · `test/lote.test.js` · `test/vendor-vigente.js` | `comun.js` (VERSION; **v0.2.0: arreglo de `mesDia`**, ver abajo) · `config.js` (+`redirectProduccion`) · `sw.js` (caché `minsa-erp-v5` desde v0.5.0) · `manifest.json` · `CNAME` · `package.json` · `test/sw.test.js` · `test/datos.test.js` · `test/e2e.ps1` | `index.html` · `app.js` · `pantallas.js` (v0.2.0) · `estilo.css` · `test/pruebas.html` |

**No se trajeron** las vistas de Proyectos (`vistas.js`, `tablero.js`, `capital.js`, `chat.js`, `docs.js`): se leyeron
como referencia de qué campos pinta cada pantalla, y las del ERP se escriben nuevas en `pantallas.js`.

- `estilo.css` = fuentes + paleta + shim de tokens de Proyectos, con los **valores de color de la maqueta** (claro
  `#f7f8fa`/`#111111`, oscuro azul noche `#0b1220`/`#131c2c`, marca `#69c6ff` en oscuro) sobre los mismos nombres, más el
  acomodo de v0.2.0 (rail 264 px → pestañas abajo a ≤ 720 px, Saira 600 en títulos, Barlow en el texto).
- `lote.js` conserva `APP = 'minsa-proyectos'` **a propósito**: `recibo-lote.py` (skills de archivar) solo emite
  recibo para esa app. Cambiarlo es decisión de la pantalla Archivos, de la mano del script.
- `esquema.json` **no cambia** (decisión 6 del plan: mismas `PROY_*` mientras Proyectos viva).
- **`comun.js` `mesDia` (v0.2.0):** un día suelto `YYYY-MM-DD` se volvía a pasar por `diaDe` (medianoche UTC = día
  anterior en México), así que `fechaVence` —y con ella `chipVence`— decía «venció 27 sep» de una tarjeta del 28. El
  bug **viene de Proyectos v0.160.0 y allá sigue** (no se tocó Proyectos). Lo caza la E2E («la hoja de calendario y el
  chip dicen el mismo día»).

## Qué escribe (v0.3.0) — y en qué listas

`tarjetas.js` (nuevo) porta las escrituras del tablero de Proyectos v0.160.0 (`tablero.js`) con el mismo motor
(`graph.js`: If-Match/412; `reglas.js`: `PUEDE`, `camposDeMovimiento`, `sellarAsignadoPor`; `comun.js`: `registrarActividad`).

| Acción | Dónde se hace | `PROY_Tareas` | `PROY_Actividad` (misma frase que Proyectos) |
|---|---|---|---|
| Crear | «+ Nueva tarea» → diálogo `.mn-dialog`; el botón dice qué falta («Falta el título», «Falta una fecha válida») | POST: `Title` (MAYÚSCULAS, como Proyectos v0.107.0), `ProyectoId`, `Columna`, `Asignado`, `Vence`, `Prioridad`, `Orden`, `Descripcion`, `Desde`, `HechoPor/HechoEl` si nace en hecho, `AsignadoPor` si la lista lo tiene | `crear-tarea` «creó «X» para Y» |
| Mover | Arrastrar a otra cubeta (escritorio) o «Mover a» en la ficha (celular y teclado) | PATCH con If-Match: `Columna`, `Desde`, `HechoPor/HechoEl` (sella al entrar a hecho, `null` al salir) | `mover-tarea` «movió «X» de A a B» |
| Editar | Ficha: título, asignado, vence, prioridad; un PATCH con **solo lo que cambió** | PATCH con If-Match (+`AsignadoPor`) | `editar-tarea` «asignó «X» a Y» / «editó «X»» |
| Borrar | Ficha, solo gerencia, dos toques | DELETE; suelta `TareaId` de sus `PROY_Ligas` (best-effort) | `borrar-tarea` «borró «X»» (sin `TareaId`) |

- **Roles** (`PUEDE`): lectura no escribe (ni forzando la función: la E2E lo prueba) y ve la ficha deshabilitada;
  colaborador crea, edita y mueve; solo gerencia borra. Proyecto cerrado: nada se escribe.
- **412**: no se pisa — se releen las listas (`fijarReleer` en app.js), se avisa y la ficha abierta se repinta con lo nuevo.
- **Esquema**: no cambia; la E2E coteja cada campo escrito contra `esquema.json` (PROY_Tareas y PROY_Actividad).
- Lo que el ERP **no** porta todavía de la ficha de Proyectos: color en edición, subir/bajar orden, «crear y otra». Se editan
  en MINSA Proyectos. (Descripción, notas y documentos llegaron en v0.5.0, abajo.)
- **PENDIENTE de Carlos — escribir una vez en real por lista.** Desde aquí no hay tenant: nada de esto se ha escrito contra
  SharePoint real. Antes de usarlo en serio hay que crear, mover, editar y borrar una tarjeta de prueba en `PROY_Tareas`
  (y ver los 4 renglones en `PROY_Actividad`, y que Proyectos los pinte igual).

## Qué hace (lectura, desde v0.2.0; Archivos y Equipo en v0.5.0, abajo)

| Ruta | Pantalla |
|---|---|
| `#inicio` (y todo hash desconocido) | Saludo + **Mis pendientes**: tareas abiertas de `PROY_Tareas` con `Asignado` = yo, agrupadas por vencimiento (vencidas · hoy · esta semana · más adelante · sin fecha); el rail lleva el contador (`misAbiertas`, la misma función). Debajo, los proyectos activos. |
| `#proyectos` | Activos ordenados por `Vence` (por hacer / en curso / hechas por tarjeta) y los cerrados plegados. |
| `#p/<clave>` | Tablero kanban del proyecto con **sus** cubetas (`Columnas`, o las 4 default) y una «Sin cubeta» si alguna tarjeta quedó en una borrada (no recibe arrastres). Desde v0.3.0 se escribe (arriba). |
| `#gastos` · `#gastos/tesoreria` | **Desde v0.6.0**: registrar un gasto, «Mis gastos» y, para tesorería, la cola por reembolsar (abajo). Mientras `ERP_Gastos` no exista en el sitio, dice «Gastos aún no está habilitado — falta crear la lista». |

Mismo formato de hash que Proyectos, así sus ligas `#p/<clave>` abren aquí. Tema: sin elección manda
`prefers-color-scheme`; los botones Claro/Oscuro (en celular, «Tema» arriba) fijan `data-theme` y se recuerdan en
`localStorage` (`erp.tema`, en try). Planta CALYTEK y Tablero salen en el rail como «próximamente» (ocultos en celular).
Lee `PROY_Proyectos`, `PROY_Tareas`, `PROY_Roles` (y las columnas reales de `PROY_Tareas`) y, desde v0.5.0, `PROY_Ligas` y `PROY_Actividad` (acotada a 90 días); escribe lo de las tablas de arriba y de v0.5.0.

## Pruebas

```
npm test            # piel al día, selectores, comentarios, reglas (214), lote (27), gastos (47), sw, datos
npm run test:e2e    # PowerShell + Edge headless, 5 corridas: v0.6.0 = gerencia 180 · colaborador 179 · lectura 107 · tesoreria 196 · sin-gastos 149 (v0.5.0: 143 · 142 · 86)
node ../herramientas-dev/capturas.mjs --salida ../docs/capturas/v<versión>   # 390/1366 × claro/oscuro, mide desborde
```

La E2E (`test/pruebas.html`) reusa **literal** el MSAL falso, el Graph falso y la bitácora del arnés de Proyectos.
Escenarios de v0.2.0: entrada y rol, rail (5 destinos + 2 próximamente, `aria-current`, contador), grupos de Mis
pendientes con fechas en hora de México, un título con HTML pintado como texto, de un pendiente a su proyecto, kanban
con cubetas default/propias/«Sin cubeta», lista de proyectos, clave inexistente, las «en construcción» (desde v0.5.0 solo Gastos; desde v0.6.0 ninguna), hash
desconocido, tema claro/oscuro con el color de fondo medido, y cero escrituras.

Capturas de v0.2.0: `../docs/capturas/v0.2.0/` (Inicio y Proyecto, 390 y 1366, claro y oscuro; `_mediciones.txt`:
overflowX = 0 en las 8).

La capa privada de `datos.test.js` lee `../herramientas-dev/datos-prohibidos.txt` (copia de la de Proyectos, fuera
de este repo).

## Qué falta

- Escribir una vez en real por lista (PENDIENTE de Carlos, arriba).
- Fase 4, lo que sigue (no cupo en v0.5.0): en la ficha, color, subir/bajar orden y «crear y otra»; en Archivos, mover una
  liga a otra tarjeta (F1 de Proyectos) y el árbol plegable de expediente (v0.33.0); borrar una nota.
- **Escribir una vez en real en `PROY_Ligas`** (subir un lote al buzón de CALYTEK, ligar, pegar enlace, quitar) y ver que
  Proyectos lo pinta igual y que `/archivar-calytek` reconoce el lote (PENDIENTE de Carlos, como el de `PROY_Tareas`).
- Remoto: repo público en la org MINSA-ENERGY + GitHub Pages (decidido; **sin crear**, este repo no tiene remoto).
- Medir el login real en `erp.minsaenergy.com` (la redirect URI la agregó Carlos en Entra, dicho por él, no medido).
- Fase 5: provisionar Gastos y escribir una vez en real (PENDIENTE de Carlos, sección v0.6.0); fase 6 (CFDI) sin empezar.

## Qué prueban las capturas de v0.2.0 (revisor-entregable, 2026-10-01)

- `docs/capturas/v0.2.0/` sale del **Graph falso de `test/pruebas.html`** («Persona de Prueba», «LAU CALYTEK (demo)», una tarea con `<img onerror>` sembrada a propósito para probar el escape). **Ninguna captura usa datos reales.**
- Las 8 capturas son del rol **gerencia**. La E2E sí corre los tres roles (45/0 cada uno), pero no hay capturas de colaborador ni de lectura.
- La regla de escribir una vez en real en cada lista **no aplica a v0.2.0**, que es solo lectura. Aplica desde la primera versión que escriba (mover/crear tarjetas, gastos).
- IBM Plex Mono (`--f-data`) está declarada y todavía no se usa: es solo para montos, y aún no hay pantalla de montos.

## Capturas de v0.3.0

`../docs/capturas/v0.3.0/`: Inicio, Proyecto, **Nueva tarea** (diálogo abierto) y **ficha** de tarjeta, a 390 y 1366, claro y
oscuro, para **gerencia y colaborador** (32 PNG; `_mediciones.txt`: overflowX = 0 y fuera-de-ancho = 0 en las 32, la
medición ya incluye el diálogo abierto). Mismo Graph falso: ningún dato real. Las fotos son del estado DESPUÉS de la E2E
(por eso aparecen «INFORME DE PRUEBA» y «Cambiada por alguien más»). `herramientas-dev/capturas.mjs` suma las vistas
`nueva` y `ficha`.

## v0.4.0 (2026-10-01) — decisiones de Carlos al cierre de v0.3.0

- **Sin iniciales en las tarjetas del kanban**: solo el nombre corto. Carlos quitó los avatares de toda la app de Proyectos
  en su v0.61.0 («no me gusta como se ve»). `iniciales()` sigue en `reglas.js` (probada) por si el chat la pide.
  Revertir: devolver el `span.av` en `tarjetaKanban` (`pantallas.js`) y la regla `.av` de `estilo.css`.
- **En celular, Tema y Salir dentro de «···»** arriba a la derecha (como `Celular.dc.html` de la maqueta): abajo de 720 px
  el rail con Salir se oculta y no había cómo cerrar sesión en un celular compartido. Es un `<details>` que se cierra al
  elegir, al tocar fuera o con Esc. Capturas a 390 px en `../docs/capturas/v0.4.0/` (vista `mas` = menú abierto).

## v0.5.0 (2026-10-01) — Archivos y Equipo (fase 4, paridad con Proyectos)

### Qué hace

| Dónde | Qué |
|---|---|
| `#archivos` | Todo lo ligado en `PROY_Ligas`, agrupado por proyecto, con filtro de proyecto, tipo (archivado · en el buzón · enlace) y texto; «dónde quedó» (biblioteca › carpeta, o el sitio del enlace); «Qué documentos faltan» por proyecto activo con su botón a Documentos; **Subir** eligiendo proyecto (solo los activos con biblioteca autorizada). Aquí no se quita (como `#archivos` de Proyectos). |
| `#p/<clave>/docs` (pestaña **Documentos**, con «faltan N») | Subir · Ligar archivado · Pegar enlace; **Qué documentos faltan** = tarjetas abiertas sin ninguna liga (el nodo «tarjetas sin documentos» del expediente de Proyectos), cada una con sus tres botones; los documentos agrupados («Del proyecto» y por tarjeta) con **Quitar**; el lote cuya carpeta ya no está en el buzón dice «ya lo acomodó la skill» y, si la skill dejó recibo, la liga se reemplaza sola (`aplicarRecibo`). |
| `#equipo` | Personas activas de `PROY_Roles`: rol, pendientes abiertos (`misAbiertas`) y **«Escribió en la app»** = renglones de `PROY_Actividad` firmados por la persona (`Quien`) en los últimos `CONFIG.actividadDias` (90), con cuántos y la última fecha; arriba «N de M» y la meta del plan (6 de 10 a 6 semanas de compartir). Cuenta lo escrito desde Proyectos también (misma bitácora). Sin avatares. |
| Ficha de tarjeta | Suma **Descripción** (editable, viaja en el mismo PATCH con solo lo que cambió), **Documentos** de la tarjeta (con Quitar y Subir/Ligar/Enlace con la tarjeta puesta; la ficha cede el paso al diálogo y vuelve al guardar o cancelar) y **Notas** (las de `PROY_Actividad` `Accion=comentar`; anotar si el rol edita). |

Código nuevo en `archivos.js` (portado de `docs.js` de Proyectos v0.160.0: mismas funciones de guardar, mismos chequeos de rol,
mismo `_lote.json`); Equipo en `pantallas.js`; la ficha en `tarjetas.js`. `cargarTodo` ahora lee también `PROY_Ligas` y
`PROY_Actividad` acotada por `Cuando` (como Proyectos v0.13.1; si el filtro da 400, entera).

### Qué escribe y en qué listas

| Acción | SharePoint | `PROY_Actividad` (misma frase que Proyectos) |
|---|---|---|
| Subir | Biblioteca de la unidad: carpeta del lote en `99_Pendiente-Archivar/` → piezas → `_lote.json` al final (si falla a medias se borra la carpeta). `PROY_Ligas` POST `Tipo=buzon` | `subir` «subió «X» al buzón (N archivo(s))» |
| Ligar archivado | Lee la biblioteca (búsqueda fuera del buzón + relectura por id). `PROY_Ligas` POST `Tipo=archivado` (Url acortada a 255) | `ligar` «ligó «X»» |
| Pegar enlace | `PROY_Ligas` POST `Tipo=enlace` (solo http(s)) | `ligar` «pegó el enlace «X»» |
| Quitar | `PROY_Ligas` DELETE (con confirmación; el archivo no se toca) | `desligar` «desligó «X»» |
| Recibo de la skill | `PROY_Ligas` POST por pieza + DELETE de la liga buzon; borra el recibo de `_resueltos/` | `ligar` … «(archivado por la skill)» y `desligar` «reemplazó la liga…» |
| Anotar | `PROY_Actividad` POST `Accion=comentar` con `ProyectoId` y `TareaId` | (es el propio renglón) |
| Descripción | `PROY_Tareas` PATCH con If-Match, solo `Descripcion` (vacía = null) | `editar-tarea` «editó «X»» |
| Borrar tarjeta (ya existía) | además refleja en memoria el `TareaId: null` de sus ligas | — |

- **Roles** (`PUEDE.ligar`): lectura no sube, no liga, no pega, no quita, no anota — ni forzando las funciones (la E2E lo
  prueba); colaborador y gerencia sí. Subir/Ligar exigen biblioteca **autorizada** (`piloto` de `config.js`); sin ella, el
  botón dice por qué y solo queda Pegar enlace. Proyecto cerrado: nada se escribe.
- **Esquema**: no cambia (decisión 6); la E2E coteja cada campo escrito contra `esquema.json` (`PROY_Ligas`, `PROY_Actividad`).
- **`lote.js` sigue firmando `app: 'minsa-proyectos'`** (default elegido): `recibo-lote.py` e `inventario-buzon.py` solo
  reconocen esa app. Cambiarlo a `minsa-erp` es de la mano de esos dos scripts.
- **Default elegido**: «Escribió en la app» cuenta TODO renglón de la persona en la ventana de 90 días, incluido el ✓ «visto»
  de Proyectos. Revertir/ajustar: el filtro en `escriturasPorPersona` (`pantallas.js`).

### Cómo revertir

`git revert` del commit de v0.5.0 en este repo (no toca datos). Por partes: quitar `archivos.js` (y su import en `app.js`,
`pantallas.js`, `tarjetas.js`, su renglón en `sw.js`), devolver `archivos`/`equipo` a `EN_CONSTRUCCION` en `pantallas.js`, y
quitar del `<dialog id="dlgFicha">` las secciones `fDesc`/`fDocs`/`fNotas`. Lo que ya se haya escrito en real (ligas, lotes,
notas) queda en SharePoint y Proyectos lo sigue pintando: es el mismo formato.

### Capturas

`../docs/capturas/v0.5.0/`: inicio, proyecto, **archivos**, **equipo**, **docs** (pestaña Documentos) y **ficha**, a 390 y 1366,
claro y oscuro, rol gerencia (24 PNG; `_mediciones.txt`: overflowX = 0 y fuera-de-ancho = 0 en las 24). Graph falso: ningún
dato real; fotos del estado DESPUÉS de la E2E (por eso «INFORME DE PRUEBA», el lote «Informe de campo» y «Persona · Sí · 14»).

## v0.6.0 (2026-10-01) — Gastos (fase 5 del plan)

### Antes de que funcione: lo que tiene que correr Carlos

**Hasta que Carlos provisione, `#gastos` dice «Gastos aún no está habilitado — falta crear la lista»** y el resto de la app
sigue igual (la E2E corre la app entera sin esas listas: corrida `sin-gastos`). Para habilitarlo, una sola vez, con su cuenta:
los 10 pasos de **`../docs/gastos-instrucciones-carlos.md`** (permiso temporal `manage`, `herramientas-dev/provisionar-gastos.html`
crea `ERP_Gastos`, `ERP_Roles` y la biblioteca «Gastos» con su `_LEEME`, se regresa a `write`, versiones activadas y
`ERP_Roles` sin herencia) y **capturar en `ERP_Roles` quién es tesorería**. Sin un renglón activo de tesorería nadie puede
marcar un gasto como reembolsado (la pantalla lo dice si falta la lista `ERP_Roles`). Después, recargar la app.

### Qué hace

| Dónde | Quién | Qué |
|---|---|---|
| `#gastos` | quien escribe en la app (gerencia, colaborador) y tesorería | **«+ Registrar gasto»** (diálogo `.mn-dialog`, el botón dice qué falta): monto (total con IVA), moneda (MXN/USD), concepto, fecha del ticket (nace hoy; no futura), categoría, proyecto opcional (pone su equipo), equipo, notas, y el **comprobante opcional**: «Tomar foto» (`capture`, abre la cámara del celular) o «Elegir archivo» (foto o PDF). Sin comprobante, la nota es obligatoria (decisión 7). |
| `#gastos` | todos | **Mis gastos** (por `Solicitante`): fecha, concepto, proyecto · equipo, monto en IBM Plex Mono con su moneda, estado (registrado · reembolsado · rechazado con quién y por qué), «Ver comprobante» (abre la liga de SharePoint), el chip de CFDI **solo si la columna trae valor**, y «por reembolsarte» sumado por moneda. |
| renglón sin comprobante | su dueño, quien lo capturó o tesorería | **«Agregar comprobante»**: si la subida falló al registrar (o se registró sin ticket), se sube después. |
| `#gastos/tesoreria` | **solo tesorería** (`ERP_Roles`, `Activo`) | La cola de **todo lo registrado** del equipo (lo más viejo arriba), con solicitante y «capturó X» si fue otra persona; **«Marcar reembolsado»** y **«Rechazar»** (motivo obligatorio); KPIs: por reembolsar (por moneda), reembolsado este mes (por la fecha del reembolso), sin comprobante; **totales por mes y moneda** (pesos y dólares nunca se suman); los resueltos plegados. Señala el gasto que **ya se había reembolsado** y volvió a «registrado» (guarda contra el doble pago) y pregunta antes de volver a marcarlo. Tesorería además **captura por el empleado** («Para quién», decisión 5). |

Nadie más ve los botones de tesorería, y `marcarReembolsado`/`rechazarGasto` se niegan si se llaman a la fuerza (la E2E lo
prueba en las corridas gerencia y colaborador). Lectura ve sus gastos y no escribe nada, ni forzando (corrida lectura: «CERO
escrituras también con Gastos», tras forzar `abrirNuevoGasto`, el envío del formulario y `agregarComprobante`). Código: `gastos.js` (pantalla y escrituras) y
`gastos-reglas.js` (reglas puras, `test/gastos.test.js`). `ERP_Gastos` y `ERP_Roles` se leen **al entrar a `#gastos`**, no al
abrir la app.

### Qué escribe y dónde

| Acción | SharePoint (sitio Administracion) |
|---|---|
| Registrar | `ERP_Gastos` POST: `Title` (concepto), `Fecha` (18:00Z del día), `Monto`, `Moneda`, `Categoria`, `Equipo`, `ProyectoId`, `Solicitante`, `CapturadoPor`, `Estado=registrado`, `CfdiEstado=sin-cfdi`, `Notas` |
| Comprobante | Biblioteca **«Gastos»** (su propio drive, `/sites/{id}/lists/{Gastos}/drive`, **no** la biblioteca Documentos): carpeta `AAAA-MM` del mes del **ticket** (la crea si no existe; 409 = ya estaba) y el archivo `AAAA-MM-DD_GASTO-<ID>_<Ticket|Factura>_<descripcion>.<ext>` con `conflictBehavior=fail`: **nunca sobrescribe**, si existe prueba `_2`, `_3`… Luego `ERP_Gastos` PATCH (If-Match) de **solo** `ComprobanteItemId` y `ComprobanteRuta` |
| Marcar reembolsado | `ERP_Gastos` PATCH (If-Match): `Estado=reembolsado`, `ReembolsadoPor`, `ReembolsadoEl`. **Ningún otro PATCH de la app toca el sello**: no se limpia nunca |
| Rechazar | `ERP_Gastos` PATCH (If-Match): `Estado=rechazado`, `RechazadoPor`, `RechazadoEl`, `MotivoRechazo` (255). El renglón y el comprobante se quedan |

- **412**: no se pisa; se releen los gastos, se avisa y se puede volver a intentar.
- **No escribe** ninguna `PROY_*` ni `PROY_Actividad` (su `Accion` es un choice cerrado y la decisión 6 congela su esquema): la
  traza de Gastos es `CapturadoPor`/`ReembolsadoPor`/`RechazadoPor` más el historial de versiones de la lista (paso 10 de las
  instrucciones). Por eso **«Escribió en la app» de Equipo no cuenta los gastos** todavía.
- **Esquema**: `esquema.json` suma `ERP_Gastos`, `ERP_Roles` y la llave `bibliotecas`, idénticas a `../docs/gastos-esquema.json`
  (lo coteja `test/gastos.test.js` si encuentra el archivo); las `PROY_*` no cambian. `config.js`: `listas.gastos`,
  `listas.rolesErp`, `bibliotecaGastos`. `graph.js` suma `existeLista`, `driveDeLista`, `asegurarCarpetaEnDrive`, `subirADrive` e
  `itemDeDriveId`.
- **Columnas CFDI** (fase 6): solo se muestran si traen valor; al registrar se escribe `CfdiEstado=sin-cfdi` (el estado normal de la
  decisión 8). La tarea semanal y la confirmación de contabilidad **no** están.
- **PENDIENTE de Carlos — escribir una vez en real**: nada de esto se ha escrito contra SharePoint real. Después de provisionar:
  registrar un gasto con foto desde el celular (ver que llegue a `Gastos/AAAA-MM/` con el nombre de la convención), otro sin
  foto con nota, y marcar uno reembolsado y otro rechazado con la cuenta de tesorería.

### Defaults del implementador (se revierten en una línea)

- **Lectura no registra gastos** (como en el resto de la app); quien deba registrar necesita colaborador en `PROY_Roles` o
  tesorería en `ERP_Roles`. Revertir: `PUEDE_GASTO.registrar` en `gastos-reglas.js`.
- **Dos botones de comprobante** («Tomar foto» con `capture` y «Elegir archivo» sin él, como la maqueta) en vez de un solo
  `<input capture>`: con `capture` el celular abre directo la cámara y no deja escoger un PDF. Revertir: el bloque del
  comprobante en `dlgGasto` (`index.html`).
- **Un solo comprobante por alta** (foto o PDF, hasta 25 MB). Un segundo archivo del mismo gasto se sube a mano a la misma
  carpeta con el sufijo `_2` (lo dice el `_LEEME`). `COMPROBANTE_MAX_MB` en `gastos-reglas.js`.
- **La fecha del ticket no puede ser futura**. Revertir: la condición `c.dia > c.hoy` de `faltanGasto`.
- **`CfdiEstado=sin-cfdi` al registrar**. Revertir: quitarlo de `camposGasto`.
- **Se lee la lista entera** de `ERP_Gastos` (tesorería necesita todo; ~11 personas, todos ven todo en SharePoint). Si crece,
  filtrar por `Solicitante` (indexada) para quien no es tesorería, en `cargarGastos`.
- **El empleado ve solo sus gastos en la app**; contabilidad no tiene pantalla todavía (llega con la fase 6).
- **Nombre de quien no está en `PROY_Roles`**: se toma de `ERP_Roles.Nombre` (tesorería puede no tener rol de proyectos).

### Cómo revertir

`git revert` del commit de v0.6.0 en este repo (no toca datos). Por partes: quitar `gastos.js` y `gastos-reglas.js` (su import y
`pintarGastos`/`engancharGastos` en `app.js`, sus dos renglones en `sw.js`, `test/gastos.test.js` en `package.json`) y el
`<dialog id="dlgGasto">`; devolver `gastos` a `EN_CONSTRUCCION` en `pantallas.js`. Lo que ya se haya escrito en real
(renglones de `ERP_Gastos`, comprobantes en «Gastos») se queda en SharePoint: el revert no lo borra.

### Pruebas y capturas

- `npm test`: + `test/gastos.test.js` (47: esquema fundido contra los catálogos, roles, cola, totales, nombre del comprobante,
  lo que falta, campos que viajan).
- `npm run test:e2e`: 5 corridas — gerencia 180 · colaborador 179 · lectura 107 · **tesoreria 196** (colaborador + tesorería en
  `ERP_Roles`: cola, reembolsar con If-Match, doble pago, rechazar con motivo, 412, captura por otro) · **sin-gastos 149** (la app
  entera sin `ERP_Gastos`/`ERP_Roles`/biblioteca). Graph falso con el drive de «Gastos» (`/drives/drive-gastos/…`, 409 de
  verdad): alta con foto y choque de nombre (`_2`), alta sin foto con nota, subida que falla y «Agregar comprobante».
- Capturas: `../docs/capturas/v0.6.0/`, 390 y 1366, claro y oscuro, **página completa** (`capturas.mjs --completa`; con un
  diálogo abierto, además su pie en `*-pie`): gerencia = `gastos` (Mis gastos) y `nuevo-gasto`; tesoreria = `tesoreria` (cola,
  KPIs, totales) y `nuevo-gasto` (con «Para quién»); sin-gastos = `gastos` («aún no habilitado»). Sin fotos repetidas de la
  misma pantalla (`--plan`). `_mediciones.txt`: fixture, overflowX y fuera-de-ancho por foto. Graph falso: ningún dato real;
  fotos del estado DESPUÉS de la E2E (por eso «Casetas a planta», «Taxi a la notaría» y el gasto de «Colega Demo»).
