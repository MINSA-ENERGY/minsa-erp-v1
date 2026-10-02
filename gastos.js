// ERP v0.6.0 — GASTOS (fase 5 del plan, docs/plan.md decisiones 5, 7 y 10). Lo que pinta #gastos y lo que escribe:
//   - Empleado: registrar un gasto (fecha, concepto, monto, moneda, categoria, equipo, proyecto opcional, notas) con
//     comprobante opcional (foto o PDF; sin el, la nota es obligatoria) y ver «Mis gastos» con su estado.
//   - Tesoreria (ERP_Roles): la cola de lo «registrado» de todos, «Marcar reembolsado» (sella ReembolsadoPor/El, que nunca
//     se limpia) o «Rechazar» con motivo, y los totales por mes y moneda. Las funciones de guardar COMPRUEBAN el rol (no
//     solo esconden el boton). Puede capturar por el empleado (decision 5).
//   - Escribe SOLO en ERP_Gastos (sitio Administracion) y en la biblioteca «Gastos» del mismo sitio, en su carpeta AAAA-MM,
//     sin sobrescribir nunca (conflictBehavior fail -> sufijo _2). No escribe PROY_* ni PROY_Actividad (su Accion es un
//     choice cerrado y la decision 6 congela su esquema).
//   - Degrada: si ERP_Gastos no existe en el sitio (Carlos aun no corre herramientas-dev/provisionar-gastos.html), la
//     pantalla lo dice y el resto de la app sigue igual. Se lee al entrar a #gastos, no al abrir la app.
// Las reglas puras viven en gastos-reglas.js (test/gastos.test.js). Nada de innerHTML: el() / textContent.

import { CONFIG } from './config.js';
import { activosDe, ordenarProyectos, fechaMexico, nombreDe, diaDe, hrefSeguro, plural } from './reglas.js';
import { $, L, estado, el, boton, chip, avisar, abrirDialogo, cerrarDialogo, confirmar, opciones, porId, agregarSinDuplicar,
    aplicarVivo, campoFecha, aIsoDia, diaDeCampo, fechaInput, fechaCorta, equipoDe } from './comun.js';
import { esConflicto } from './graph.js';
import { rolesErpDe, PUEDE_GASTO, misGastos, porReembolsar, resueltos, yaReembolsadoAntes, totalesPorMes, sumaPorMoneda,
    formatoMonto, etiquetaEstado, etiquetaCfdi, tipoComprobante, extComprobante, comprobanteValido, nombreComprobante,
    rutaComprobante, faltanGasto, largoInvalido, camposGasto, camposReembolso, camposRechazo, CATEGORIAS_GASTO, MONEDAS } from './gastos-reglas.js';
import { cabecera, hojaDia } from './pantallas.js';

/** Estado del modulo. lista: null = no se sabe todavia · true = existe · false = FALTA en el sitio (se deja de preguntar hasta
 *  «Volver a revisar» o recargar). error: la ultima lectura fallo por otra cosa (403, red): se ofrece reintentar. */
const G = { lista: null, rolesLista: null, gastos: [], rolesErp: [], cargando: null, error: null, driveId: null };
export const estadoGastos = () => G;
let alCambiar = () => {};
/** app.js pasa aqui su repintado. */
export function alCambiarGastos(fn) { alCambiar = fn; }
const motivo = e => (e && e.message ? e.message : String(e));
const yo = () => (estado.cuenta && estado.cuenta.username) || '';
const bajo = s => String(s || '').trim().toLowerCase();
/** El nombre de una persona: el de PROY_Roles y, si ahi no esta (tesoreria puede no tener rol de proyectos), el de ERP_Roles. */
const nombre = correo => nombreDe(correo, [...estado.roles, ...G.rolesErp].filter(r => r.Nombre));
/** Mis roles de Gastos (ERP_Roles), como Set. */
export const misRolesErp = () => rolesErpDe(yo(), G.rolesErp);
const esTesoreria = () => PUEDE_GASTO.tesoreria(misRolesErp());
const puedeRegistrar = () => PUEDE_GASTO.registrar(estado.rol, misRolesErp());
/** Lista de frases: «a», «a y b», «a, b y c». */
const enLista = xs => xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1];

// ---------------------------------------------------------------- lectura

/** Lee ERP_Gastos y ERP_Roles. Si ERP_Gastos no existe, G.lista = false y no se lee nada mas. */
export async function cargarGastos() {
    const c = estado.cliente, s = estado.siteId;
    try {
        if (!await c.existeLista(s, L.gastos)) { G.lista = false; G.gastos = []; G.rolesErp = []; G.error = null; return; }
        const hayRoles = await c.existeLista(s, L.rolesErp);
        const [gastos, roles] = await Promise.all([c.renglones(s, L.gastos), hayRoles ? c.renglones(s, L.rolesErp) : Promise.resolve([])]);
        G.gastos = gastos; G.rolesErp = roles; G.rolesLista = hayRoles; G.lista = true; G.error = null;
    } catch (e) { G.error = motivo(e); }
}
/** La primera vez que se pinta #gastos (o tras «Volver a revisar»): lee y repinta. Con error NO reintenta solo (seria un bucle). */
function asegurarCarga() {
    if (G.lista !== null || G.cargando || G.error) return;
    G.cargando = cargarGastos().finally(() => { G.cargando = null; alCambiar(); });
}
function volverARevisar() { G.lista = null; G.error = null; G.driveId = null; asegurarCarga(); alCambiar(); }

// ---------------------------------------------------------------- pantalla

/** #gastos (sub = 'mios') y #gastos/tesoreria (sub = 'tesoreria', solo tesoreria; a los demas se les pinta «Mis gastos»). */
export function pintarGastos(v, nav, sub = 'mios') {
    if (G.lista === null && !G.error) {
        asegurarCarga();
        v.appendChild(cabecera('Gastos', '', 'Registro y reembolso'));
        const c = el('section', 'card'); c.id = 'gastosCargando'; c.appendChild(el('p', 'muted', 'Leyendo gastos…')); v.appendChild(c);
        return;
    }
    if (G.error) {
        v.appendChild(cabecera('Gastos', '', 'Registro y reembolso'));
        const c = el('section', 'card'); c.id = 'gastosError';
        c.appendChild(chip('no se pudo leer', 'danger'));
        c.appendChild(el('p', '', 'No se pudieron leer los gastos: ' + G.error));
        c.appendChild(boton('Volver a intentar', 'mn-btn', volverARevisar));
        v.appendChild(c);
        return;
    }
    if (G.lista === false) { pintarNoHabilitado(v); return; }

    const tes = esTesoreria();
    const cab = cabecera('Gastos', tes ? 'Tus gastos y la cola de tesorería' : '', 'Con o sin factura, con o sin ticket');
    if (puedeRegistrar()) {
        const b = boton('+ Registrar gasto', 'mn-btn is-primary', () => abrirNuevoGasto()); b.id = 'btnNuevoGasto'; cab.appendChild(b);
    } else {
        const b = el('button', 'btn incompleto', 'Registrar gasto: tu rol es de lectura'); b.type = 'button'; b.disabled = true; b.id = 'btnNuevoGasto'; cab.appendChild(b);
    }
    v.appendChild(cab);
    const info = el('p', 'nota-gastos', 'Tesorería solo reembolsa los gastos registrados en la app. Si el lugar no da factura ni ticket, se registra igual, con una nota que diga por qué.');
    v.appendChild(info);
    if (!G.rolesLista) v.appendChild(el('p', 'muted nota-gastos', `Falta la lista ${L.rolesErp} en el sitio: todavía nadie es tesorería, así que nadie puede marcar un gasto como reembolsado.`));

    const enTes = tes && sub === 'tesoreria';
    if (tes) {
        const tabs = el('div', 'tabs-proyecto'); tabs.setAttribute('role', 'tablist'); tabs.id = 'tabsGastos';
        const n = porReembolsar(G.gastos).length;
        for (const [k, texto] of [['mios', 'Mis gastos'], ['tesoreria', 'Tesorería']]) {
            const on = (k === 'tesoreria') === enTes;
            const b = el('button', 'tab' + (on ? ' is-on' : '')); b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.tab = k; b.setAttribute('aria-selected', String(on));
            b.appendChild(el('span', '', texto));
            if (k === 'tesoreria' && n) b.appendChild(chip(`por reembolsar ${n}`, 'warn'));
            b.addEventListener('click', () => nav.ir('gastos', null, k));
            tabs.appendChild(b);
        }
        v.appendChild(tabs);
    }
    if (enTes) pintarTesoreria(v); else pintarMios(v);
}

function pintarNoHabilitado(v) {
    v.appendChild(cabecera('Gastos', '', 'Registro y reembolso'));
    const c = el('section', 'card construccion'); c.id = 'gastosNoHabilitado';
    c.appendChild(chip('aún no habilitado', 'warn'));
    c.appendChild(el('h2', 'h2', 'Gastos aún no está habilitado — falta crear la lista'));
    c.appendChild(el('p', '', `La lista ${L.gastos} y la biblioteca «${CONFIG.bibliotecaGastos}» todavía no existen en el sitio Administración. Las crea Carlos una sola vez con su cuenta (docs/gastos-instrucciones-carlos.md); en cuanto existan, aquí se registra cada gasto con su ticket y tesorería lo reembolsa. Lo demás de la app funciona igual.`));
    const fila = el('div', 'altas');
    const b = el('button', 'btn incompleto', 'Registrar gasto: falta crear la lista'); b.type = 'button'; b.disabled = true; b.id = 'btnNuevoGasto'; fila.appendChild(b);
    const r = boton('Volver a revisar', 'mn-btn', volverARevisar); r.id = 'btnRevisarGastos'; fila.appendChild(r);
    c.appendChild(fila);
    v.appendChild(c);
}

/** «$850.00 MXN · $120.00 USD» de una suma por moneda; '—' si no hay nada. */
const textoSuma = s => MONEDAS.filter(m => s[m]).map(m => formatoMonto(s[m], m)).join(' · ') || '—';

function pintarMios(v) {
    const mios = misGastos(G.gastos, yo());
    const card = el('section', 'card'); card.id = 'misGastos';
    const cab = el('div', 'card-cab'); cab.appendChild(el('h2', 'h2', 'Mis gastos')); cab.appendChild(el('span', 'mn-chip', String(mios.length)));
    card.appendChild(cab);
    const pend = mios.filter(g => g.Estado === 'registrado');
    if (mios.length) { const r = el('p', 'muted resumen-gastos', `Por reembolsarte: ${textoSuma(sumaPorMoneda(pend))} (${pend.length} ${plural(pend.length, 'gasto')})`); r.id = 'misGastosResumen'; card.appendChild(r); }
    const lista = el('div', 'gastos-lista');
    for (const g of mios) lista.appendChild(filaGasto(g, { conQuien: g.CapturadoPor && bajo(g.CapturadoPor) !== bajo(g.Solicitante) }));
    if (!mios.length) card.appendChild(el('p', 'vacio', 'Todavía no registras gastos. Con «Registrar gasto» queda aquí y tesorería lo ve.'));
    card.appendChild(lista);
    v.appendChild(card);
}

function pintarTesoreria(v) {
    const cola = porReembolsar(G.gastos);
    const mesHoy = fechaMexico().slice(0, 7);
    const reembMes = G.gastos.filter(g => g.Estado === 'reembolsado' && (diaDe(g.ReembolsadoEl) || '').slice(0, 7) === mesHoy);
    const kpis = el('div', 'gastos-kpis'); kpis.id = 'gastosKpis';
    for (const [clave, lbl, valor, pie] of [
        ['por-reembolsar', 'Por reembolsar', textoSuma(sumaPorMoneda(cola)), `${cola.length} ${plural(cola.length, 'gasto')}`],
        ['reembolsado-mes', 'Reembolsado este mes', textoSuma(sumaPorMoneda(reembMes)), `${reembMes.length} ${plural(reembMes.length, 'gasto')} · por la fecha del reembolso`],
        ['sin-comprobante', 'Sin comprobante', String(cola.filter(g => !g.ComprobanteItemId).length), 'en la cola; se reembolsa igual, con su nota']
    ]) {
        const k = el('div', 'card gastos-kpi'); k.dataset.kpi = clave;
        k.appendChild(el('div', 'lbl', lbl)); k.appendChild(el('div', 'v', valor)); k.appendChild(el('div', 'f', pie));
        kpis.appendChild(k);
    }
    v.appendChild(kpis);

    const card = el('section', 'card'); card.id = 'colaTesoreria';
    const cab = el('div', 'card-cab'); cab.appendChild(el('h2', 'h2', 'Por reembolsar')); cab.appendChild(el('span', 'mn-chip', String(cola.length)));
    card.appendChild(cab);
    card.appendChild(el('p', 'muted', 'Todo lo registrado por el equipo, lo que lleva más esperando arriba. Revisa el comprobante (o la nota) antes de marcarlo.'));
    const lista = el('div', 'gastos-lista');
    for (const g of cola) lista.appendChild(filaGasto(g, { conQuien: true, tesoreria: true }));
    if (!cola.length) card.appendChild(el('p', 'vacio', 'No hay gastos por reembolsar.'));
    card.appendChild(lista);
    v.appendChild(card);

    const tot = el('section', 'card'); tot.id = 'totalesGastos';
    tot.appendChild(el('h2', 'h2', 'Totales por mes y moneda'));
    tot.appendChild(el('p', 'muted', 'Por el mes de la fecha del ticket. Pesos y dólares no se suman entre sí.'));
    const t = el('div', 'tabla-totales'); t.setAttribute('role', 'table'); t.setAttribute('aria-label', 'Totales por mes y moneda');
    const COLS = ['Mes', 'Moneda', 'Por reembolsar', 'Reembolsado', 'Rechazado', 'Gastos'];
    const h = el('div', 'fila-tot cab'); h.setAttribute('role', 'row');
    for (const x of COLS) { const c = el('span', 'lbl', x); c.setAttribute('role', 'columnheader'); h.appendChild(c); }
    t.appendChild(h);
    for (const r of totalesPorMes(G.gastos)) {
        const f = el('div', 'fila-tot'); f.setAttribute('role', 'row'); f.dataset.mes = r.mes; f.dataset.moneda = r.moneda;
        const celdas = [r.mes, r.moneda, formatoMonto(r.registrado, r.moneda), formatoMonto(r.reembolsado, r.moneda), formatoMonto(r.rechazado, r.moneda), String(r.n)];
        celdas.forEach((x, i) => {
            const c = el('span', i >= 2 && i <= 4 ? 'num' : ''); c.setAttribute('role', 'cell'); c.dataset.col = String(i);
            c.appendChild(el('span', 'lbl-movil', COLS[i] + ': ')); c.appendChild(document.createTextNode(x)); f.appendChild(c);
        });
        t.appendChild(f);
    }
    if (!G.gastos.length) tot.appendChild(el('p', 'vacio', 'Sin gastos todavía.'));
    tot.appendChild(t);
    v.appendChild(tot);

    const hechos = resueltos(G.gastos);
    if (hechos.length) {
        const d = el('details', 'card resueltos-gastos'); d.id = 'resueltosGastos';
        d.appendChild(el('summary', '', `Reembolsados y rechazados · ${hechos.length}`));
        const l2 = el('div', 'gastos-lista');
        for (const g of hechos) l2.appendChild(filaGasto(g, { conQuien: true }));
        d.appendChild(l2); v.appendChild(d);
    }
}

/** Un renglon de gasto. opts.conQuien: nombra al solicitante (y a quien lo capturo, si fue otra persona); opts.tesoreria: los botones. */
function filaGasto(g, { conQuien = false, tesoreria = false } = {}) {
    const f = el('div', 'gasto'); f.dataset.gasto = String(g.id); f.dataset.estado = g.Estado || '';
    f.appendChild(hojaDia(g.Fecha));
    const cuerpo = el('div', 'gasto-cuerpo');
    cuerpo.appendChild(el('div', 'titulo', g.Title || '(sin concepto)'));
    const meta = el('div', 'gasto-meta');
    if (conQuien) {
        const q = el('span', 'quien', nombre(g.Solicitante)); q.title = String(g.Solicitante || ''); meta.appendChild(q);
        if (g.CapturadoPor && bajo(g.CapturadoPor) !== bajo(g.Solicitante)) meta.appendChild(el('span', 'capturo', 'capturó ' + nombre(g.CapturadoPor)));
    }
    const p = Number(g.ProyectoId) > 0 ? porId(estado.proyectos, g.ProyectoId) : null;
    meta.appendChild(el('span', '', [p ? p.Title : null, equipoDe({ Equipo: g.Equipo }).nombre].filter(Boolean).join(' · ')));
    if (g.Categoria) meta.appendChild(el('span', '', g.Categoria));
    cuerpo.appendChild(meta);
    if (g.Notas) cuerpo.appendChild(el('div', 'gasto-nota', g.Notas));
    if (g.Estado === 'rechazado') cuerpo.appendChild(el('div', 'gasto-alerta', `Rechazado${g.RechazadoPor ? ' por ' + nombre(g.RechazadoPor) : ''}${g.RechazadoEl ? ' el ' + fechaCorta(g.RechazadoEl) : ''}: ${g.MotivoRechazo || 'sin motivo'}`));
    if (g.Estado === 'reembolsado' && g.ReembolsadoEl) cuerpo.appendChild(el('div', 'gasto-meta', `Reembolsado el ${fechaCorta(g.ReembolsadoEl)}${g.ReembolsadoPor ? ' por ' + nombre(g.ReembolsadoPor) : ''}`));
    if (yaReembolsadoAntes(g)) { const a = el('div', 'gasto-alerta ya-reembolsado', `Ojo: ya se había marcado reembolsado el ${fechaCorta(g.ReembolsadoEl)}${g.ReembolsadoPor ? ' por ' + nombre(g.ReembolsadoPor) : ''}. Revisa que no se pague dos veces.`); cuerpo.appendChild(a); }
    f.appendChild(cuerpo);
    f.appendChild(el('div', 'monto num', formatoMonto(g.Monto, g.Moneda)));
    const est = el('div', 'gasto-estado');
    const e = etiquetaEstado(g.Estado); est.appendChild(chip(e.texto, e.clase));
    const cf = etiquetaCfdi(g.CfdiEstado); if (cf) { const c = chip(cf.texto, cf.clase || undefined); c.classList.add('cfdi'); est.appendChild(c); }
    if (g.ComprobanteItemId) est.appendChild(boton('Ver comprobante', 'mn-btn is-sm', () => verComprobante(g.id), { verComprobante: g.id }));
    else {
        est.appendChild(chip('sin comprobante'));
        if (puedeAgregarComprobante(g)) est.appendChild(boton('Agregar comprobante', 'mn-btn is-sm', () => elegirYAgregar(g.id), { agregarComprobante: g.id }));
    }
    if (tesoreria && g.Estado === 'registrado') {
        est.appendChild(boton('Marcar reembolsado', 'mn-btn is-sm is-primary', () => marcarReembolsado(g.id), { reembolsar: g.id }));
        est.appendChild(boton('Rechazar', 'mn-btn is-sm', () => rechazarGasto(g.id), { rechazar: g.id }));
    }
    f.appendChild(est);
    return f;
}

// ---------------------------------------------------------------- comprobante (biblioteca «Gastos»)

/** El drive de la biblioteca «Gastos» (una vez por sesion). Si falta la biblioteca, lo dice con su nombre. */
async function driveGastos() {
    if (G.driveId) return G.driveId;
    if (!await estado.cliente.existeLista(estado.siteId, CONFIG.bibliotecaGastos)) throw new Error(`falta la biblioteca «${CONFIG.bibliotecaGastos}» en el sitio (docs/gastos-instrucciones-carlos.md)`);
    G.driveId = await estado.cliente.driveDeLista(estado.siteId, CONFIG.bibliotecaGastos);
    return G.driveId;
}
/**
 * Sube el comprobante de `g` (ya tiene ID: va en el nombre) a «Gastos/AAAA-MM/» y lo liga en el renglon. Nunca sobrescribe:
 * si el nombre existe, prueba _2, _3… El PATCH solo lleva ComprobanteItemId/ComprobanteRuta (con If-Match; ante un 412 se
 * repite sin el: esos dos campos solo los escribe este paso, no se pisa nada ajeno).
 */
async function subirComprobante(g, archivo, prog = () => {}) {
    const driveId = await driveGastos();
    const dia = diaDe(g.Fecha); if (!dia) throw new Error('el gasto no tiene fecha');
    const tipo = tipoComprobante(archivo.name, archivo.type), ext = extComprobante(archivo.name, archivo.type);
    prog(`Preparando la carpeta ${dia.slice(0, 7)}…`);
    await estado.cliente.asegurarCarpetaEnDrive(driveId, dia.slice(0, 7), prog);
    const bytes = await archivo.arrayBuffer();
    let subido = null, ruta = null;
    for (let n = 1; n <= 20 && !subido; n++) {
        ruta = rutaComprobante(dia, nombreComprobante({ dia, id: g.id, tipo, concepto: g.Title, ext, n }));
        prog(`Subiendo ${ruta}…`);
        try { subido = await estado.cliente.subirADrive(driveId, ruta, bytes, archivo.type || 'application/octet-stream', prog); }
        catch (e) { if (e.status !== 409) throw e; }
    }
    if (!subido) throw new Error('ya hay 20 archivos con ese nombre en la carpeta');
    const campos = { ComprobanteItemId: subido.id, ComprobanteRuta: ruta };
    let r;
    try { r = await estado.cliente.actualizarRenglon(estado.siteId, L.gastos, g.id, campos, prog, g._etag); }
    catch (e) { if (!esConflicto(e)) throw e; r = await estado.cliente.actualizarRenglon(estado.siteId, L.gastos, g.id, campos, prog); }
    aplicarVivo(G.gastos, g.id, campos, r && r._etag, g);
    return ruta;
}
/** Agregar el comprobante a un gasto propio que quedo sin el (o cuya subida fallo): registrado, sin comprobante, y mio,
 *  capturado por mi, o tesoreria. */
export function puedeAgregarComprobante(g) {
    if (!g || g.Estado !== 'registrado' || g.ComprobanteItemId || !puedeRegistrar()) return false;
    return bajo(g.Solicitante) === bajo(yo()) || bajo(g.CapturadoPor) === bajo(yo()) || esTesoreria();
}
function elegirYAgregar(id) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*,application/pdf';
    inp.addEventListener('change', () => { if (inp.files && inp.files[0]) agregarComprobante(id, inp.files[0]); });
    inp.click();
}
/** Sube y liga el comprobante de un gasto ya registrado. Devuelve true si quedo. */
export async function agregarComprobante(id, archivo) {
    const g = porId(G.gastos, id);
    if (!g) { avisar('Ese gasto ya no existe.', 'ojo'); return false; }
    if (!puedeAgregarComprobante(g)) { avisar(puedeRegistrar() ? 'A ese gasto no se le puede agregar comprobante.' : 'Tu rol es de lectura: no puedes subir comprobantes.', 'error'); return false; }
    const v = comprobanteValido(archivo); if (!v.ok) { avisar(v.motivo, 'error'); return false; }
    try {
        await subirComprobante(g, archivo, m => avisar(m, 'ojo'));
        avisar(`Comprobante de «${g.Title}» guardado en ${CONFIG.bibliotecaGastos}.`, 'ok'); alCambiar(); return true;
    } catch (e) { avisar('No se pudo subir el comprobante: ' + motivo(e), 'error'); return false; }
}
/** Abre el comprobante en SharePoint: la ventana se abre DENTRO del clic (si no, el bloqueador la tapa) y despues se le pone la liga. */
async function verComprobante(id) {
    const g = porId(G.gastos, id); if (!g || !g.ComprobanteItemId) return;
    const w = window.open('', '_blank');
    try {
        const it = await estado.cliente.itemDeDriveId(await driveGastos(), g.ComprobanteItemId);
        const url = hrefSeguro(it.url, { tipo: 'archivado', host: CONFIG.sharepointHost });
        if (!url) throw new Error('la liga no es de SharePoint');
        if (w) { w.opener = null; w.location.href = url; } else window.location.assign(url);
    } catch (e) { if (w) w.close(); avisar('No se pudo abrir el comprobante: ' + motivo(e), 'error'); }
}

// ---------------------------------------------------------------- tesoreria

/** PATCH con If-Match del renglon; ante un 412 relee (la verdad esta en SharePoint) y no pisa nada. */
async function escribirEstado(g, campos, ok) {
    try {
        const r = await estado.cliente.actualizarRenglon(estado.siteId, L.gastos, g.id, campos, m => avisar(m, 'ojo'), g._etag);
        aplicarVivo(G.gastos, g.id, campos, r && r._etag, g);
        avisar(ok, 'ok'); alCambiar(); return true;
    } catch (e) {
        if (esConflicto(e)) { await cargarGastos(); alCambiar(); avisar('Alguien cambió ese gasto hace un momento; ya se releyó. Revísalo y vuelve a intentarlo.', 'ojo'); return false; }
        avisar('No se pudo guardar: ' + motivo(e), 'error'); return false;
    }
}
/** Solo tesoreria (decision 7). Sella ReembolsadoPor/El. Si ya se habia sellado antes, pregunta (guarda contra el doble pago). */
export async function marcarReembolsado(id) {
    if (!esTesoreria()) { avisar('Solo tesorería marca un gasto como reembolsado.', 'error'); return false; }
    const g = porId(G.gastos, id); if (!g) { avisar('Ese gasto ya no existe.', 'ojo'); return false; }
    if (g.Estado !== 'registrado') { avisar(`Ese gasto ya está ${g.Estado}.`, 'ojo'); return false; }
    if (yaReembolsadoAntes(g)) {
        const r = await confirmar({ titulo: 'Este gasto ya se reembolsó una vez', texto: `«${g.Title}» se marcó reembolsado el ${fechaCorta(g.ReembolsadoEl)}${g.ReembolsadoPor ? ' por ' + nombre(g.ReembolsadoPor) : ''} y después volvió a «registrado». Revisa que no se pague dos veces. ¿Marcarlo reembolsado otra vez?`, ok: 'Sí, marcar reembolsado' });
        if (!r.ok) return false;
    }
    return escribirEstado(g, camposReembolso(yo()), `Reembolsado: «${g.Title}» (${formatoMonto(g.Monto, g.Moneda)}).`);
}
/** Solo tesoreria. Pide el motivo (obligatorio); conserva el renglon y el comprobante; no toca el sello del reembolso. */
export async function rechazarGasto(id) {
    if (!esTesoreria()) { avisar('Solo tesorería rechaza un gasto.', 'error'); return false; }
    const g = porId(G.gastos, id); if (!g) { avisar('Ese gasto ya no existe.', 'ojo'); return false; }
    if (g.Estado !== 'registrado') { avisar(`Ese gasto ya está ${g.Estado}.`, 'ojo'); return false; }
    const r = await confirmar({ titulo: 'Rechazar gasto', texto: `«${g.Title}» de ${nombre(g.Solicitante)} (${formatoMonto(g.Monto, g.Moneda)}) no se reembolsará. El renglón y su comprobante se quedan; la persona ve el motivo.`, ok: 'Rechazar', motivo: true, etiquetaMotivo: 'Motivo del rechazo' });
    if (!r.ok) return false;
    return escribirEstado(g, camposRechazo(yo(), r.motivo), `Rechazado: «${g.Title}».`);
}

// ---------------------------------------------------------------- alta (dialogo)

let archivoElegido = null;
/** Abre «Registrar gasto». Tesoreria elige ademas para quien es (captura por el empleado). */
export function abrirNuevoGasto() {
    if (G.lista !== true) { avisar('Gastos aún no está habilitado: falta crear la lista.', 'error'); return; }
    if (!puedeRegistrar()) { avisar('Tu rol es de lectura: no puedes registrar gastos.', 'error'); return; }
    const porOtro = PUEDE_GASTO.porOtro(misRolesErp());
    $('gaParaCampo').classList.toggle('oculto', !porOtro);
    if (porOtro) {
        const personas = estado.roles.filter(r => r.Activo !== false && r.Title).sort((a, b) => String(a.Nombre || a.Title).localeCompare(String(b.Nombre || b.Title), 'es'));
        if (!personas.some(r => bajo(r.Title) === bajo(yo()))) personas.unshift({ Title: yo(), Nombre: nombre(yo()) });
        opciones($('gaPara'), personas, r => r.Title, r => r.Nombre || r.Title, null);
        $('gaPara').value = [...$('gaPara').options].find(o => bajo(o.value) === bajo(yo()))?.value || '';
    }
    $('gaFecha').value = fechaInput(fechaMexico());
    $('gaMonto').value = ''; $('gaMoneda').value = 'MXN'; $('gaConcepto').value = ''; $('gaNotas').value = ''; $('gaProgreso').textContent = '';
    opciones($('gaProyecto'), ordenarProyectos(activosDe(estado.proyectos)), p => p.id, p => p.Title, 'Sin proyecto (gasto del equipo)');
    opciones($('gaEquipo'), CONFIG.equipos, e => e.clave, e => e.nombre, '— elige —');
    opciones($('gaCategoria'), CATEGORIAS_GASTO, c => c, c => c[0].toUpperCase() + c.slice(1), 'Sin categoría');
    ponerArchivo(null);
    abrirDialogo('dlgGasto');
    $('gaMonto').focus();
}
function leerFormulario() {
    const txt = $('gaFecha').value.trim(); const dia = diaDeCampo(txt);
    return { dia, fechaError: !!txt && !dia, monto: $('gaMonto').value, concepto: $('gaConcepto').value, equipo: $('gaEquipo').value, notas: $('gaNotas').value, conComprobante: !!archivoElegido, hoy: fechaMexico() };
}
/** El boton dice QUE FALTA (patron de la maqueta); la etiqueta de Notas dice si es obligatoria. */
function revisarGasto() {
    const f = faltanGasto(leerFormulario());
    const b = $('gaGuardar');
    b.textContent = f.length ? 'Falta ' + enLista(f) : 'Registrar gasto';
    b.disabled = !!f.length; b.classList.toggle('is-primary', !f.length);
    $('gaNotasEtq').textContent = archivoElegido ? 'Notas (opcional)' : 'Sin comprobante: ¿por qué? · obligatoria';
}
function ponerArchivo(f) {
    if (f) { const v = comprobanteValido(f); if (!v.ok) { avisar(v.motivo, 'error'); f = null; } }
    archivoElegido = f || null;
    $('gaFoto').value = ''; $('gaArchivo').value = '';
    $('gaSinArchivo').classList.toggle('oculto', !!archivoElegido); $('gaConArchivo').classList.toggle('oculto', !archivoElegido);
    $('gaArchivoNombre').textContent = archivoElegido ? `${archivoElegido.name} · ${(archivoElegido.size / 1048576).toFixed(1)} MB` : '';
    revisarGasto();
}
async function guardarGasto(ev) {
    ev.preventDefault();
    if (G.lista !== true) { avisar('Gastos aún no está habilitado: falta crear la lista.', 'error'); return; }
    if (!puedeRegistrar()) { avisar('Tu rol es de lectura: no puedes registrar gastos.', 'error'); return; }
    const f = leerFormulario();
    const faltan = faltanGasto(f);
    if (faltan.length) { avisar('Falta ' + enLista(faltan) + '.', 'error'); return; }
    const largo = largoInvalido(f); if (largo) { avisar(largo, 'error'); return; }
    const archivo = archivoElegido;
    if (archivo) { const v = comprobanteValido(archivo); if (!v.ok) { avisar(v.motivo, 'error'); return; } }
    const para = PUEDE_GASTO.porOtro(misRolesErp()) && $('gaPara').value ? $('gaPara').value : yo();
    const campos = camposGasto({ fechaIso: aIsoDia(f.dia), monto: f.monto, moneda: $('gaMoneda').value, concepto: f.concepto, categoria: $('gaCategoria').value,
        equipo: f.equipo, proyectoId: $('gaProyecto').value, solicitante: para, capturadoPor: yo(), notas: f.notas });
    const prog = t => { $('gaProgreso').textContent = t; };
    $('gaGuardar').disabled = true;
    let n;
    try {
        if (archivo) { prog(`Abriendo la biblioteca ${CONFIG.bibliotecaGastos}…`); await driveGastos(); }   // si falla aqui no se escribio nada
        prog('Registrando el gasto…');
        n = agregarSinDuplicar(G.gastos, await estado.cliente.crearRenglon(estado.siteId, L.gastos, campos, prog));
    } catch (e) { prog(''); avisar('No se pudo registrar el gasto: ' + motivo(e), 'error'); revisarGasto(); return; }
    let aviso = para === yo() ? 'Gasto registrado. Tesorería ya lo ve.' : `Gasto registrado para ${nombre(para)}.`, clase = 'ok';
    if (archivo) {
        try { await subirComprobante(n, archivo, prog); }
        catch (e) { aviso = `El gasto quedó registrado, pero el comprobante no se subió (${motivo(e)}). Súbelo con «Agregar comprobante» en el gasto.`; clase = 'error'; }
    }
    archivoElegido = null;
    cerrarDialogo('dlgGasto');
    avisar(aviso, clase);
    alCambiar();
}

// ---------------------------------------------------------------- enganche (una vez)

export function engancharGastos() {
    campoFecha('gaFecha');
    $('formGasto').addEventListener('submit', guardarGasto);
    for (const id of ['gaFecha', 'gaMonto', 'gaConcepto', 'gaNotas']) $(id).addEventListener('input', revisarGasto);
    $('gaEquipo').addEventListener('change', revisarGasto);
    $('gaProyecto').addEventListener('change', () => {
        const p = porId(estado.proyectos, $('gaProyecto').value);
        if (p && CONFIG.equipos.some(e => e.clave === p.Equipo)) $('gaEquipo').value = p.Equipo;
        revisarGasto();
    });
    $('gaTomar').addEventListener('click', () => $('gaFoto').click());
    $('gaElegir').addEventListener('click', () => $('gaArchivo').click());
    for (const id of ['gaFoto', 'gaArchivo']) $(id).addEventListener('change', () => { const f = $(id).files && $(id).files[0]; if (f) ponerArchivo(f); });
    $('gaQuitar').addEventListener('click', () => ponerArchivo(null));
    $('gaCancelar').addEventListener('click', () => cerrarDialogo('dlgGasto'));
    $('gaCerrar').addEventListener('click', () => cerrarDialogo('dlgGasto'));
}
