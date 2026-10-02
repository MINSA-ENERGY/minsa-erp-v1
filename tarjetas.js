// ERP v0.3.0 — las ESCRITURAS del kanban (fase 4, paridad con MINSA Proyectos v0.160.0, tablero.js): mover una tarjeta de
// cubeta, crear una tarea y editar su ficha (titulo, asignado, vence, prioridad), y borrarla (solo gerencia).
// Mismas reglas que Proyectos, porque las dos apps escriben sobre las MISMAS listas PROY_*:
//   - PUEDE (reglas.js): lectura no escribe; gerencia y colaborador crean, editan y mueven; solo gerencia borra. Cada funcion
//     de guardar COMPRUEBA el rol (no solo esconde el boton); quien escribe de verdad lo decide SharePoint.
//   - Todo PATCH va con If-Match (el _etag leido). Un 412 = alguien cambio la tarjeta: no se pisa, se releen las listas,
//     se avisa y la ficha (si estaba abierta) se repinta con lo nuevo.
//   - La bitacora PROY_Actividad recibe los MISMOS renglones que escribe Proyectos (crear-tarea · mover-tarea · editar-tarea ·
//     borrar-tarea, con su misma frase), DESPUES de la escritura y best-effort (registrarActividad de comun.js).
// Nada de innerHTML: el() / textContent.

import { PUEDE, columnasDe, tareasDe, nombreDe, nombreColumnaEn, camposDeMovimiento, sellarAsignadoPor, HECHO } from './reglas.js';
import { $, L, estado, boton, avisar, abrirDialogo, cerrarDialogo, opciones, limpiar, porId, aIsoDia, diaInput, fechaInput,
    campoFecha, registrarActividad, aplicarVivo, agregarSinDuplicar, pedirRelectura, personasActivas, mayusculasEnVivo } from './comun.js';
import { esConflicto } from './graph.js';

let alCambiar = () => {};
/** app.js pasa aqui su repintado (contador del rail + pantalla). */
export function alCambiarTareas(fn) { alCambiar = fn; }
const yo = () => String(estado.cuenta && estado.cuenta.username || '').toLowerCase();
const motivo = e => (e && e.message ? e.message : String(e));
/** Las personas activas de PROY_Roles, mas el asignado actual si ya no esta (para no perderlo al abrir la ficha). */
function personas(actual) { const ps = personasActivas(); const a = String(actual || '').toLowerCase(); return a && !ps.includes(a) ? [...ps, a] : ps; }

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
    revisarNueva();
    abrirDialogo('dlgNueva');
    $('ntTitulo').focus();
}
async function guardarNueva(ev) {
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
    // Los mismos campos que escribe guardarNuevaTarea de Proyectos (sin Color: el ERP aun no lo elige).
    const campos = limpiar({
        Title: titulo, ProyectoId: p.id, Columna: columna, Asignado: $('ntAsignado').value || undefined,
        Vence: vence || undefined, Prioridad: $('ntPrioridad').value || 'normal', Orden: tareasDe(p, estado.tareas).filter(t => t.Columna === columna).length + 1,
        Descripcion: $('ntDesc').value.trim() || undefined, Desde: ahora,
        HechoPor: columna === HECHO ? estado.cuenta.username : undefined, HechoEl: columna === HECHO ? ahora : undefined
    });
    if (campos.Asignado) sellarAsignadoPor(campos, estado.columnasTareas, estado.cuenta.username);   // crear ya asignada = delegarla
    $('ntGuardar').disabled = true;
    try {
        const n = await estado.cliente.crearRenglon(estado.siteId, L.tareas, campos, m => avisar(m, 'ojo'));
        agregarSinDuplicar(estado.tareas, n);
        cerrarDialogo('dlgNueva');
        alCambiar();
        avisar(`Tarea creada en ${nombreColumnaEn(columna, cols)}.`, 'ok');
        await registrarActividad('crear-tarea', `creó «${titulo.slice(0, 80)}»${campos.Asignado ? ' para ' + nombreDe(campos.Asignado, estado.roles) : ''}`, p.id, n.id);
    } catch (e) { avisar('No se pudo crear: ' + motivo(e), 'error'); revisarNueva(); }
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
    for (const id of ['fTitulo', 'fAsignado', 'fVence', 'fPrioridad']) $(id).disabled = !edita;
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
    const puedeBorrar = PUEDE.borrar(estado.rol) && activo;
    $('fBorrar').classList.toggle('oculto', !puedeBorrar);
    $('fBorrar').textContent = 'Borrar tarjeta'; delete $('fBorrar').dataset.armado;
    revisarFicha();
}
export function abrirFicha(id) {
    const t = porId(estado.tareas, id); if (!t) return;
    pintarFicha(t);
    abrirDialogo('dlgFicha');
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
        // Como Proyectos: las ligas de la tarjeta se quedan en el proyecto, ya sin tarjeta (best-effort; el ERP no las tiene
        // en memoria, asi que se leen aqui).
        try {
            const ligas = await estado.cliente.renglones(estado.siteId, L.ligas);
            for (const l of ligas) if (Number(l.TareaId) === t.id) { try { await estado.cliente.actualizarRenglon(estado.siteId, L.ligas, l.id, { TareaId: null }, undefined, l._etag); } catch (_) { /* se queda colgada */ } }
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
    $('ntTitulo').addEventListener('input', () => { mayusculasEnVivo($('ntTitulo')); revisarNueva(); });
    $('ntVence').addEventListener('input', revisarNueva);
    $('ntCancelar').addEventListener('click', () => cerrarDialogo('dlgNueva'));
    $('ntCerrar').addEventListener('click', () => cerrarDialogo('dlgNueva'));
    $('formFicha').addEventListener('submit', guardarFicha);
    for (const id of ['fTitulo', 'fVence']) $(id).addEventListener('input', revisarFicha);
    for (const id of ['fAsignado', 'fPrioridad']) $(id).addEventListener('change', revisarFicha);
    $('fCerrar').addEventListener('click', () => cerrarDialogo('dlgFicha'));
    $('fBorrar').addEventListener('click', borrarTarea);
    $('dlgFicha').addEventListener('close', () => { if (!$('dlgFicha').open) fichaId = null; });   // `close` llega tarde: si ya se abrio otra, no es suyo
}
export const fichaAbierta = () => fichaId;
