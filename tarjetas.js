// ERP v0.3.0 — las ESCRITURAS del kanban (fase 4, paridad con MINSA Proyectos v0.160.0, tablero.js): mover una tarjeta de
// cubeta, crear una tarea y editar su ficha (titulo, asignado, vence, prioridad), y borrarla (solo gerencia).
// Mismas reglas que Proyectos, porque las dos apps escriben sobre las MISMAS listas PROY_*:
//   - PUEDE (reglas.js): lectura no escribe; gerencia y colaborador crean, editan y mueven; solo gerencia borra. Cada funcion
//     de guardar COMPRUEBA el rol (no solo esconde el boton); quien escribe de verdad lo decide SharePoint.
//   - Todo PATCH va con If-Match (el _etag leido). Un 412 = alguien cambio la tarjeta: no se pisa, se releen las listas,
//     se avisa y la ficha (si estaba abierta) se repinta con lo nuevo.
//   - La bitacora PROY_Actividad recibe los MISMOS renglones que escribe Proyectos (crear-tarea · mover-tarea · editar-tarea ·
//     borrar-tarea, con su misma frase), DESPUES de la escritura y best-effort (registrarActividad de comun.js).
// v0.5.0: la ficha suma lo que le faltaba de la de Proyectos — DESCRIPCION (editable, viaja en el mismo PATCH), DOCUMENTOS de
// la tarjeta (sus ligas, quitar, y Subir / Ligar / Enlace con la tarjeta ya puesta: archivos.js) y NOTAS (Accion=comentar en
// PROY_Actividad, el mismo renglon que escribe Proyectos; aqui la escritura ES la accion, asi que si falla se ve).
// v0.8.0: lo que faltaba de la ficha de Proyectos — COLOR (selectorTonos de tablero.js v0.12.0; viaja en el mismo PATCH solo si
// cambio), SUBIR/BAJAR dentro de la cubeta (F11: renumera Orden, un PATCH con If-Match por tarjeta que cambia, sin bitacora,
// como Proyectos), «CREAR Y OTRA» en la tarea nueva (C1 de Proyectos v0.5.0) y BORRAR UNA NOTA (borrarComentario de comun.js,
// Proyectos v0.9.0: la propia, o cualquiera si gerencia; sin renglon de bitacora porque PROY_Actividad.Accion esta congelada).
// Nada de innerHTML: el() / textContent.

import { PUEDE, columnasDe, tareasDe, nombreDe, nombreCorto, nombreColumnaEn, camposDeMovimiento, sellarAsignadoPor, HECHO,
    COLORES, colorValido, ordenar, reordenar } from './reglas.js';
import { $, L, estado, el, boton, avisar, abrirDialogo, cerrarDialogo, opciones, limpiar, porId, aIsoDia, diaInput, fechaInput,
    campoFecha, registrarActividad, aplicarVivo, agregarSinDuplicar, pedirRelectura, personasActivas, mayusculasEnVivo,
    notasDe, fusionarActividad, asegurarActividadDe, fechaHora, puedeBorrarComentario, borrarComentario } from './comun.js';
import { esConflicto } from './graph.js';
import { filaLiga, botonesAlta, puedeLigarEn, puedeEnlazarEn } from './archivos.js';

let alCambiar = () => {};
/** app.js pasa aqui su repintado (contador del rail + pantalla). */
export function alCambiarTareas(fn) { alCambiar = fn; }
const yo = () => String(estado.cuenta && estado.cuenta.username || '').toLowerCase();
const motivo = e => (e && e.message ? e.message : String(e));
/** Las personas activas de PROY_Roles, mas el asignado actual si ya no esta (para no perderlo al abrir la ficha). */
function personas(actual) { const ps = personasActivas(); const a = String(actual || '').toLowerCase(); return a && !ps.includes(a) ? [...ps, a] : ps; }
/** v0.8.0: la lista tiene la columna Color (si no se pudieron leer las columnas, se asume que si: como Proyectos, que la manda solo
 *  cuando cambia). Sin ella, el selector no se ensena: un Color en el cuerpo seria un 400 de SharePoint en toda edicion. */
const hayColor = () => !estado.columnasTareas || estado.columnasTareas.has('Color');

// ---------------------------------------------------------------- selector de color (v0.8.0; tablero.js v0.12.0 de Proyectos)
/** Una fila de circulos (sin color + los 8 de COLORES) como grupo de radios: role=radio + aria-checked, UN tab por fila (roving
 *  tabindex) y flechas. El valor vive en cont.dataset.valor; `alElegir` es opcional; `apagado` deshabilita todo (lectura). */
export function selectorTonos(cont, actual, alElegir, rotulo = 'Color', apagado = false) {
    cont.textContent = ''; cont.dataset.valor = colorValido(actual); cont.setAttribute('role', 'radiogroup');
    const ops = [{ clave: '', nombre: 'Sin color' }, ...COLORES];
    const marcar = clave => { cont.dataset.valor = clave; for (const x of cont.children) { const on = x.dataset.tono === clave; x.setAttribute('aria-checked', on ? 'true' : 'false'); x.tabIndex = on ? 0 : -1; } };
    for (const c of ops) {
        const b = el('button'); b.type = 'button'; b.dataset.tono = c.clave; b.title = c.nombre; b.disabled = apagado;
        b.setAttribute('role', 'radio'); b.setAttribute('aria-label', `${rotulo}: ${c.nombre}`);
        b.addEventListener('click', () => { marcar(c.clave); if (alElegir) alElegir(c.clave); });
        b.addEventListener('keydown', ev => {
            const d = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 0; if (!d) return;
            ev.preventDefault(); const i = (ops.findIndex(o => o.clave === c.clave) + d + ops.length) % ops.length;
            marcar(ops[i].clave); cont.children[i].focus(); if (alElegir) alElegir(ops[i].clave);
        });
        cont.appendChild(b);
    }
    marcar(cont.dataset.valor);
    return cont;
}

// ---------------------------------------------------------------- 412
let fichaId = null;
/** Un 412: alguien cambio la tarjeta desde que se leyo. No se pisa: se relee, se avisa y la ficha abierta se repinta. */
async function conflicto(t) {
    const abierta = $('dlgFicha').open && fichaId === t.id;
    await pedirRelectura();
    const fresca = porId(estado.tareas, t.id);
    if (abierta && fresca) pintarFicha(fresca); else if (abierta) cerrarDialogo('dlgFicha');
    avisar(fresca ? `Alguien cambió «${String(fresca.Title || '').slice(0, 60)}» hace un momento: se releyó. Revisa y vuelve a intentarlo.` : 'Esa tarjeta ya no existe: alguien la borró hace un momento.', 'ojo');
}

// ---------------------------------------------------------------- mover
/** Mueve la tarjeta `id` a la cubeta `columna` de SU proyecto: PATCH con If-Match + sello (camposDeMovimiento) + bitacora. */
export async function moverTarea(id, columna) {
    const t = porId(estado.tareas, id); if (!t) return false;
    if (!PUEDE.mover(estado.rol)) { avisar('Tu rol es de lectura: no puedes mover tarjetas.', 'error'); return false; }
    const p = porId(estado.proyectos, t.ProyectoId);
    if (!p || p.Estado !== 'activo') { avisar('El proyecto está cerrado.', 'error'); return false; }
    if (t.Columna === columna) return false;
    const cols = columnasDe(p);
    if (!cols.some(c => c.clave === columna)) { avisar('Esa cubeta ya no existe en el proyecto.', 'error'); return false; }
    const antes = t.Columna;
    for (const b of $('fMover').querySelectorAll('button')) b.disabled = true;
    try {
        const campos = camposDeMovimiento(columna, estado.cuenta.username, new Date(), cols);
        const res = await estado.cliente.actualizarRenglon(estado.siteId, L.tareas, t.id, campos, m => avisar(m, 'ojo'), t._etag);
        aplicarVivo(estado.tareas, t.id, campos, res && res._etag, t);   // C-19 de Proyectos: al renglon VIVO
        if ($('dlgFicha').open) cerrarDialogo('dlgFicha');
        alCambiar();
        avisar(`«${t.Title}» → ${nombreColumnaEn(columna, cols)}.`, 'ok');
        await registrarActividad('mover-tarea', `movió «${String(t.Title || '').slice(0, 80)}» de ${nombreColumnaEn(antes, cols)} a ${nombreColumnaEn(columna, cols)}`, t.ProyectoId, t.id);
        return true;
    } catch (e) {
        if (esConflicto(e)) { await conflicto(t); return false; }
        avisar('No se pudo mover: ' + motivo(e), 'error');
        const vivo = porId(estado.tareas, id); if ($('dlgFicha').open && vivo) pintarFicha(vivo);
        return false;
    }
}

// ---------------------------------------------------------------- nueva tarea
/** El boton dice QUE FALTA (patron de la maqueta) y solo se enciende cuando no falta nada. */
function revisarNueva() {
    const b = $('ntGuardar');
    let falta = '';
    if (!$('ntTitulo').value.trim()) falta = 'Falta el título';
    else { try { aIsoDia($('ntVence').value); } catch (_) { falta = 'Falta una fecha válida (dd/mm/aaaa)'; } }
    b.textContent = falta || 'Crear tarea'; b.disabled = !!falta; b.classList.toggle('is-primary', !falta);
    $('ntGuardarYOtra').disabled = !!falta;   // v0.8.0: «Crear y otra» se enciende con el mismo criterio
}
export function abrirNuevaTarea(p) {
    if (!p) return;
    if (!PUEDE.tarea(estado.rol)) { avisar('Tu rol es de lectura: no puedes crear tarjetas.', 'error'); return; }
    if (p.Estado !== 'activo') { avisar('El proyecto está cerrado.', 'error'); return; }
    $('dlgNueva').dataset.proyecto = String(p.id);
    $('ntProyecto').textContent = p.Title || '';
    opciones($('ntAsignado'), personas(), x => x, x => nombreDe(x, estado.roles), 'sin asignar');
    $('ntAsignado').value = personas().includes(yo()) ? yo() : '';
    const cols = columnasDe(p);   // nace en la primera cubeta del proyecto (como en Proyectos, escritorio)
    opciones($('ntColumna'), cols, c => c.clave, c => c.nombre, null);
    $('ntColumna').value = cols[0].clave;
    $('ntTitulo').value = ''; $('ntPrioridad').value = 'normal'; $('ntVence').value = ''; $('ntDesc').value = '';
    selectorTonos($('ntColor'), '', null, 'Color de la tarjeta');   // v0.8.0
    $('ntColorCampo').classList.toggle('oculto', !hayColor());
    revisarNueva();
    abrirDialogo('dlgNueva');
    $('ntTitulo').focus();
}
/** v0.8.0 (C1 de Proyectos v0.5.0): con `seguirCapturando` («Crear y otra») guarda y deja el dialogo abierto con cubeta, asignado,
 *  prioridad, vence y color puestos; solo se vacian titulo y descripcion, que cambian de una tarjeta a otra. */
async function guardarNueva(ev, seguirCapturando = false) {
    if (ev) ev.preventDefault();
    const p = porId(estado.proyectos, $('dlgNueva').dataset.proyecto); if (!p) return;
    if (!PUEDE.tarea(estado.rol)) { avisar('Tu rol es de lectura: no puedes crear tarjetas.', 'error'); return; }
    if (p.Estado !== 'activo') { avisar('El proyecto está cerrado.', 'error'); return; }
    const titulo = $('ntTitulo').value.trim().toLocaleUpperCase('es-MX');   // Proyectos v0.107.0: la tarea nueva siempre en MAYUSCULAS
    if (!titulo) { avisar('La tarea necesita un título.', 'error'); $('ntTitulo').focus(); return; }
    let vence; try { vence = aIsoDia($('ntVence').value); } catch (e) { avisar(e.message, 'error'); return; }
    const cols = columnasDe(p);
    const columna = cols.some(c => c.clave === $('ntColumna').value) ? $('ntColumna').value : cols[0].clave;
    const ahora = new Date().toISOString();
    // Los mismos campos que escribe guardarNuevaTarea de Proyectos (v0.8.0: con Color, solo si se eligio uno).
    const campos = limpiar({
        Title: titulo, ProyectoId: p.id, Columna: columna, Asignado: $('ntAsignado').value || undefined,
        Vence: vence || undefined, Prioridad: $('ntPrioridad').value || 'normal', Orden: tareasDe(p, estado.tareas).filter(t => t.Columna === columna).length + 1,
        Descripcion: $('ntDesc').value.trim() || undefined, Desde: ahora, Color: (hayColor() && colorValido($('ntColor').dataset.valor)) || undefined,
        HechoPor: columna === HECHO ? estado.cuenta.username : undefined, HechoEl: columna === HECHO ? ahora : undefined
    });
    if (campos.Asignado) sellarAsignadoPor(campos, estado.columnasTareas, estado.cuenta.username);   // crear ya asignada = delegarla
    // Los dos botones se apagan AQUI, dentro del alcance que los repone (revisarNueva): el revisor de Proyectos cazo el 12-sep un
    // «Crear y otra» muerto para siempre cuando la validacion de arriba retornaba antes.
    $('ntGuardar').disabled = true; $('ntGuardarYOtra').disabled = true;
    try {
        const n = await estado.cliente.crearRenglon(estado.siteId, L.tareas, campos, m => avisar(m, 'ojo'));
        agregarSinDuplicar(estado.tareas, n);
        if (seguirCapturando) { $('ntTitulo').value = ''; $('ntDesc').value = ''; $('ntTitulo').focus(); }
        else cerrarDialogo('dlgNueva');
        alCambiar();
        avisar(`Tarea creada en ${nombreColumnaEn(columna, cols)}.`, 'ok');
        await registrarActividad('crear-tarea', `creó «${titulo.slice(0, 80)}»${campos.Asignado ? ' para ' + nombreDe(campos.Asignado, estado.roles) : ''}`, p.id, n.id);
    } catch (e) { avisar('No se pudo crear: ' + motivo(e), 'error'); }
    finally { revisarNueva(); }
}

// ---------------------------------------------------------------- ficha
/** Lo que cambio en la ficha contra la tarjeta `t` (solo lo distinto viaja en el PATCH). Lanza si la fecha no es valida. */
function cambiosFicha(t) {
    const c = {};
    const titulo = $('fTitulo').value.trim();
    if (titulo && titulo !== t.Title) c.Title = titulo;
    const a = $('fAsignado').value || null;
    if (String(t.Asignado || '').toLowerCase() !== String(a || '').toLowerCase()) c.Asignado = a;
    const pr = $('fPrioridad').value || 'normal';
    if (pr !== (t.Prioridad || 'normal')) c.Prioridad = pr;
    const v = aIsoDia($('fVence').value);
    if (diaInput(v) !== diaInput(t.Vence)) c.Vence = v;
    const d = $('fDesc').value.trim();   // v0.5.0: vacia = null (borra la celda), como Proyectos
    if (d !== String(t.Descripcion || '').trim()) c.Descripcion = d || null;
    // v0.8.0: Color solo si cambio (Proyectos v0.12.0: un Color siempre presente daria 400 en una lista sin la columna); «Sin color» = null.
    if (hayColor()) { const col = colorValido($('fColor').dataset.valor); if (col !== colorValido(t.Color)) c.Color = col || null; }
    return c;
}
function revisarFicha() {
    const t = porId(estado.tareas, fichaId); const b = $('fGuardar'); if (!t) return;
    let falta = '';
    if (!$('fTitulo').value.trim()) falta = 'Falta el título';
    else { try { if (!Object.keys(cambiosFicha(t)).length) falta = 'Sin cambios'; } catch (_) { falta = 'Falta una fecha válida (dd/mm/aaaa)'; } }
    b.textContent = falta || 'Guardar cambios'; b.disabled = !!falta; b.classList.toggle('is-primary', !falta);
}
function pintarFicha(t) {
    fichaId = t.id;
    const p = porId(estado.proyectos, t.ProyectoId);
    const cols = columnasDe(p);
    const activo = !!p && p.Estado === 'activo';
    const edita = PUEDE.tarea(estado.rol) && activo, mueve = PUEDE.mover(estado.rol) && activo;
    $('fCab').textContent = t.Title || '(sin título)';
    $('fDonde').textContent = `${p ? p.Title : 'Sin proyecto'} · ${nombreColumnaEn(t.Columna, cols)}`;
    $('fTitulo').value = t.Title || '';
    opciones($('fAsignado'), personas(t.Asignado), x => x, x => nombreDe(x, estado.roles), 'sin asignar');
    $('fAsignado').value = String(t.Asignado || '').toLowerCase();
    $('fVence').value = fechaInput(t.Vence);
    $('fPrioridad').value = t.Prioridad || 'normal';
    $('fDesc').value = t.Descripcion || '';
    selectorTonos($('fColor'), t.Color, revisarFicha, 'Color de la tarjeta', !edita);   // v0.8.0
    $('fColorCampo').classList.toggle('oculto', !hayColor());
    for (const id of ['fTitulo', 'fAsignado', 'fVence', 'fPrioridad', 'fDesc']) $(id).disabled = !edita;
    for (const b of document.querySelectorAll('#formFicha .fecha-cal')) b.disabled = !edita;
    $('fGuardar').classList.toggle('oculto', !edita);
    $('fSoloLectura').classList.toggle('oculto', edita);
    $('fSoloLectura').textContent = !activo ? 'El proyecto está cerrado: la tarjeta no se edita.' : 'Tu rol es de lectura: puedes ver la tarjeta, no cambiarla.';
    // «Mover a…»: un boton por cubeta del proyecto. Es la via del celular (alli no se arrastra) y del teclado.
    const mv = $('fMover'); mv.textContent = '';
    for (const c of cols) {
        const aqui = t.Columna === c.clave;
        const b = boton(aqui ? `${c.nombre} · actual` : c.nombre, 'mn-btn is-sm' + (aqui ? ' is-here' : ''), () => moverTarea(t.id, c.clave), { move: c.clave });
        if (aqui) b.setAttribute('aria-current', 'true');
        b.disabled = !mueve || aqui;
        mv.appendChild(b);
    }
    $('fMoverCaja').classList.toggle('oculto', !mueve);
    pintarOrden(t, p);
    const puedeBorrar = PUEDE.borrar(estado.rol) && activo;
    $('fBorrar').classList.toggle('oculto', !puedeBorrar);
    $('fBorrar').textContent = 'Borrar tarjeta'; delete $('fBorrar').dataset.armado;
    pintarDocsFicha(t, p);
    pintarNotas(t, p);
    revisarFicha();
}
/** v0.8.0 (F11 de Proyectos): el lugar de la tarjeta en su cubeta («2 de 5») con Subir / Bajar. Solo si el rol mueve, el proyecto
 *  esta activo y la cubeta tiene mas de una tarjeta. Se repinta sola (sin tocar lo que se esta editando en la ficha). */
function pintarOrden(t, p) {
    const or = $('fOrden'); or.textContent = '';
    const mueve = PUEDE.mover(estado.rol) && !!p && p.Estado === 'activo';
    const hermanas = mueve ? ordenar(tareasDe(p, estado.tareas).filter(x => x.Columna === t.Columna)) : [];
    or.classList.toggle('oculto', hermanas.length < 2);
    if (hermanas.length < 2) return;
    const i = hermanas.findIndex(x => x.id === t.id);
    or.appendChild(el('span', 'lugar', `Lugar en la cubeta: ${i + 1} de ${hermanas.length}`));
    const up = boton('↑ Subir', 'mn-btn is-sm', () => reordenarTarea(t.id, -1), { orden: 'subir' }); up.disabled = i <= 0; up.title = 'Subir un lugar'; or.appendChild(up);
    const dn = boton('↓ Bajar', 'mn-btn is-sm', () => reordenarTarea(t.id, 1), { orden: 'bajar' }); dn.disabled = i >= hermanas.length - 1; dn.title = 'Bajar un lugar'; or.appendChild(dn);
}
/** v0.8.0 (F11 de Proyectos): Subir / Bajar. reordenar() renumera la cubeta en el orden visual y devuelve SOLO lo que cambia (la
 *  primera vez puede ser la cubeta entera: las sembradas no traen Orden); cada cambio es un PATCH con If-Match. Sin bitacora,
 *  como Proyectos. Si falla a medias (los PATCH van en serie) se relee para no quedar a medias. */
export async function reordenarTarea(id, delta) {
    const t = porId(estado.tareas, id); if (!t) return false;
    if (!PUEDE.mover(estado.rol)) { avisar('Tu rol es de lectura: no puedes reordenar.', 'error'); return false; }
    const p = porId(estado.proyectos, t.ProyectoId);
    if (!p || p.Estado !== 'activo') { avisar('El proyecto está cerrado.', 'error'); return false; }
    const cambios = reordenar(tareasDe(p, estado.tareas).filter(x => x.Columna === t.Columna), t.id, delta);
    if (!cambios.length) return false;
    for (const b of $('fOrden').querySelectorAll('button')) b.disabled = true;
    const repintarOrden = () => { const tv = porId(estado.tareas, id); if ($('dlgFicha').open && fichaId === id && tv) pintarOrden(tv, porId(estado.proyectos, tv.ProyectoId)); };
    try {
        for (const c of cambios) {
            const x = porId(estado.tareas, c.id);
            const res = await estado.cliente.actualizarRenglon(estado.siteId, L.tareas, x.id, { Orden: c.Orden }, m => avisar(m, 'ojo'), x._etag);
            aplicarVivo(estado.tareas, x.id, { Orden: c.Orden }, res && res._etag, x);
        }
        alCambiar();
        repintarOrden();
        avisar(delta < 0 ? 'Subida un lugar.' : 'Bajada un lugar.', 'ok');
        return true;
    } catch (e) {
        if (esConflicto(e)) { await conflicto(t); return false; }
        await pedirRelectura(); repintarOrden();
        avisar('No se pudo reordenar: ' + motivo(e), 'error');
        return false;
    }
}
/** v0.5.0: los documentos de la tarjeta (sus ligas de PROY_Ligas) y los botones de alta con la tarjeta ya puesta; al terminar
 *  o cancelar el dialogo de alta, la ficha se vuelve a abrir (alTerminar). */
function pintarDocsFicha(t, p) {
    const c = $('fDocs'); c.textContent = '';
    const ligas = estado.ligas.filter(l => Number(l.TareaId) === t.id).sort((a, b) => String(b._creado || '').localeCompare(String(a._creado || '')) || b.id - a.id);
    $('fDocsN').textContent = ligas.length ? String(ligas.length) : '';
    for (const l of ligas) c.appendChild(filaLiga(l, { puede: l.Tipo === 'enlace' ? puedeEnlazarEn(p) : puedeLigarEn(p), conTarjeta: false }));
    if (!ligas.length) c.appendChild(el('p', 'vacio', 'Sin documentos todavía.'));
    const a = $('fDocsAltas'); a.textContent = '';
    if (p) a.appendChild(botonesAlta(p, { tareaId: t.id, alTerminar: () => abrirFicha(t.id), compacto: true }));
}
/** v0.5.0: las notas de la tarjeta (Accion=comentar), de la mas vieja a la mas nueva, y el campo para anotar si el rol edita. */
function pintarNotas(t, p) {
    const c = $('fNotas'); c.textContent = '';
    const notas = notasDe(t.id);
    $('fNotasN').textContent = notas.length ? String(notas.length) : '';
    for (const n of notas) {
        const it = el('div', 'nota'); it.dataset.nota = String(n.id);
        const cab = el('div', 'nota-cab'); cab.appendChild(el('b', '', nombreCorto(n.Quien, estado.roles))); cab.appendChild(el('span', 'muted', fechaHora(n.Cuando)));
        it.appendChild(cab); it.appendChild(el('div', 'nota-texto', n.Title || ''));
        // v0.8.0 (Proyectos v0.9.0): borrar la nota — la propia, o cualquiera si gerencia; proyecto activo. Se resuelve por id AL
        // CLIC (una relectura reemplaza los objetos) y borrarComentario vuelve a comprobar el permiso y pregunta antes.
        if (puedeBorrarComentario(n, p)) {
            const nId = n.id, tId = t.id;
            const b = boton('Borrar', 'mn-btn is-ghost is-sm borrar-nota', async () => {
                const nv = porId(estado.actividad, nId), tv = porId(estado.tareas, tId), pv = tv && porId(estado.proyectos, tv.ProyectoId);
                if (!nv || !tv) { avisar('Esa nota ya no está.', 'ojo'); return; }
                if (await borrarComentario(nv, pv)) { pintarNotas(tv, pv); alCambiar(); }
            }, { borrarNota: String(n.id) });
            b.title = 'Borrar esta nota'; b.setAttribute('aria-label', 'Borrar esta nota');
            cab.appendChild(b);
        }
        c.appendChild(it);
    }
    if (!notas.length) c.appendChild(el('p', 'vacio', 'Sin notas todavía.'));
    const anota = PUEDE.tarea(estado.rol) && !!p && p.Estado === 'activo';
    $('fAnotarCaja').classList.toggle('oculto', !anota);
}
/** Repinta SOLO documentos, notas y lugar en la cubeta de la ficha abierta (tras una liga, un quitar o una relectura) sin tocar lo que se edita. */
export function refrescarFicha() {
    if (!$('dlgFicha').open || fichaId == null) return;
    const t = porId(estado.tareas, fichaId); if (!t) return;
    const p = porId(estado.proyectos, t.ProyectoId);
    pintarDocsFicha(t, p); pintarNotas(t, p); pintarOrden(t, p);   // v0.8.0: el lugar en la cubeta tambien (no toca lo que se edita)
}
export function abrirFicha(id) {
    const t = porId(estado.tareas, id); if (!t) return;
    $('fNota').value = '';   // C-04 de Proyectos: la nota se vacia al ABRIR, no en cada repintado
    pintarFicha(t);
    abrirDialogo('dlgFicha');
    // La carga trae la bitacora acotada; las notas viejas de este proyecto se completan una vez por carga.
    asegurarActividadDe(t.ProyectoId).then(trajo => { if (trajo) refrescarFicha(); });
}
async function anotar() {
    const t = porId(estado.tareas, fichaId); if (!t) return;
    if (!PUEDE.tarea(estado.rol)) { avisar('Tu rol es de lectura: no puedes anotar.', 'error'); return; }
    const p = porId(estado.proyectos, t.ProyectoId);
    if (!p || p.Estado !== 'activo') { avisar('El proyecto está cerrado.', 'error'); return; }
    if ($('fAnotar').disabled) return;
    const texto = $('fNota').value.trim();
    if (!texto) { $('fNota').focus(); return; }
    if (texto.length > 250) { avisar('La nota no cabe: máximo 250 caracteres (es un renglón de la bitácora).', 'error'); return; }
    $('fAnotar').disabled = true;
    try {
        const r = { Title: texto, Accion: 'comentar', Quien: estado.cuenta.username, Cuando: new Date().toISOString(), ProyectoId: Number(t.ProyectoId), TareaId: t.id };
        const n = await estado.cliente.crearRenglon(estado.siteId, L.actividad, r, m => avisar(m, 'ojo'));
        fusionarActividad([n]);
        $('fNota').value = '';
        pintarNotas(t, p);
        avisar('Nota guardada.', 'ok');
        alCambiar();
    } catch (e) { avisar('No se pudo guardar la nota: ' + motivo(e), 'error'); }
    finally { $('fAnotar').disabled = false; }
}
async function guardarFicha(ev) {
    if (ev) ev.preventDefault();
    const t = porId(estado.tareas, fichaId); if (!t) return;
    if (!PUEDE.tarea(estado.rol)) { avisar('Tu rol es de lectura: no puedes editar tarjetas.', 'error'); return; }
    const p = porId(estado.proyectos, t.ProyectoId);
    if (!p || p.Estado !== 'activo') { avisar('El proyecto está cerrado.', 'error'); return; }
    if (!$('fTitulo').value.trim()) { avisar('La tarea necesita un título.', 'error'); $('fTitulo').focus(); return; }
    let campos; try { campos = cambiosFicha(t); } catch (e) { avisar(e.message, 'error'); return; }
    if (!Object.keys(campos).length) return;   // nada cambio: ni PATCH ni bitacora
    const cambioAsignado = 'Asignado' in campos;
    sellarAsignadoPor(campos, estado.columnasTareas, estado.cuenta.username);   // quien asigna queda en la tarjeta (si la lista ya tiene la columna)
    const titulo = campos.Title || t.Title || '';
    $('fGuardar').disabled = true;
    try {
        const res = await estado.cliente.actualizarRenglon(estado.siteId, L.tareas, t.id, campos, m => avisar(m, 'ojo'), t._etag);
        const tv = aplicarVivo(estado.tareas, t.id, campos, res && res._etag, t);
        pintarFicha(tv);
        alCambiar();
        avisar('Tarjeta actualizada.', 'ok');
        await registrarActividad('editar-tarea', cambioAsignado && campos.Asignado ? `asignó «${titulo.slice(0, 80)}» a ${nombreDe(campos.Asignado, estado.roles)}` : `editó «${titulo.slice(0, 80)}»`, t.ProyectoId, t.id);
    } catch (e) {
        if (esConflicto(e)) { await conflicto(t); return; }
        avisar('No se pudo guardar: ' + motivo(e), 'error'); revisarFicha();
    }
}
/** Solo gerencia. Dos toques (el primero arma, el segundo borra): sin dialogo de confirmacion encima de otro dialogo. */
async function borrarTarea() {
    const t = porId(estado.tareas, fichaId); if (!t) return;
    if (!PUEDE.borrar(estado.rol)) { avisar('Solo gerencia borra tarjetas.', 'error'); return; }
    const b = $('fBorrar');
    if (!b.dataset.armado) { b.dataset.armado = '1'; b.textContent = '¿Borrarla? Toca otra vez para confirmar'; return; }
    b.disabled = true;
    try {
        await estado.cliente.borrarRenglon(estado.siteId, L.tareas, t.id, m => avisar(m, 'ojo'));
        estado.tareas = estado.tareas.filter(x => x.id !== t.id);
        // Como Proyectos: las ligas de la tarjeta se quedan en el proyecto, ya sin tarjeta (best-effort). Se leen frescas (otra
        // persona pudo ligar algo desde la ultima carga) y el cambio se refleja tambien en memoria (v0.5.0: el ERP ya las pinta).
        try {
            const ligas = await estado.cliente.renglones(estado.siteId, L.ligas);
            for (const l of ligas) if (Number(l.TareaId) === t.id) { try { const res = await estado.cliente.actualizarRenglon(estado.siteId, L.ligas, l.id, { TareaId: null }, undefined, l._etag); aplicarVivo(estado.ligas, l.id, { TareaId: null }, res && res._etag); } catch (_) { /* se queda colgada */ } }
        } catch (_) { /* sin ligas que soltar */ }
        cerrarDialogo('dlgFicha');
        alCambiar();
        avisar('Tarjeta borrada.', 'ok');
        await registrarActividad('borrar-tarea', `borró «${String(t.Title || '').slice(0, 80)}»`, t.ProyectoId, null);
    } catch (e) { avisar('No se pudo borrar: ' + motivo(e), 'error'); }
    finally { b.disabled = false; }
}

// ---------------------------------------------------------------- arrastrar (escritorio)
/** La tarjeta arrastrable: solo si el rol mueve y el proyecto esta activo. En celular (sin arrastre) se mueve desde la ficha. */
export function hacerArrastrable(nodo, t, p) {
    if (!(PUEDE.mover(estado.rol) && p && p.Estado === 'activo')) return;
    nodo.draggable = true;
    nodo.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', String(t.id)); e.dataTransfer.effectAllowed = 'move'; nodo.classList.add('arrastrando'); });
    nodo.addEventListener('dragend', () => nodo.classList.remove('arrastrando'));
}
/** La cubeta que recibe: resalta al pasar y, al soltar, mueve (moverTarea vuelve a comprobar rol, proyecto y cubeta). */
export function hacerReceptora(col, clave, p) {
    if (!clave || !(PUEDE.mover(estado.rol) && p && p.Estado === 'activo')) return;
    col.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; col.classList.add('recibe'); });
    col.addEventListener('dragleave', e => { if (!col.contains(e.relatedTarget)) col.classList.remove('recibe'); });
    col.addEventListener('drop', e => { e.preventDefault(); col.classList.remove('recibe'); const id = Number(e.dataTransfer.getData('text/plain')); if (id) moverTarea(id, clave); });
}

// ---------------------------------------------------------------- enganche (una vez)
export function engancharTarjetas() {
    campoFecha('ntVence'); campoFecha('fVence');
    $('formNueva').addEventListener('submit', guardarNueva);
    $('ntGuardarYOtra').addEventListener('click', () => guardarNueva(null, true));   // v0.8.0 (C1 de Proyectos)
    $('ntTitulo').addEventListener('input', () => { mayusculasEnVivo($('ntTitulo')); revisarNueva(); });
    $('ntVence').addEventListener('input', revisarNueva);
    $('ntCancelar').addEventListener('click', () => cerrarDialogo('dlgNueva'));
    $('ntCerrar').addEventListener('click', () => cerrarDialogo('dlgNueva'));
    $('formFicha').addEventListener('submit', guardarFicha);
    for (const id of ['fTitulo', 'fVence', 'fDesc']) $(id).addEventListener('input', revisarFicha);
    $('fAnotar').addEventListener('click', anotar);
    $('fNota').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); anotar(); } });
    for (const id of ['fAsignado', 'fPrioridad']) $(id).addEventListener('change', revisarFicha);
    $('fCerrar').addEventListener('click', () => cerrarDialogo('dlgFicha'));
    $('fBorrar').addEventListener('click', borrarTarea);
    $('dlgFicha').addEventListener('close', () => { if (!$('dlgFicha').open) fichaId = null; });   // `close` llega tarde: si ya se abrio otra, no es suyo
}
export const fichaAbierta = () => fichaId;
