# MINSA ERP — app (v0.1.0, esqueleto)

PWA del ERP de MINSA ENERGY (`erp.minsaenergy.com`). Sustituirá a MINSA Proyectos: mismo login de Entra
(se **reusa su app registration**), mismas listas `PROY_*` del sitio Administración, cara nueva. El plan vive en
`../docs/plan.md`; esta versión es su **fase 3**: el motor traído y las pruebas en verde, sin pantallas reales.

## De dónde sale el motor

Copiado de `minsa-proyectos-app/app` **v0.160.0, commit `2489517`** (2026-10-01):

| Traído tal cual | Ajustado | Nuevo en el ERP |
|---|---|---|
| `graph.js` · `reglas.js` · `lote.js` · `esquema.json` · `servidor-local.js` · `minsa-ui.css` · `vendor/` · `iconos/` · `marca/` · `_config.yml` · `.gitignore` · `.gitattributes` · `test/reglas.test.js` · `test/lote.test.js` · `test/vendor-vigente.js` | `comun.js` (VERSION 0.1.0) · `config.js` (+`redirectProduccion`) · `sw.js` (caché `minsa-erp-v1`, sin las vistas) · `manifest.json` · `CNAME` · `package.json` · `test/sw.test.js` · `test/datos.test.js` · `test/e2e.ps1` | `index.html` · `app.js` · `estilo.css` · `test/pruebas.html` |

**No se trajeron** las vistas de Proyectos: `app.js` (el suyo), `vistas.js`, `tablero.js`, `capital.js`, `chat.js`,
`docs.js`, su `estilo.css` e `index.html`, ni `herramientas-dev/` (provisionar, sembrar, capturas). Ninguna prueba las exigió.

- `estilo.css` = fuentes + paleta + shim de tokens copiados **literal** de las líneas 9–130 del `estilo.css` de
  Proyectos (sin paleta, `minsa-ui.css` no pinta), más el acomodo mínimo del esqueleto.
- `lote.js` conserva `APP = 'minsa-proyectos'` **a propósito**: `recibo-lote.py` (skills de archivar) solo emite
  recibo para esa app. Cambiarlo es decisión de la fase 4, de la mano del script.
- `esquema.json` **no cambia** (decisión 6 del plan: mismas `PROY_*` mientras Proyectos viva).

## Qué hace hoy

Entra con Entra (MSAL por redirección; en producción la redirect URI es `https://erp.minsaenergy.com/`, en
localhost la página misma), abre `/sites/Administracion` y pinta cuántos renglones tiene cada lista `PROY_*`
y el rol de la persona según `PROY_Roles`. No escribe nada.

## Pruebas

```
npm test            # piel al día, selectores, comentarios, reglas (214), lote (27), sw, datos
npm run test:e2e    # PowerShell + Edge headless, 3 roles (gerencia · colaborador · lectura)
```

La E2E (`test/pruebas.html`) reusa **literal** el MSAL falso, el Graph falso y la bitácora del arnés de Proyectos;
sus escenarios son los del esqueleto (13 por rol: entrar, rol y nombre desde `PROY_Roles`, las 6 listas, `PROY_Capital`
ausente tolerada con rol lectura, cero escrituras). Los ~2,800 renglones de escenarios de Proyectos probaban sus
vistas y vuelven pantalla por pantalla en la fase 4.

La capa privada de `datos.test.js` lee `../herramientas-dev/datos-prohibidos.txt` (copia de la de Proyectos, fuera
de este repo).

## Qué falta

- Fase 4: las pantallas (rail Inicio · Proyectos · Archivos · Gastos · Equipo, maqueta aprobada) con su E2E.
- Remoto: repo público en la org MINSA-ENERGY + GitHub Pages (decidido; **sin crear**, este repo no tiene remoto).
- Medir el login real en `erp.minsaenergy.com` (la redirect URI la agregó Carlos en Entra, dicho por él, no medido).
- Fase 5: lista y biblioteca «Gastos».
