// ERP v0.6.0 — las pantallas de la fase 4: Inicio · Mis pendientes, Proyectos, el tablero de un Proyecto (v0.3.0: con
// escrituras — crear, mover arrastrando o desde la ficha, editar; viven en tarjetas.js), su pestaña Documentos y la pantalla
// Archivos (v0.5.0: archivos.js), Equipo con «Escribió en la app» (v0.5.0) y, desde v0.6.0, Gastos en gastos.js (fase 5).
// Forma: maqueta aprobada del 2026-10-01 (Main/Celular). Datos: las listas PROY_* de esquema.json, leidas como las lee
// MINSA Proyectos (vistas.js/tablero.js). Todo con el()/textContent: los datos los escriben diez personas.

import { misAbiertas, diasPara, columnasDe, tareasDe, avance, ordenar, ordenarProyectos, activosDe, nombreDe, nombreCorto,
    saludoDe, porVence, colorValido, fechaMexico, desdeHaceDias, HECHO, PUEDE } from './reglas.js';
import { estado, el, chip, chipVence, equipoDe, iconoEquipo, mesDia, fechaLegible, porId, fechaCorta } from './comun.js';
import { abrirNuevaTarea, abrirFicha, hacerArrastrable, hacerReceptora } from './tarjetas.js';
import { pintarDocsProyecto, faltantesDe } from './archivos.js';
import { CONFIG } from './config.js';

const yo = () => (estado.cuenta && estado.cuenta.username) || '';

/**
 * Mis pendientes por VENCIMIENTO: las tarjetas abiertas asignadas a mi (misAbiertas, la misma que cuenta el rail) en cinco
 * grupos excluyentes — vencidas · hoy · esta semana (1–7 d) · más adelante · sin fecha —, cada uno de la mas urgente a la menos.
 * Los grupos vacios no salen. Distinta de gruposHoy (reglas.js), que deja fuera lo de mas de 7 dias y lo sin fecha: aqui
 * «mis pendientes» tiene que sumar lo mismo que el contador del rail.
 */
export function gruposPendientes(tareas, correo, hoy = new Date()) {
    const g = [
        { clave: 'vencidas', nombre: 'Vencidas', tono: 'r', items: [] },
        { clave: 'hoy', nombre: 'Hoy', tono: 'a', items: [] },
        { clave: 'semana', nombre: 'Esta semana', tono: 'b', items: [] },
        { clave: 'despues', nombre: 'Más adelante', tono: '', items: [] },
        { clave: 'sin-fecha', nombre: 'Sin fecha', tono: '', items: [] }
    ];
    for (const t of [...misAbiertas(tareas, correo)].sort(porVence)) {
        const d = diasPara(t.Vence, hoy);
        g[d === null ? 4 : d < 0 ? 0 : d === 0 ? 1 : d <= 7 ? 2 : 3].items.push(t);
    }
    return g.filter(x => x.items.length);
}

export function cabecera(titulo, sub, etiqueta) {
    const h = el('div', 'cabecera');
    const t = el('div');
    if (etiqueta) t.appendChild(el('div', 'lbl', etiqueta));
    t.appendChild(el('h1', 'ttl', titulo));
    if (sub) t.appendChild(el('div', 'sub', sub));
    h.appendChild(t);
    return h;
}
/** La hoja de calendario de una fecha (mes arriba, dia grande), o «sin fecha». */
export function hojaDia(iso, clase = 'dia') {
    const c = el('div', clase); const md = mesDia(iso);
    if (md) { c.appendChild(el('span', 'mes', md.mes.toUpperCase())); c.appendChild(el('b', '', md.dia)); }
    else { c.classList.add('sin'); c.appendChild(el('b', '', '—')); c.appendChild(el('span', 'mes', 'sin fecha')); }
    return c;
}

// ---------------------------------------------------------------- Inicio
export function pintarInicio(v, nav) {
    const nombre = nombreDe(yo(), estado.roles).split(' ')[0];
    const activos = activosDe(estado.proyectos);
    v.appendChild(cabecera(`${saludoDe()}, ${nombre}`, `${fechaLegible(fechaMexico())} · ${activos.length} ${activos.length === 1 ? 'frente activo' : 'frentes activos'} · ${estado.rol}`));

    const mias = misAbiertas(estado.tareas, yo());
    const card = el('section', 'card pendientes'); card.id = 'misPendientes';
    const cab = el('div', 'card-cab'); cab.appendChild(el('h2', 'h2', 'Mis pendientes')); cab.appendChild(el('span', 'mn-chip', String(mias.length)));
    card.appendChild(cab);
    const grupos = gruposPendientes(estado.tareas, yo());
    if (!grupos.length) card.appendChild(el('p', 'vacio', 'No tienes pendientes asignados. Lo que te asignen en un proyecto aparece aquí.'));
    for (const g of grupos) {
        const sec = el('div', 'grupo'); sec.dataset.grupo = g.clave;
        const s = el('div', 'sec' + (g.tono ? ' ' + g.tono : '')); s.appendChild(el('span', '', g.nombre)); s.appendChild(el('span', 'n', String(g.items.length)));
        sec.appendChild(s);
        for (const t of g.items) sec.appendChild(filaPendiente(t, nav));
        card.appendChild(sec);
    }
    v.appendChild(card);

    const pc = el('section', 'card'); pc.id = 'inicioProyectos';
    const cab2 = el('div', 'card-cab'); cab2.appendChild(el('h2', 'h2', 'Proyectos activos')); cab2.appendChild(el('span', 'mn-chip', String(activos.length)));
    pc.appendChild(cab2);
    const rej = el('div', 'rejilla-proyectos');
    for (const p of ordenarProyectos(activos)) rej.appendChild(tarjetaProyecto(p, nav));
    if (!activos.length) pc.appendChild(el('p', 'vacio', 'No hay proyectos activos.'));
    pc.appendChild(rej);
    v.appendChild(pc);
}
function filaPendiente(t, nav) {
    const p = porId(estado.proyectos, t.ProyectoId);
    const f = el('button', 'fila'); f.type = 'button'; f.dataset.tarea = t.id;
    f.appendChild(hojaDia(t.Vence));
    const cuerpo = el('div', 'cuerpo');
    cuerpo.appendChild(el('div', 'titulo', t.Title || '(sin título)'));
    const meta = el('div', 'meta');
    meta.appendChild(el('span', 'muted', p ? p.Title : 'Sin proyecto'));
    const cv = chipVence(t); if (cv) meta.appendChild(cv);
    if (t.Prioridad === 'alta') meta.appendChild(chip('alta', 'danger'));
    cuerpo.appendChild(meta);
    f.appendChild(cuerpo);
    if (p && p.Clave) f.addEventListener('click', () => nav.ir('proyecto', p.Clave)); else f.disabled = true;
    return f;
}

// ---------------------------------------------------------------- Proyectos
function tarjetaProyecto(p, nav) {
    const eq = equipoDe(p);
    const b = el('button', 'pcard'); b.type = 'button'; b.dataset.clave = p.Clave || '';
    b.appendChild(hojaDia(p.Vence, 'hoja'));
    b.appendChild(iconoEquipo(eq));
    const t = el('div', 'pc-tit');
    t.appendChild(el('div', 'nombre', p.Title || '(sin nombre)'));
    t.appendChild(el('div', 'rama', [eq.rama, eq.nombre].filter(Boolean).join(' · ')));
    b.appendChild(t);
    const a = avance(tareasDe(p, estado.tareas), columnasDe(p));
    const nums = el('div', 'nums');
    for (const [n, r] of [[a.porCategoria['por-hacer'], 'por hacer'], [a.porCategoria['en-proceso'], 'en curso'], [a.porCategoria.hecho, 'hechas']]) {
        const c = el('div', 'n'); c.appendChild(el('b', '', n)); c.appendChild(el('span', '', r)); nums.appendChild(c);
    }
    b.appendChild(nums);
    if (p.Clave) b.addEventListener('click', () => nav.ir('proyecto', p.Clave)); else b.disabled = true;
    return b;
}
export function pintarProyectos(v, nav) {
    const activos = ordenarProyectos(activosDe(estado.proyectos));
    const cerrados = ordenarProyectos(estado.proyectos.filter(p => p.Estado !== 'activo'));
    v.appendChild(cabecera('Proyectos', `${activos.length} activos · ${cerrados.length} cerrados`, 'Frentes del equipo'));
    const lista = el('div', 'lista-proyectos'); lista.id = 'listaProyectos';
    for (const p of activos) lista.appendChild(tarjetaProyecto(p, nav));
    if (!activos.length) lista.appendChild(el('p', 'vacio', 'No hay proyectos activos.'));
    v.appendChild(lista);
    if (cerrados.length) {
        const d = el('details', 'cerrados'); d.id = 'proyectosCerrados';
        d.appendChild(el('summary', '', `Cerrados · ${cerrados.length}`));
        const l2 = el('div', 'lista-proyectos');
        for (const p of cerrados) l2.appendChild(tarjetaProyecto(p, nav));
        d.appendChild(l2); v.appendChild(d);
    }
}

// ---------------------------------------------------------------- Proyecto: tablero
export function pintarProyecto(v, p, nav, pestanaP = 'tablero') {
    const eq = equipoDe(p);
    const vuelta = el('button', 'volver'); vuelta.type = 'button'; vuelta.textContent = '← Proyectos';
    vuelta.addEventListener('click', () => nav.ir('proyectos'));
    v.appendChild(vuelta);
    const cab = el('div', 'cabecera proyecto');
    const t = el('div');
    const l1 = el('div', 'linea-chips');
    const ce = chip([eq.nombre, eq.rama].filter(Boolean).join(' · '), 'ok'); l1.appendChild(ce);
    if (p.Estado !== 'activo') l1.appendChild(chip('cerrado'));
    if (p.Responsable) l1.appendChild(el('span', 'lbl', 'Responsable: ' + nombreDe(p.Responsable, estado.roles)));
    t.appendChild(l1);
    const h = el('h1', 'ttl', p.Title || '(sin nombre)'); h.id = 'tituloProyecto'; t.appendChild(h);
    if (p.Descripcion) t.appendChild(el('div', 'sub desc', p.Descripcion));
    cab.appendChild(t);
    // v0.3.0: «Nueva tarea» abre el dialogo. Si no se puede, el boton dice POR QUE (patron de la maqueta) y no hace nada.
    const activo = p.Estado === 'activo';
    if (activo && PUEDE.tarea(estado.rol)) {
        const b = el('button', 'mn-btn is-primary', '+ Nueva tarea'); b.type = 'button'; b.id = 'btnNuevaTarea';
        b.addEventListener('click', () => abrirNuevaTarea(p)); cab.appendChild(b);
    } else {
        const falta = el('button', 'btn incompleto', activo ? 'Nueva tarea: tu rol es de lectura' : 'Proyecto cerrado: no admite tareas'); falta.type = 'button'; falta.disabled = true; falta.id = 'btnNuevaTarea';
        cab.appendChild(falta);
    }
    v.appendChild(cab);

    // v0.5.0: pestañas del proyecto — Tablero y Documentos (con «faltan N»; la maqueta: «Documentos que faltan · 6»). El hash
    // es el de Proyectos: #p/<clave> y #p/<clave>/docs.
    const tabs = el('div', 'tabs-proyecto'); tabs.setAttribute('role', 'tablist'); tabs.id = 'tabsProyecto';
    const nFaltan = faltantesDe(p).length;
    for (const [k, texto] of [['tablero', 'Tablero'], ['docs', 'Documentos']]) {
        const b = el('button', 'tab' + (pestanaP === k ? ' is-on' : '')); b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.tab = k;
        b.setAttribute('aria-selected', String(pestanaP === k)); b.appendChild(el('span', '', texto));
        if (k === 'docs' && nFaltan) { const c = chip(`faltan ${nFaltan}`, 'warn'); c.title = `${nFaltan} ${nFaltan === 1 ? 'tarjeta abierta' : 'tarjetas abiertas'} sin documentos`; b.appendChild(c); }
        b.addEventListener('click', () => nav.ir('proyecto', p.Clave, k));
        tabs.appendChild(b);
    }
    v.appendChild(tabs);
    if (pestanaP === 'docs') { pintarDocsProyecto(v, p, { abrirTarjeta: abrirFicha }); return; }

    const cols = columnasDe(p);
    const ts = tareasDe(p, estado.tareas);
    const sinCubeta = ts.filter(x => !cols.some(c => c.clave === x.Columna));
    const tab = el('div', 'kanban'); tab.id = 'kanban';
    tab.style.setProperty('--ncol', String(cols.length + (sinCubeta.length ? 1 : 0)));
    cols.forEach((c, i) => tab.appendChild(columnaKanban(p, c.nombre, ts.filter(x => x.Columna === c.clave), c.clave === HECHO ? 'k-hecho' : i === 0 ? 'k-por-hacer' : 'k-en-curso', c.clave, c.color)));
    if (sinCubeta.length) tab.appendChild(columnaKanban(p, 'Sin cubeta', sinCubeta, '', '', ''));
    v.appendChild(tab);
    const nota = !activo ? 'El proyecto está cerrado: el tablero es de consulta.' : PUEDE.mover(estado.rol)
        ? 'Arrastra una tarjeta a otra cubeta, o tócala para editarla y moverla desde su ficha.'
        : 'Tu rol es de lectura: puedes ver el tablero y abrir las tarjetas, no cambiarlas.';
    const n = el('p', 'nota-lectura', nota); n.id = 'notaTablero'; v.appendChild(n);
}
function columnaKanban(p, nombre, tarjetas, clase, clave, color) {
    const col = el('section', 'kcol ' + clase); col.dataset.columna = clave;
    hacerReceptora(col, clave, p);   // «Sin cubeta» (clave vacia) no recibe
    if (colorValido(color)) col.dataset.tono = colorValido(color);   // v0.8.0: data-tono, el atributo que pinta estilo.css (antes data-color, sin regla)
    const h = el('div', 'kcol-cab'); h.appendChild(el('h2', 'lbl', nombre)); h.appendChild(el('span', 'mn-chip', String(tarjetas.length)));
    col.appendChild(h);
    for (const t of ordenar(tarjetas)) col.appendChild(tarjetaKanban(t, p));
    if (!tarjetas.length) col.appendChild(el('p', 'vacio', 'Nada aquí todavía.'));
    return col;
}
function tarjetaKanban(t, p) {
    // v0.3.0: la tarjeta es un BOTON (abre su ficha; teclado incluido) y, si el rol mueve, se arrastra a otra cubeta.
    const c = el('button', 'kc'); c.type = 'button'; c.dataset.tarea = t.id;
    if (colorValido(t.Color)) c.dataset.tono = colorValido(t.Color);   // v0.8.0: el color elegido en la ficha tiñe la tarjeta
    c.appendChild(el('span', 'titulo', t.Title || '(sin título)'));
    const pie = el('span', 'kc-pie');
    if (t.Asignado) {
        // v0.4.0: sin iniciales — Carlos quito los avatares de toda la app de Proyectos (v0.61.0, «no me gusta como se ve»).
        const q = el('span', 'quien');
        q.appendChild(el('span', 'muted', nombreCorto(t.Asignado, estado.roles))); pie.appendChild(q);
    } else pie.appendChild(el('span', 'muted sin-dueno', 'sin dueño'));
    const cv = chipVence(t); if (cv) pie.appendChild(cv);
    if (t.Prioridad === 'alta' && t.Columna !== HECHO) pie.appendChild(chip('alta', 'danger'));
    c.appendChild(pie);
    c.addEventListener('click', () => abrirFicha(t.id));
    hacerArrastrable(c, t, p);
    return c;
}
export function pintarNoEncontrado(v, clave, nav) {
    v.appendChild(cabecera('No encontré ese proyecto', `No hay ningún proyecto con la clave «${clave}». Puede que lo hayan renombrado o borrado.`));
    const b = el('button', 'mn-btn', 'Ver todos los proyectos'); b.type = 'button'; b.addEventListener('click', () => nav.ir('proyectos'));
    v.appendChild(b);
}

// ---------------------------------------------------------------- Equipo (v0.5.0)
/**
 * «Escribió en la app» (la metrica de adopcion del plan: 6 de 10 personas con una escritura propia a las 6 semanas): por
 * correo en minusculas, cuantos renglones de PROY_Actividad firmo (Quien) y el mas reciente. PROY_Actividad la escriben
 * MINSA Proyectos y el ERP (misma lista) despues de cada escritura: crear, mover, editar, ligar, subir, anotar. Cuenta todo
 * renglon, incluido el ✓ «visto» de Proyectos (tambien es una escritura propia). La app lee los ultimos CONFIG.actividadDias.
 */
export function escriturasPorPersona(actividad) {
    const m = new Map();
    for (const a of actividad || []) {
        const k = String(a.Quien || '').trim().toLowerCase(); if (!k) continue;
        const r = m.get(k) || { n: 0, ultima: '' };
        r.n++; if (String(a.Cuando || '') > r.ultima) r.ultima = String(a.Cuando || '');
        m.set(k, r);
    }
    return m;
}
export function pintarEquipo(v) {
    const personas = estado.roles.filter(r => r.Activo !== false && r.Title)
        .sort((a, b) => String(a.Nombre || a.Title).localeCompare(String(b.Nombre || b.Title), 'es'));
    // Solo la ventana: abrir una ficha completa en memoria TODA la bitacora de su proyecto (asegurarActividadDe) y no debe mover la cifra.
    const piso = desdeHaceDias(CONFIG.actividadDias);
    const esc = escriturasPorPersona(piso ? estado.actividad.filter(a => String(a.Cuando || '') >= piso) : estado.actividad);
    const escribieron = personas.filter(r => esc.has(String(r.Title).toLowerCase())).length;
    v.appendChild(cabecera('Equipo', `${personas.length} ${personas.length === 1 ? 'persona activa' : 'personas activas'} · roles de PROY_Roles`, 'Personas y roles'));
    const res = el('section', 'card adopcion'); res.id = 'equipoAdopcion';
    const cab = el('div', 'card-cab'); cab.appendChild(el('h2', 'h2', 'Escribió en la app')); cab.appendChild(chip(`${escribieron} de ${personas.length}`, escribieron >= Math.min(6, personas.length) ? 'ok' : 'warn'));
    res.appendChild(cab);
    res.appendChild(el('p', 'muted', `Personas con al menos una escritura propia en los últimos ${CONFIG.actividadDias} días (crear, mover, editar, ligar, subir o anotar, aquí o en MINSA Proyectos: comparten la bitácora). La meta del plan es 6 de 10 a las 6 semanas de que el ERP se comparta con el equipo.`));
    v.appendChild(res);
    const card = el('section', 'card'); card.id = 'equipoLista';
    const t = el('div', 'tabla-equipo'); t.setAttribute('role', 'table'); t.setAttribute('aria-label', 'Equipo');
    const h = el('div', 'fila-eq cab'); h.setAttribute('role', 'row');
    for (const x of ['Persona', 'Rol en la app', 'Pendientes abiertos', 'Escribió en la app']) { const c = el('span', 'lbl', x); c.setAttribute('role', 'columnheader'); h.appendChild(c); }
    t.appendChild(h);
    for (const r of personas) {
        const correo = String(r.Title).toLowerCase(); const e = esc.get(correo);
        const f = el('div', 'fila-eq'); f.setAttribute('role', 'row'); f.dataset.persona = correo;
        const n = el('span', 'persona', r.Nombre || nombreDe(r.Title, estado.roles)); n.title = r.Title; n.setAttribute('role', 'cell'); f.appendChild(n);
        const rol = el('span', 'rol'); rol.setAttribute('role', 'cell'); rol.appendChild(chip(r.Rol || '—')); f.appendChild(rol);
        const ab = misAbiertas(estado.tareas, correo).length;
        const a = el('span', 'abiertos'); a.setAttribute('role', 'cell'); a.dataset.abiertos = String(ab); a.appendChild(el('b', '', String(ab))); a.appendChild(el('span', 'muted', ab === 1 ? ' pendiente' : ' pendientes')); f.appendChild(a);
        const u = el('span', 'uso'); u.setAttribute('role', 'cell'); u.dataset.escribio = e ? 'si' : 'no';
        if (e) { u.appendChild(chip(`Sí · ${e.n}`, 'ok')); u.appendChild(el('span', 'muted', `última ${fechaCorta(e.ultima)}`)); } else u.appendChild(chip('No'));
        f.appendChild(u);
        t.appendChild(f);
    }
    if (!personas.length) card.appendChild(el('p', 'vacio', 'PROY_Roles no tiene personas activas.'));
    card.appendChild(t);
    v.appendChild(card);
}

// ---------------------------------------------------------------- en construccion
// Honestas: dicen que NO esta, por que, y donde se hace hoy. El boton dice que falta (no hace nada).
const EN_CONSTRUCCION = {};   // v0.6.0: Gastos dejo de serlo (gastos.js); queda el generico para un destino futuro
export function pintarEnConstruccion(v, pestana) {
    const c = EN_CONSTRUCCION[pestana] || { titulo: pestana, etiqueta: '', texto: 'Esta pantalla todavía no existe.', falta: 'Falta: construirla' };
    v.appendChild(cabecera(c.titulo, '', c.etiqueta));
    const card = el('section', 'card construccion'); card.id = 'enConstruccion';
    card.appendChild(chip('en construcción', 'warn'));
    card.appendChild(el('p', '', c.texto));
    const b = el('button', 'btn incompleto', c.falta); b.type = 'button'; b.disabled = true;
    card.appendChild(b);
    v.appendChild(card);
}
