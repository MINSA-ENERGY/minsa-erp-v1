// ERP v0.5.0 — ARCHIVOS (fase 4 del plan, paridad con MINSA Proyectos v0.160.0, docs.js): los documentos de un proyecto y
// de todos, «qué documentos faltan» (tarjetas abiertas sin ningun documento), subir directo al buzon de la biblioteca de la
// unidad (queda en SharePoint), ligar un archivo ya archivado, pegar un enlace y quitar una liga.
// Mismas reglas que Proyectos, porque las dos apps escriben sobre las MISMAS listas y bibliotecas:
//   - PROY_Ligas: un renglon por liga (archivado · buzon · enlace), con los mismos campos y la misma bitacora en
//     PROY_Actividad (ligar · subir · desligar) y la misma frase.
//   - Subir = carpeta del lote en 99_Pendiente-Archivar -> piezas -> `_lote.json` AL FINAL (lote.js, intacto: APP sigue
//     siendo 'minsa-proyectos' para que recibo-lote.py de las skills de archivar lo reconozca). Si falla a medias se borra.
//   - «En el buzon» se DERIVA en vivo (404 = ya lo acomodo la skill) y, si la skill dejo su recibo, la liga se reemplaza
//     sola por las rutas finales (aplicarRecibo, como Proyectos v0.108.0).
//   - PUEDE.ligar: lectura no liga, no sube, no quita (cada funcion de guardar lo COMPRUEBA, no solo esconde el boton).
//     La biblioteca tiene que estar autorizada (`piloto` de config.js); sin ella, solo enlaces.
// Lo que NO se porto todavia: mover una liga a otra tarjeta (F1) y el arbol plegable de expediente (v0.33.0). README.
// Nada de innerHTML: el() / textContent.

import { CONFIG } from './config.js';
import { PUEDE, tareasDe, slug, fechaMexico, nombreCorto, validarUrl, urlParaLiga, urlCortaDeGuid, resumenLargos, textosLargos,
    TEXTO_MAX, hrefSeguro, filtrarLigas, nombreDeLiga, ordenarProyectos, columnasDe, nombreColumnaEn, porVence, HECHO, TIPOS_LIGA, plural } from './reglas.js';
import { construirManifiesto, validarManifiesto, bytesDelManifiesto, nombreCarpetaLote, NOMBRE_MANIFIESTO, rutaRecibo, validarRecibo } from './lote.js';
import { $, L, VERSION, estado, el, boton, chip, chipVence, iconoArchivo, avisar, abrirDialogo, cerrarDialogo, confirmar, opciones, limpiar,
    porId, registrarActividad, fechaCorta, agregarSinDuplicar } from './comun.js';

let alCambiar = () => {};
/** app.js pasa aqui su repintado (contador del rail + pantalla). */
export function alCambiarArchivos(fn) { alCambiar = fn; }
const motivo = e => (e && e.message ? e.message : String(e));

// ---------------------------------------------------------------- reglas de la pantalla

/** Biblioteca de la unidad de un proyecto (config.js), o null si su equipo no tiene una. */
export function bibliotecaDe(p) {
    const eq = CONFIG.equipos.find(e => e.clave === (p && p.Equipo));
    const b = eq && eq.unidad ? CONFIG.bibliotecas[eq.unidad] : null;
    return b ? { clave: eq.unidad, ...b } : null;
}
/** Resuelve (y cachea la PROMESA) el siteId de una biblioteca: `{ id, motivo }`, id null si 403/404 (C-08 de Proyectos). */
function sitioDe(bib) {
    if (!estado.sitiosUnidad[bib.clave]) estado.sitiosUnidad[bib.clave] = estado.cliente.sitioOpcional(CONFIG.sharepointHost, bib.sitio).catch(e => { delete estado.sitiosUnidad[bib.clave]; throw e; });
    return estado.sitiosUnidad[bib.clave];
}
/** Puede ligar/subir: rol, proyecto activo y biblioteca AUTORIZADA (A1 de Proyectos: el dato se sabe antes de abrir el dialogo). */
export function puedeLigarEn(p) { const b = bibliotecaDe(p); return PUEDE.ligar(estado.rol) && !!p && p.Estado === 'activo' && !!b && b.piloto !== false; }
/** Puede pegar un enlace: rol y proyecto activo; la biblioteca no hace falta. */
export function puedeEnlazarEn(p) { return PUEDE.ligar(estado.rol) && !!p && p.Estado === 'activo'; }
/** POR QUE no se puede subir/ligar en `p` (el boton lo dice, patron de la maqueta), o '' si se puede. */
export function porQueNoSube(p) {
    if (!PUEDE.ligar(estado.rol)) return 'tu rol es de lectura';
    if (!p || p.Estado !== 'activo') return 'el proyecto está cerrado';
    const b = bibliotecaDe(p);
    if (!b) return `${p.Equipo || 'su equipo'} no tiene biblioteca`;
    if (b.piloto === false) return `sin permiso sobre ${b.nombre}`;
    return '';
}
/** Las ligas de un proyecto (las de PROY_Ligas con su ProyectoId). */
export const ligasDe = p => estado.ligas.filter(l => Number(l.ProyectoId) === Number(p && p.id));
/** «Qué documentos faltan»: las tarjetas ABIERTAS (no hechas) del proyecto sin ninguna liga, de la que vence antes a la que no
 *  tiene fecha. Es el nodo «N tarjetas abiertas sin documentos» del expediente de Proyectos (docs.js, v0.33.0). */
export function faltantesDe(p, tareas = estado.tareas, ligas = estado.ligas) {
    const conDocs = new Set(ligas.filter(l => Number(l.ProyectoId) === Number(p.id)).map(l => Number(l.TareaId)).filter(Boolean));
    return tareasDe(p, tareas).filter(t => t.Columna !== HECHO && !conDocs.has(t.id)).sort(porVence);
}

// ---------------------------------------------------------------- el renglon de un documento

/** «Dónde quedó»: la biblioteca y la carpeta (archivado / buzon) o el sitio (enlace). */
function dondeQuedo(l) {
    if (l.Tipo === 'enlace') { try { return new URL(l.Url).hostname; } catch (_) { return 'enlace'; } }
    const ruta = String(l.Ruta || ''); const carpeta = ruta.includes('/') ? ruta.slice(0, ruta.lastIndexOf('/')) : ruta;
    const bib = CONFIG.bibliotecas[l.Unidad];
    return [bib ? bib.nombre : l.Unidad, ...(l.Tipo === 'buzon' ? [ruta] : carpeta ? [carpeta] : [])].filter(Boolean).join(' › ');
}
/** Chip de estado de la liga; el 404 del buzon lo cambia marcarBuzonEnVivo. */
function chipEstado(l, fuera) { return fuera ? chip('dirección externa', 'danger') : l.Tipo === 'buzon' ? chip('en el buzón', 'info') : l.Tipo === 'enlace' ? chip('enlace') : chip('archivado', 'ok'); }

/**
 * Un documento: icono + nombre (liga solo a SharePoint de la casa, o http(s) si es enlace — hrefSeguro, S-15) + quien lo ligo
 * y donde quedo + chip de estado + «Quitar» si `puede`. Con `conProyecto` nombra el proyecto; con `conTarjeta`, la tarjeta.
 */
export function filaLiga(l, { puede = false, conProyecto = false, conTarjeta = true } = {}) {
    const f = el('div', 'doc'); f.dataset.liga = String(l.id);
    f.appendChild(iconoArchivo(l.Ruta || l.Title, l.Tipo));
    const cuerpo = el('div', 'doc-cuerpo');
    const nh = nombreDeLiga(l);
    const href = hrefSeguro(l.Url, { tipo: l.Tipo, host: CONFIG.sharepointHost });
    const fuera = l.Tipo !== 'enlace' && l.Url && !href;   // alguien edito la Url desde SharePoint hacia otro sitio
    const nombre = el('div', 'doc-nombre');
    if (href) { const a = el('a', '', nh.titulo); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.title = l.Title; nombre.appendChild(a); }
    else { const s = el('span', '', nh.titulo); s.title = fuera ? 'La dirección no es de SharePoint de MINSA: no se abre.' : l.Title; nombre.appendChild(s); }
    cuerpo.appendChild(nombre);
    const meta = el('div', 'doc-meta');
    if (conProyecto) { const p = porId(estado.proyectos, l.ProyectoId); meta.appendChild(el('span', 'mn-chip', p ? p.Title : `proyecto #${l.ProyectoId}`)); }
    if (conTarjeta) { const t = l.TareaId ? porId(estado.tareas, l.TareaId) : null; meta.appendChild(el('span', 'tarjeta-de', t ? t.Title : l.TareaId ? `tarjeta #${l.TareaId}` : 'del proyecto entero')); }
    const quien = l.LigadoPor ? nombreCorto(l.LigadoPor, estado.roles) : '';
    if (quien || l._creado) meta.appendChild(el('span', 'muted', `${l.Tipo === 'buzon' ? 'subió' : 'ligó'} ${quien || '—'}${l._creado ? ' · ' + fechaCorta(l._creado) : ''}`));
    meta.appendChild(el('span', 'muted donde', dondeQuedo(l)));
    cuerpo.appendChild(meta);
    f.appendChild(cuerpo);
    const est = el('span', 'estado'); est.appendChild(chipEstado(l, fuera)); f.appendChild(est);
    if (puede) f.appendChild(boton('Quitar', 'mn-btn is-ghost is-sm quitar', () => { const lv = porId(estado.ligas, l.id); if (!lv) { avisar('Esa liga ya no está.', 'ojo'); alCambiar(); return; } quitarLiga(lv); }, { quitar: String(l.id) }));
    return f;
}

/** Los tres botones de alta (Subir · Ligar · Enlace) para un proyecto y, opcional, una tarjeta. Si no se puede, UN boton que
 *  dice por que (patron de la maqueta: .btn.incompleto) y no hace nada. `alTerminar` vuelve a la ficha si se abrio desde ahi. */
export function botonesAlta(p, { tareaId = null, alTerminar = null, compacto = false } = {}) {
    const c = el('div', 'altas');
    const no = porQueNoSube(p);
    const cls = compacto ? 'mn-btn is-sm' : 'mn-btn';
    if (!no) {
        c.appendChild(boton('Subir', cls + (compacto ? '' : ' is-primary'), () => abrirSubir({ proyectoId: p.id, tareaId, alTerminar }), { subirA: String(tareaId || 0) }));
        c.appendChild(boton('Ligar archivado', cls, () => abrirLigar({ proyectoId: p.id, tareaId, alTerminar }), { ligarA: String(tareaId || 0) }));
    }
    if (puedeEnlazarEn(p)) c.appendChild(boton('Pegar enlace', cls, () => abrirEnlace({ proyectoId: p.id, tareaId, alTerminar }), { enlaceA: String(tareaId || 0) }));
    if (no) { const b = el('button', 'btn incompleto' + (compacto ? ' is-sm' : ''), `Subir: ${no}`); b.type = 'button'; b.disabled = true; b.dataset.noSube = '1'; c.appendChild(b); }
    return c;
}

// ---------------------------------------------------------------- Proyecto · pestaña Documentos

// Generacion de la pintada (C-03 de Proyectos): la consulta del buzon es async; si en medio se repinta, la vieja se retira.
let pintadaDocs = 0;
/**
 * La pestaña Documentos de un proyecto: los botones de alta, «Qué documentos faltan» (cada tarjeta abierta sin documentos, con
 * sus botones) y los documentos ligados agrupados por tarjeta. `abrirTarjeta(id)` abre la ficha (lo pasa pantallas.js).
 */
export function pintarDocsProyecto(v, p, { abrirTarjeta = null } = {}) {
    const gen = ++pintadaDocs;
    const bib = bibliotecaDe(p);
    const barra = el('div', 'docs-barra');
    barra.appendChild(el('p', 'muted', bib ? `Lo que se sube va a ${bib.nombre}/${CONFIG.buzon}/ en SharePoint; la skill de archivar lo acomoda después.` : 'Este equipo no tiene biblioteca en SharePoint: aquí solo se pegan enlaces.'));
    barra.appendChild(botonesAlta(p));
    v.appendChild(barra);

    const faltan = faltantesDe(p);
    const cf = el('section', 'card faltan'); cf.id = 'docsFaltan';
    const cab = el('div', 'card-cab'); cab.appendChild(el('h2', 'h2', 'Qué documentos faltan')); cab.appendChild(chip(String(faltan.length), faltan.length ? 'warn' : 'ok'));
    cf.appendChild(cab);
    cf.appendChild(el('p', 'muted', 'Tarjetas abiertas que todavía no tienen ningún documento ligado.'));
    if (!faltan.length) cf.appendChild(el('p', 'vacio', 'Todas las tarjetas abiertas tienen al menos un documento.'));
    const cols = columnasDe(p);
    for (const t of faltan) {
        const r = el('div', 'falta'); r.dataset.falta = String(t.id);
        const izq = el('div', 'falta-cuerpo');
        const tit = abrirTarjeta ? boton(t.Title || '(sin título)', 'titulo enlace-tarjeta', () => abrirTarjeta(t.id)) : el('span', 'titulo', t.Title || '(sin título)');
        izq.appendChild(tit);
        const meta = el('div', 'doc-meta');
        meta.appendChild(el('span', 'tarjeta-de', nombreColumnaEn(t.Columna, cols)));
        meta.appendChild(el('span', 'muted', t.Asignado ? nombreCorto(t.Asignado, estado.roles) : 'sin dueño'));
        const cv = chipVence(t); if (cv) meta.appendChild(cv);
        izq.appendChild(meta);
        r.appendChild(izq);
        r.appendChild(botonesAlta(p, { tareaId: t.id, compacto: true }));
        cf.appendChild(r);
    }
    v.appendChild(cf);

    const todas = ligasDe(p);
    const cl = el('section', 'card docs'); cl.id = 'docsLista';
    const cab2 = el('div', 'card-cab'); cab2.appendChild(el('h2', 'h2', 'Documentos del proyecto')); cab2.appendChild(el('span', 'mn-chip', String(todas.length)));
    cl.appendChild(cab2);
    if (!todas.length) cl.appendChild(el('p', 'vacio', 'Sin documentos ligados todavía.'));
    const puedeDe = l => l.Tipo === 'enlace' ? puedeEnlazarEn(p) : puedeLigarEn(p);
    // «Del proyecto» primero y luego una cabecera por tarjeta (por titulo), los documentos de la mas nueva a la mas vieja.
    const grupos = new Map();
    for (const l of [...todas].sort((a, b) => String(b._creado || '').localeCompare(String(a._creado || '')) || b.id - a.id)) { const k = l.TareaId ? Number(l.TareaId) : 0; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(l); }
    const titulo = k => { if (!k) return 'Del proyecto'; const t = porId(estado.tareas, k); return t ? t.Title : `Tarjeta #${k}`; };
    for (const k of [...grupos.keys()].sort((a, b) => (a === 0 ? -1 : b === 0 ? 1 : String(titulo(a)).localeCompare(String(titulo(b)))))) {
        const g = el('div', 'grupo-docs'); g.dataset.grupo = String(k);
        const h = el('div', 'sec'); h.appendChild(el('span', '', titulo(k))); h.appendChild(el('span', 'n', `${grupos.get(k).length} ${plural(grupos.get(k).length, 'doc')}`));
        g.appendChild(h);
        for (const l of grupos.get(k)) g.appendChild(filaLiga(l, { puede: puedeDe(l), conTarjeta: false }));
        cl.appendChild(g);
    }
    v.appendChild(cl);
    if (bib && todas.some(l => l.Tipo === 'buzon' && l.Ruta)) marcarBuzonEnVivo(p, todas, cl, gen, bib, puedeLigarEn(p));
}

/** La cola async del buzon (C-03 de Proyectos): sale en cuanto su pintada ya no es la vigente. Una consulta por liga de tipo
 *  buzon, cacheada por carga en estado.buzonExiste. 404 = la skill ya lo acomodo: con recibo se reemplaza sola; sin el, el chip
 *  lo dice y (si puede) «Buscar el archivado» abre Ligar para reemplazarla. */
async function marcarBuzonEnVivo(p, ligas, cont, gen, bib, puede) {
    const vigente = () => gen === pintadaDocs && cont.isConnected;
    try {
        const s = await sitioDe(bib);
        if (!vigente() || !s.id) return;
        for (const l of ligas.filter(x => x.Tipo === 'buzon' && x.Ruta)) {
            if (estado.buzonExiste[l.Ruta] === undefined) estado.buzonExiste[l.Ruta] = estado.cliente.existeRuta(s.id, l.Ruta).catch(() => { delete estado.buzonExiste[l.Ruta]; return undefined; });
            const existe = await estado.buzonExiste[l.Ruta];
            if (!vigente()) return;
            if (existe === undefined) continue;
            estado.buzonExiste[l.Ruta] = existe;
            if (existe === false && puede && await aplicarRecibo(p, bib, s, l)) return;
            if (!vigente()) return;
            const n = cont.querySelector(`[data-liga="${l.id}"] .estado`);
            if (n && existe === false) {
                n.textContent = ''; n.appendChild(chip('ya lo acomodó la skill', 'ok'));
                if (puede) n.appendChild(boton('Buscar el archivado', 'mn-btn is-sm', () => abrirLigar({ proyectoId: p.id, tareaId: l.TareaId, texto: l.Title, reemplazaId: l.id }), { buscar: String(l.id) }));
            }
        }
    } catch (e) {
        if (!vigente()) return;
        if (!estado.buzonAvisado) { estado.buzonAvisado = true; avisar('No se pudo consultar el buzón: el estado «en el buzón» puede estar atrasado hasta la próxima relectura.', 'ojo'); }
        console.warn('Archivos: no se pudo consultar el buzón.', motivo(e));
    }
}

// ---------------------------------------------------------------- #archivos: todo lo que sube el equipo

/** La pantalla #archivos: Subir (eligiendo proyecto), «qué documentos faltan» por proyecto, y TODAS las ligas por proyecto con
 *  filtro de proyecto, tipo y texto. Aqui no se quita ni se reasigna (como #archivos de Proyectos): eso es del proyecto. */
export function pintarArchivos(v, nav) {
    const cab = el('div', 'cabecera');
    const t = el('div'); t.appendChild(el('div', 'lbl', 'Todo lo que sube el equipo')); t.appendChild(el('h1', 'ttl', 'Archivos'));
    const sub = el('div', 'sub'); sub.id = 'archivosSub'; t.appendChild(sub);
    cab.appendChild(t);
    const subibles = subiblesActivos();
    if (subibles.length) { const b = boton('Subir', 'mn-btn is-primary', () => abrirSubir({}), { subirGeneral: '1' }); b.id = 'btnSubirArchivos'; cab.appendChild(b); }
    else { const b = el('button', 'btn incompleto', PUEDE.ligar(estado.rol) ? 'Subir: ningún proyecto activo tiene biblioteca con permiso' : 'Subir: tu rol es de lectura'); b.type = 'button'; b.disabled = true; b.id = 'btnSubirArchivos'; cab.appendChild(b); }
    v.appendChild(cab);
    v.appendChild(el('p', 'muted nota-archivos', 'Lo que subes queda en la biblioteca de SharePoint de la unidad del proyecto (su buzón 99_Pendiente-Archivar) y la skill de archivar lo acomoda. Para quitar una liga, entra a Documentos del proyecto.'));

    // Que falta, por proyecto activo: un renglon con la cuenta y el boton a su pestaña Documentos.
    const activos = ordenarProyectos(estado.proyectos.filter(p => p.Estado === 'activo'));
    const cf = el('section', 'card'); cf.id = 'archivosFaltan';
    const cabF = el('div', 'card-cab'); cabF.appendChild(el('h2', 'h2', 'Qué documentos faltan'));
    const nTot = activos.reduce((s, p) => s + faltantesDe(p).length, 0);
    cabF.appendChild(chip(String(nTot), nTot ? 'warn' : 'ok')); cf.appendChild(cabF);
    for (const p of activos) {
        const n = faltantesDe(p).length;
        const r = el('div', 'falta-proy'); r.dataset.proyecto = String(p.id);
        r.appendChild(el('span', 'nombre', p.Title || '(sin nombre)'));
        r.appendChild(el('span', 'muted', n ? `${n} ${plural(n, 'tarjeta abierta', 'tarjetas abiertas')} sin documentos` : 'todas con documentos'));
        if (p.Clave) r.appendChild(boton('Documentos', 'mn-btn is-sm', () => nav.ir('proyecto', p.Clave, 'docs'), { irDocs: p.Clave }));
        cf.appendChild(r);
    }
    if (!activos.length) cf.appendChild(el('p', 'vacio', 'No hay proyectos activos.'));
    v.appendChild(cf);

    // Filtros: proyecto (solo los que tienen ligas), tipo y texto. El texto repinta SOLO la lista (el campo conserva el foco).
    const f = estado.filtroArchivos;
    const fil = el('div', 'filtros-archivos');
    const sel = el('select'); sel.id = 'archivosProyecto'; sel.setAttribute('aria-label', 'Proyecto');
    const conLigas = new Set(estado.ligas.map(l => Number(l.ProyectoId)));
    opciones(sel, ordenarProyectos(estado.proyectos.filter(p => conLigas.has(p.id))), p => p.id, p => p.Title, 'Todos los proyectos');
    if (f.proyectoId && !conLigas.has(Number(f.proyectoId))) f.proyectoId = null;
    sel.value = f.proyectoId ? String(f.proyectoId) : '';
    sel.addEventListener('change', () => { f.proyectoId = sel.value ? Number(sel.value) : null; pintarListaArchivos(nav); });
    fil.appendChild(sel);
    const chips = el('div', 'tipos'); chips.id = 'archivosTipo';
    for (const [k, texto] of TIPOS_LIGA) {
        const b = boton(texto, f.tipo === k ? 'is-on' : '', () => { f.tipo = k; for (const x of chips.children) { const on = x.dataset.tipo === (k || 'todos'); x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', String(on)); } pintarListaArchivos(nav); }, { tipo: k || 'todos' });
        b.setAttribute('aria-pressed', String(f.tipo === k)); chips.appendChild(b);
    }
    fil.appendChild(chips);
    const q = el('input'); q.id = 'archivosTexto'; q.type = 'search'; q.placeholder = 'Buscar por nombre o ruta'; q.setAttribute('aria-label', 'Buscar documentos'); q.value = f.texto || '';
    q.addEventListener('input', () => { f.texto = q.value; pintarListaArchivos(nav); });
    fil.appendChild(q);
    v.appendChild(fil);
    const lista = el('section', 'card docs'); lista.id = 'archivosLista';
    v.appendChild(lista);
    pintarListaArchivos(nav);
}
function pintarListaArchivos(nav) {
    const cont = $('archivosLista'); if (!cont) return;
    cont.textContent = '';
    const f = estado.filtroArchivos;
    const vivos = new Set(estado.proyectos.map(p => p.id));
    const todas = estado.ligas.filter(l => vivos.has(Number(l.ProyectoId)));   // C-10 de Proyectos: sin proyecto no cuenta
    const ligas = filtrarLigas(todas, f).sort((a, b) => String(b._creado || '').localeCompare(String(a._creado || '')) || b.id - a.id);
    const filtrando = !!(f.texto || '').trim() || !!f.tipo || !!f.proyectoId;
    $('archivosSub').textContent = filtrando ? `${ligas.length} de ${todas.length} ${plural(todas.length, 'documento')}` : `${todas.length} ${plural(todas.length, 'documento ligado', 'documentos ligados')} en todos los frentes`;
    if (!ligas.length) { cont.appendChild(el('p', 'vacio', todas.length ? 'Nada con ese filtro.' : 'Ningún documento ligado todavía. Se sube o se liga desde Documentos de cada proyecto, o con «Subir».')); return; }
    const porP = new Map(); for (const l of ligas) { const k = Number(l.ProyectoId); if (!porP.has(k)) porP.set(k, []); porP.get(k).push(l); }
    for (const p of ordenarProyectos(estado.proyectos.filter(x => porP.has(x.id)))) {
        const g = el('div', 'grupo-docs'); g.dataset.proyecto = String(p.id);
        const h = el('div', 'sec');
        const ir = p.Clave ? boton(p.Title, 'enlace-proyecto', () => nav.ir('proyecto', p.Clave, 'docs'), { irProyecto: p.Clave }) : el('span', '', p.Title);
        h.appendChild(ir); h.appendChild(el('span', 'n', `${porP.get(p.id).length} ${plural(porP.get(p.id).length, 'doc')}`));
        g.appendChild(h);
        for (const l of porP.get(p.id)) g.appendChild(filaLiga(l, { puede: false }));
        cont.appendChild(g);
    }
}
/** Proyectos activos donde se puede subir (rol + biblioteca autorizada). */
const subiblesActivos = () => ordenarProyectos(estado.proyectos.filter(p => puedeLigarEn(p)));

// ---------------------------------------------------------------- dialogos: contexto

// Con que proyecto / tarjeta se abrio el dialogo. IDS, no objetos (C-20 de Proyectos): se resuelven al usarse.
let ctx = { proyectoId: null, tareaId: null, reemplazaId: null, alTerminar: null };
const proyectoCtx = () => porId(estado.proyectos, ctx.proyectoId);
/** Cancelar / Esc vuelven a la ficha si de ahi se abrio (v0.70.0 de Proyectos). Idempotente. */
function volverSiCancela() { const f = ctx.alTerminar; ctx.alTerminar = null; if (f) f(); }
/** Abierto desde la ficha (`alTerminar`): la ficha se cierra mientras dura el dialogo de alta (los avisos van al dialogo de
 *  arriba, no a la ficha de abajo) y alTerminar la vuelve a abrir al guardar o cancelar. */
function cerrarFichaDebajo(opts) { if (opts.alTerminar && $('dlgFicha').open) cerrarDialogo('dlgFicha'); }
function opcionesTarjetas(sel, p) { opciones(sel, p ? tareasDe(p, estado.tareas) : [], t => t.id, t => String(t.Title || '').slice(0, 70), 'el proyecto entero'); }

// ---------------------------------------------------------------- quitar

/** Quita una liga: borra su renglon de PROY_Ligas y deja «desligó» en la bitacora. El archivo no se toca. Con `reemplazadaPor`
 *  no pregunta (segunda mitad de «ligar el archivado» o del recibo de la skill). */
export async function quitarLiga(l, reemplazadaPor = null) {
    if (!PUEDE.ligar(estado.rol)) { avisar('Tu rol es de lectura: no puedes quitar ligas.', 'error'); return false; }
    if (!reemplazadaPor) {
        const { ok } = await confirmar({ titulo: 'Quitar la liga', ok: 'Quitar', texto: `«${l.Title}» deja de estar ligado a este proyecto. El archivo no se toca: sigue en la biblioteca${l.Tipo === 'buzon' ? ' (o donde lo haya acomodado la skill)' : ''}.` });
        if (!ok) return false;
    }
    try {
        await estado.cliente.borrarRenglon(estado.siteId, L.ligas, l.id, m => avisar(m, 'ojo'));
        estado.ligas = estado.ligas.filter(x => x.id !== l.id);
        if (!reemplazadaPor) avisar(`Liga «${l.Title}» quitada.`, 'ok');
        alCambiar();
        await registrarActividad('desligar', reemplazadaPor ? `reemplazó la liga «${String(l.Title).slice(0, 60)}» por «${String(reemplazadaPor).slice(0, 60)}»` : `desligó «${String(l.Title).slice(0, 80)}»`, l.ProyectoId, l.TareaId);
        return true;
    } catch (e) { avisar('No se pudo quitar la liga: ' + motivo(e), 'error'); return false; }
}

// ---------------------------------------------------------------- ligar un archivado

/** Abre «Ligar archivo» para { proyectoId, tareaId?, texto?, reemplazaId?, alTerminar? }. */
export function abrirLigar(opts = {}) {
    const p = porId(estado.proyectos, opts.proyectoId); const bib = p && bibliotecaDe(p);
    if (!p || !bib) return;
    if (!puedeLigarEn(p)) { avisar(PUEDE.ligar(estado.rol) ? `No se puede ligar aquí: ${porQueNoSube(p)}.` : 'Tu rol es de lectura: no puedes ligar documentos.', 'error'); return; }
    const vieja = opts.reemplazaId != null ? porId(estado.ligas, opts.reemplazaId) : null;
    ctx = { proyectoId: p.id, tareaId: opts.tareaId ? Number(opts.tareaId) : null, reemplazaId: vieja ? vieja.id : null, alTerminar: opts.alTerminar || null };
    cerrarFichaDebajo(opts);
    $('lgBiblioteca').textContent = `Busca en ${bib.nombre} (solo lectura; el buzón no aparece).`;
    $('lgNota').textContent = vieja ? `Al ligar el resultado se quita la liga vieja «${vieja.Title}».` : '';
    $('lgNota').classList.toggle('oculto', !vieja);
    $('lgTexto').value = opts.texto || ''; $('lgResultados').textContent = '';
    opcionesTarjetas($('lgTarea'), p);
    $('lgTarea').value = ctx.tareaId ? String(ctx.tareaId) : '';
    abrirDialogo('dlgLigar');
    if ($('lgTexto').value) buscarDocumento(); else $('lgTexto').focus();
}
async function buscarDocumento() {
    const p = proyectoCtx(); if (!p) { avisar('Ese proyecto ya no existe.', 'ojo'); return; } const bib = bibliotecaDe(p);
    const texto = $('lgTexto').value.trim();
    const cont = $('lgResultados'); cont.textContent = '';
    if (texto.length < 2) { avisar('Escribe al menos dos letras.', 'ojo'); return; }
    $('lgBuscar').disabled = true;
    try {
        const s = await sitioDe(bib);
        if (!s.id) { avisar(PUEDE.proyecto(estado.rol) ? `Sin acceso a ${bib.nombre}: ${s.motivo}. Esta biblioteca no tiene el permiso de la app.` : `Todavía no hay permiso sobre ${bib.nombre}. Pídelo a gerencia; mientras tanto puedes pegar un enlace.`, 'error'); return; }
        const r = await estado.cliente.buscarEnDrive(s.id, texto, CONFIG.buzon, m => avisar(m, 'ojo'));
        if (!r.length) { cont.appendChild(el('p', 'vacio', 'Nada con ese nombre fuera del buzón.')); return; }
        for (const x of r.slice(0, 30)) {
            const fila = el('div', 'lg-resultado');
            fila.appendChild(iconoArchivo(x.nombre, null, 'sm'));
            const izq = el('div', 'lg-cuerpo'); izq.appendChild(el('div', 'lg-nombre', x.nombre)); izq.appendChild(el('div', 'muted', x.rutaConocida === false ? '(carpeta: se resuelve al ligar)' : x.ruta));
            fila.appendChild(izq);
            fila.appendChild(boton('Ligar', 'mn-btn is-sm', () => ligarDocumento(x)));
            cont.appendChild(fila);
        }
    } catch (e) { avisar('No se pudo buscar: ' + motivo(e), 'error'); }
    finally { $('lgBuscar').disabled = false; }
}
async function ligarDocumento(x) {
    const p = proyectoCtx(); if (!p) { avisar('Ese proyecto ya no existe.', 'ojo'); return; } const bib = bibliotecaDe(p);
    if (!puedeLigarEn(p)) { avisar('Tu rol es de lectura: no puedes ligar documentos.', 'error'); return; }
    if (estado.ligas.some(l => Number(l.ProyectoId) === p.id && l.DriveItemId === x.id)) { avisar('Ese archivo ya está ligado a este proyecto.', 'ojo'); return; }
    const tareaId = $('lgTarea').value ? Number($('lgTarea').value) : undefined;
    try {
        // La busqueda no garantiza la carpeta ni trae el GUID: se relee el elemento por id (v0.4.1 de Proyectos).
        let item = x;
        try { const s = await sitioDe(bib); if (s.id) item = { ...x, ...(await estado.cliente.itemDeDrive(s.id, x.id, m => avisar(m, 'ojo'))) }; }
        catch (e) {
            if (e && e.status === 404) { avisar(`«${x.nombre}» ya no está donde la búsqueda lo vio (lo movieron o borraron); vuelve a buscar.`, 'error'); return; }
            console.warn('itemDeDrive:', motivo(e));
        }
        if (item.ruta === CONFIG.buzon || String(item.ruta || '').startsWith(CONFIG.buzon + '/')) { avisar(`«${item.nombre}» está en el buzón ${CONFIG.buzon}: todavía no está archivado. Cuando la skill lo acomode vuelve a ligarlo.`, 'ojo'); return; }
        await crearLigaArchivado(p, bib, item, tareaId);
        const vieja = ctx.reemplazaId != null ? porId(estado.ligas, ctx.reemplazaId) : null; const alTerminar = ctx.alTerminar; ctx.alTerminar = null;
        cerrarDialogo('dlgLigar');
        avisar(vieja ? `«${item.nombre}» ligado en lugar de «${vieja.Title}».` : `«${item.nombre}» ligado.`, 'ok');
        alCambiar();
        await registrarActividad('ligar', `ligó «${item.nombre.slice(0, 80)}»`, p.id, tareaId);
        if (vieja) await quitarLiga(vieja, item.nombre);
        if (alTerminar) alTerminar();
    } catch (e) { avisar('No se pudo ligar: ' + motivo(e), 'error'); }
}
/** El renglon de PROY_Ligas de tipo «archivado» para un elemento ya releido; lo comparten Ligar y el recibo. Revienta con el motivo. */
async function crearLigaArchivado(p, bib, item, tareaId) {
    const sitioUrl = `https://${CONFIG.sharepointHost}${bib.sitio}`;
    const corta = urlCortaDeGuid(sitioUrl, item.guid);
    const url = urlParaLiga(item.url, { sitioUrl, guid: item.guid });
    if (!url) throw new Error(`la liga web de «${item.nombre}» mide ${String(item.url || '').length} caracteres y no cabe en los ${TEXTO_MAX} de la lista; renómbralo más corto o pega un enlace.`);
    const campos = limpiar({ Title: item.nombre, ProyectoId: p.id, TareaId: tareaId, Tipo: 'archivado', Unidad: bib.clave, Ruta: item.ruta, Url: url, DriveItemId: item.id, LigadoPor: estado.cuenta.username });
    const largos = textosLargos(campos);
    if (largos.length) throw new Error(`${largos.join(', ')} pasa(n) de los ${TEXTO_MAX} caracteres que admite una columna de texto de SharePoint.`);
    let n;
    try { n = await estado.cliente.crearRenglon(estado.siteId, L.ligas, campos, m => avisar(m, 'ojo')); }
    catch (e) {
        // El 400 de SharePoint no dice cual campo: con forma corta de la Url se reintenta UNA vez (un 400 no escribe nada).
        if (!(e && e.status === 400)) throw e;
        if (!corta || campos.Url === corta) throw new Error(`${e.message} · largos: ${resumenLargos(campos)}`);
        campos.Url = corta;
        try { n = await estado.cliente.crearRenglon(estado.siteId, L.ligas, campos, m => avisar(m, 'ojo')); }
        catch (e2) { throw (e2 && e2.status === 400) ? new Error(`${e2.message} · largos: ${resumenLargos(campos)} (ya reintentado con la Url corta)`) : e2; }
    }
    return agregarSinDuplicar(estado.ligas, n);
}

// ---------------------------------------------------------------- el recibo de la skill (Proyectos v0.108.0)

const recibosEnCurso = new Map();
/** La carpeta del lote ya no esta: si la skill dejo su recibo en `_resueltos/`, la liga de tipo buzon se REEMPLAZA por ligas a
 *  la ruta final de cada pieza y el recibo se borra. true si reemplazo. Una aplicacion por liga y por carga. */
function aplicarRecibo(p, bib, s, l) {
    const k = `${estado.cargadoEl}:${l.id}`;
    if (!recibosEnCurso.has(k)) {
        for (const vieja of recibosEnCurso.keys()) if (!vieja.startsWith(`${estado.cargadoEl}:`)) recibosEnCurso.delete(vieja);
        recibosEnCurso.set(k, aplicarReciboUnaVez(p, bib, s, l).catch(e => { console.warn('Archivos: no se pudo aplicar el recibo.', motivo(e)); return false; }));
    }
    return recibosEnCurso.get(k);
}
async function aplicarReciboUnaVez(p, bib, s, l) {
    const ruta = rutaRecibo(l.Ruta, CONFIG.buzon);
    const leido = ruta ? await estado.cliente.leerJson(s.id, ruta) : null;
    if (!leido) return false;
    const v = validarRecibo(leido.datos, { lote: ruta.split('/').pop().replace(/\.json$/, ''), proyecto: p.Clave });
    if (!v.ok) { console.warn('Archivos: recibo ignorado:', v.motivo); return false; }
    const tareaId = l.TareaId ? Number(l.TareaId) : undefined;
    const items = [];
    for (const x of v.rutas) {
        const item = await estado.cliente.itemPorRuta(s.id, x.ruta);
        if (!item || !item.esArchivo) { console.warn(`Archivos: el recibo nombra ${x.ruta} y aun no esta en la biblioteca.`); return false; }
        items.push(item);
    }
    for (const item of items) {
        if (estado.ligas.some(k => Number(k.ProyectoId) === p.id && k.DriveItemId === item.id)) continue;
        await crearLigaArchivado(p, bib, item, tareaId);
        await registrarActividad('ligar', `ligó «${item.nombre.slice(0, 80)}» (archivado por la skill)`, p.id, tareaId);
    }
    await quitarLiga(l, items.map(i => i.nombre).join(', '));
    try { await estado.cliente.borrarItemDrive(s.id, leido.id); } catch (e) { console.warn('Archivos: el recibo no se pudo borrar (lo purga la skill).', motivo(e)); }
    avisar(`«${l.Title}» ya está archivado: la liga ahora apunta a ${items.length === 1 ? `«${items[0].nombre}»` : `${items.length} archivos`}.`, 'ok');
    alCambiar();
    return true;
}

// ---------------------------------------------------------------- pegar un enlace

/** Abre «Pegar un enlace» para { proyectoId, tareaId?, alTerminar? }. */
export function abrirEnlace(opts = {}) {
    const p = porId(estado.proyectos, opts.proyectoId); if (!p) return;
    if (!puedeEnlazarEn(p)) { avisar(PUEDE.ligar(estado.rol) ? 'El proyecto está cerrado.' : 'Tu rol es de lectura: no puedes pegar enlaces.', 'error'); return; }
    ctx = { proyectoId: p.id, tareaId: opts.tareaId ? Number(opts.tareaId) : null, reemplazaId: null, alTerminar: opts.alTerminar || null };
    cerrarFichaDebajo(opts);
    $('enTitulo').value = ''; $('enUrl').value = '';
    $('enProyecto').textContent = p.Title || '';
    opcionesTarjetas($('enTarea'), p);
    $('enTarea').value = ctx.tareaId ? String(ctx.tareaId) : '';
    abrirDialogo('dlgEnlace');
    $('enTitulo').focus();
}
async function guardarEnlace(ev) {
    ev.preventDefault();
    const p = proyectoCtx(); if (!p) { avisar('Ese proyecto ya no existe.', 'ojo'); return; }
    if (!puedeEnlazarEn(p)) { avisar('Tu rol es de lectura: no puedes pegar enlaces.', 'error'); return; }
    const titulo = $('enTitulo').value.trim();
    if (!titulo) { avisar('Di qué es el enlace.', 'error'); $('enTitulo').focus(); return; }
    const v = validarUrl($('enUrl').value);
    if (!v.ok) { avisar('Enlace: ' + v.motivo, 'error'); $('enUrl').focus(); return; }
    if (estado.ligas.some(l => Number(l.ProyectoId) === p.id && l.Tipo === 'enlace' && l.Url === v.url)) { avisar('Ese enlace ya está en este proyecto.', 'ojo'); return; }
    const tareaId = $('enTarea').value ? Number($('enTarea').value) : undefined;
    const campos = limpiar({ Title: titulo, ProyectoId: p.id, TareaId: tareaId, Tipo: 'enlace', Url: v.url, LigadoPor: estado.cuenta.username });
    const largos = textosLargos(campos);
    if (largos.length) { avisar(`Enlace: ${largos.join(', ')} pasa(n) de los ${TEXTO_MAX} caracteres que admite la lista; acórtalo (un enlace de SharePoint se acorta con «Copiar vínculo»).`, 'error'); $('enUrl').focus(); return; }
    $('enGuardar').disabled = true;
    try {
        const n = await estado.cliente.crearRenglon(estado.siteId, L.ligas, campos, m => avisar(m, 'ojo'));
        agregarSinDuplicar(estado.ligas, n);
        const alTerminar = ctx.alTerminar; ctx.alTerminar = null;
        cerrarDialogo('dlgEnlace');
        avisar(`Enlace «${titulo}» guardado.`, 'ok');
        alCambiar();
        await registrarActividad('ligar', `pegó el enlace «${titulo.slice(0, 80)}»`, p.id, tareaId);
        if (alTerminar) alTerminar();
    } catch (e) { avisar('No se pudo guardar el enlace: ' + motivo(e), 'error'); }
    finally { $('enGuardar').disabled = false; }
}

// ---------------------------------------------------------------- subir al buzon (queda en SharePoint)

/** Abre «Subir» para { proyectoId?, tareaId?, alTerminar? }. Sin proyecto (#archivos) el dialogo ensena el selector con los
 *  proyectos activos donde se puede subir. */
export function abrirSubir(opts = {}) {
    if (!PUEDE.ligar(estado.rol)) { avisar('Tu rol es de lectura: no puedes subir documentos.', 'error'); return; }
    const fijo = opts.proyectoId != null ? porId(estado.proyectos, opts.proyectoId) : null;
    if (opts.proyectoId != null && (!fijo || !puedeLigarEn(fijo))) { avisar(`No se puede subir aquí: ${porQueNoSube(fijo)}.`, 'error'); return; }
    const lista = fijo ? [fijo] : subiblesActivos();
    if (!lista.length) { avisar('Ningún proyecto activo tiene biblioteca con permiso para subir.', 'error'); return; }
    ctx = { proyectoId: (fijo || lista[0]).id, tareaId: opts.tareaId ? Number(opts.tareaId) : null, reemplazaId: null, alTerminar: opts.alTerminar || null };
    cerrarFichaDebajo(opts);
    $('sbProyectoCampo').classList.toggle('oculto', !!fijo);
    opciones($('sbProyecto'), lista, p => p.id, p => p.Title, null);
    $('sbProyecto').value = String(ctx.proyectoId);
    $('sbConcepto').value = ''; $('sbArchivos').value = ''; $('sbProgreso').textContent = '';
    prepararSubir();
    $('sbTarea').value = ctx.tareaId ? String(ctx.tareaId) : '';
    revisarSubir();
    abrirDialogo('dlgSubir');
    $('sbConcepto').focus();
}
/** Al cambiar de proyecto en el selector: la biblioteca de destino y las tarjetas de ESE proyecto. */
function prepararSubir() {
    const p = porId(estado.proyectos, $('sbProyecto').value) || proyectoCtx(); const bib = p && bibliotecaDe(p);
    ctx.proyectoId = p ? p.id : null;
    $('sbBiblioteca').textContent = bib ? `Va a ${bib.nombre}/${CONFIG.buzon}/ en SharePoint.` : '';
    opcionesTarjetas($('sbTarea'), p);
}
/** El boton dice QUE FALTA (patron de la maqueta). */
function revisarSubir() {
    const faltan = [];
    if (!$('sbConcepto').value.trim()) faltan.push('qué es');
    if (!$('sbArchivos').files || !$('sbArchivos').files.length) faltan.push('los archivos');
    const b = $('sbGuardar');
    b.textContent = faltan.length ? `Falta ${faltan.join(' y ')}` : 'Subir';
    b.disabled = !!faltan.length; b.classList.toggle('is-primary', !faltan.length);
}
/** Carpeta -> piezas -> `_lote.json` AL FINAL (el manifiesto prueba que el lote llego completo). Si falla a medias, se borra. */
async function subirAlBuzon(ev) {
    ev.preventDefault();
    const p = proyectoCtx(); if (!p) { avisar('Ese proyecto ya no existe.', 'ojo'); return; } const bib = bibliotecaDe(p);
    if (!puedeLigarEn(p)) { avisar(PUEDE.ligar(estado.rol) ? `No se puede subir aquí: ${porQueNoSube(p)}.` : 'Tu rol es de lectura: no puedes subir documentos.', 'error'); return; }
    const concepto = $('sbConcepto').value.trim();
    const archivos = [...($('sbArchivos').files || [])];
    if (!concepto) { avisar('Di qué es lo que subes.', 'error'); $('sbConcepto').focus(); return; }
    if (!archivos.length) { avisar('Elige al menos un archivo.', 'error'); return; }
    if (archivos.some(a => a.name === NOMBRE_MANIFIESTO)) { avisar(`Un archivo no se puede llamar ${NOMBRE_MANIFIESTO}.`, 'error'); return; }
    const raro = archivos.find(a => !a.name || a.name === '.' || a.name === '..' || /[\\/]/.test(a.name));   // el nombre va en la RUTA de Graph
    if (raro) { avisar(`El nombre «${raro.name}» no es válido para subirlo.`, 'error'); return; }
    const tareaId = $('sbTarea').value ? Number($('sbTarea').value) : undefined;
    const fecha = fechaMexico();
    const nombreCarpeta = nombreCarpetaLote(fecha, CONFIG.etiquetaLote, p.Clave, slug(concepto));
    // Destino PROPUESTO en el _lote.json: la Carpeta del proyecto o el default de la biblioteca; la skill valida y Carlos da el OK.
    const destino = String(p.Carpeta || bib.destinoLotes || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const manifiesto = construirManifiesto({ appVersion: VERSION, unidad: bib.clave, etiqueta: CONFIG.etiquetaLote, destino, fecha, concepto, archivos: archivos.map(a => a.name), proyecto: p.Clave, tarea: tareaId });
    const v = validarManifiesto(manifiesto);
    if (!v.ok) { avisar('El lote no es válido: ' + v.motivo, 'error'); return; }
    const largos0 = textosLargos({ Title: concepto, Ruta: `${CONFIG.buzon}/${nombreCarpeta}` });
    if (largos0.length) { avisar(`No se pudo subir: ${largos0.join(', ')} pasa(n) de los ${TEXTO_MAX} caracteres que admite la lista; acorta el concepto.`, 'error'); return; }
    const prog = t => { $('sbProgreso').textContent = t; };
    $('sbGuardar').disabled = true;
    let carpeta = null; let s = null;
    try {
        s = await sitioDe(bib);
        if (!s.id) throw new Error(`sin acceso a ${bib.nombre}: ${s.motivo}`);
        prog('Creando la carpeta del lote…');
        carpeta = await estado.cliente.crearCarpeta(s.id, CONFIG.buzon, nombreCarpeta, m => prog(m));
        const ruta = `${CONFIG.buzon}/${carpeta.nombreReal}`;
        for (const [i, a] of archivos.entries()) {
            prog(`Subiendo ${i + 1} de ${archivos.length}: ${a.name}`);
            await estado.cliente.subirPieza(s.id, ruta, a.name, await a.arrayBuffer(), a.type || 'application/octet-stream', m => prog(m));
        }
        prog('Cerrando el lote…');
        await estado.cliente.subirPieza(s.id, ruta, NOMBRE_MANIFIESTO, bytesDelManifiesto(manifiesto), 'application/json', m => prog(m));
        const campos = limpiar({ Title: concepto, ProyectoId: p.id, TareaId: tareaId, Tipo: 'buzon', Unidad: bib.clave, Ruta: ruta, DriveItemId: carpeta.id, LigadoPor: estado.cuenta.username });
        const largos = textosLargos(campos);
        if (largos.length) throw new Error(`${largos.join(', ')} pasa(n) de los ${TEXTO_MAX} caracteres que admite la lista`);
        const n = await estado.cliente.crearRenglon(estado.siteId, L.ligas, campos, m => prog(m));
        agregarSinDuplicar(estado.ligas, n); estado.buzonExiste[ruta] = true;
        const alTerminar = ctx.alTerminar; ctx.alTerminar = null;
        cerrarDialogo('dlgSubir');
        avisar(`Lote «${concepto}» en el buzón de ${bib.nombre} (${archivos.length} ${plural(archivos.length, 'archivo')}).`, 'ok');
        alCambiar();
        await registrarActividad('subir', `subió «${concepto.slice(0, 80)}» al buzón (${archivos.length} archivo(s))`, p.id, tareaId);
        if (alTerminar) alTerminar();
    } catch (e) {
        if (carpeta && s && s.id) { try { await estado.cliente.borrarItemDrive(s.id, carpeta.id); prog('Lote a medias borrado.'); } catch (_) { prog('Quedó una carpeta a medias en el buzón; la skill la trata como lote incompleto.'); } }
        avisar('No se pudo subir: ' + motivo(e), 'error');
        revisarSubir();
    }
}

// ---------------------------------------------------------------- enganche (una vez)

export function engancharArchivos() {
    $('lgCerrar').addEventListener('click', () => { cerrarDialogo('dlgLigar'); volverSiCancela(); });
    $('lgBuscar').addEventListener('click', buscarDocumento);
    $('lgTexto').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); buscarDocumento(); } });
    $('formSubir').addEventListener('submit', subirAlBuzon);
    $('sbCancelar').addEventListener('click', () => { cerrarDialogo('dlgSubir'); volverSiCancela(); });
    $('sbProyecto').addEventListener('change', () => { prepararSubir(); revisarSubir(); });
    $('sbConcepto').addEventListener('input', revisarSubir);
    $('sbArchivos').addEventListener('change', revisarSubir);
    $('formEnlace').addEventListener('submit', guardarEnlace);
    $('enCancelar').addEventListener('click', () => { cerrarDialogo('dlgEnlace'); volverSiCancela(); });
    // Esc y Atras no pasan por los botones: el `close` del <dialog> vuelve a la ficha igual.
    for (const id of ['dlgLigar', 'dlgSubir', 'dlgEnlace']) $(id).addEventListener('close', volverSiCancela);
}
