// ERP de MINSA ENERGY — v0.3.0 (fase 4 del plan, docs/plan.md: v0.3.0 suma las escrituras del kanban, tarjetas.js). Sustituira a MINSA Proyectos.
//
// Entrada con Entra (MSAL por REDIRECCION, token en sessionStorage: la misma secuencia de Proyectos v0.160.0), lectura de
// PROY_Proyectos / PROY_Tareas / PROY_Roles con el motor traido (graph.js + reglas.js + comun.js), y el ARMAZON: rail que en
// celular colapsa a pestañas (.mn-shell de la piel), ruta por hash con el formato de Proyectos (#inicio · #proyectos ·
// #p/<clave> · #archivos · #gastos · #equipo) y tema claro/oscuro. Las pantallas viven en pantallas.js.
// Nada de innerHTML: todo textContent (lo exige test/sw.test.js).

import { CONFIG } from './config.js';
import { crearCliente } from './graph.js';
import { rolDe, nombreDe, misAbiertas, iniciales } from './reglas.js';
import { $, L, VERSION, estado, el, avisar, fijarHash, iconoSvg, proyectoPorClave, fijarReleer } from './comun.js';
import { pintarInicio, pintarProyectos, pintarProyecto, pintarEnConstruccion, pintarNoEncontrado } from './pantallas.js';
import { engancharTarjetas, alCambiarTareas } from './tarjetas.js';

// La redirect URI de produccion es la registrada en Entra; en cualquier otro host (localhost de la E2E) la pagina misma.
const PRODUCCION = new URL(CONFIG.redirectProduccion);
const redirectUri = location.host === PRODUCCION.host ? PRODUCCION.href : new URL('./', window.location.href).href;

// NO llamar `msal` a esta variable: taparia el global del bundle UMD.
const pca = new msal.PublicClientApplication({
    auth: { clientId: CONFIG.clientId, authority: `https://login.microsoftonline.com/${CONFIG.tenantId}`, redirectUri },
    cache: { cacheLocation: 'sessionStorage' }
});

$('pie').textContent = `MINSA ERP v${VERSION}`;

// ---------------------------------------------------------------- tema
// Sin eleccion guardada manda prefers-color-scheme (el CSS lo resuelve solo); el boton fija data-theme en <html> y se
// recuerda por dispositivo. localStorage puede no existir (ventana privada): todo en try.
const TEMA_KEY = 'erp.tema';
const oscuroDelSistema = () => !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
function temaVigente() { const t = document.documentElement.dataset.theme; return t === 'dark' || t === 'light' ? t : (oscuroDelSistema() ? 'dark' : 'light'); }
function fijarTema(t, guardar = true) {
    if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
    if (guardar) { try { localStorage.setItem(TEMA_KEY, t); } catch (_) { /* sin almacenamiento: dura la sesion */ } }
    const v = temaVigente();
    $('temaClaro').classList.toggle('on', v === 'light'); $('temaOscuro').classList.toggle('on', v === 'dark');
    $('temaClaro').setAttribute('aria-pressed', String(v === 'light')); $('temaOscuro').setAttribute('aria-pressed', String(v === 'dark'));
    $('temaMovil').textContent = v === 'dark' ? 'Tema claro' : 'Tema oscuro';
}
{ let guardado = null; try { guardado = localStorage.getItem(TEMA_KEY); } catch (_) { /* idem */ }
  fijarTema(guardado || document.documentElement.dataset.theme || '', false); }
$('temaClaro').addEventListener('click', () => fijarTema('light'));
$('temaOscuro').addEventListener('click', () => fijarTema('dark'));
$('temaMovil').addEventListener('click', () => fijarTema(temaVigente() === 'dark' ? 'light' : 'dark'));
if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => fijarTema(document.documentElement.dataset.theme || '', false));

// ---------------------------------------------------------------- rail
// Los cinco destinos de la maqueta aprobada. Iconos: trazos de 24 px de la maqueta.
const DESTINOS = [
    { clave: 'inicio', nombre: 'Inicio', trazos: ['M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'] },
    { clave: 'proyectos', nombre: 'Proyectos', trazos: ['M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z', 'M3 9h18M9 9v11'] },
    { clave: 'archivos', nombre: 'Archivos', trazos: ['M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'] },
    { clave: 'gastos', nombre: 'Gastos', trazos: ['M6 3h12v18l-3-2-3 2-3-2-3 2z', 'M9 8h6M9 12h6'] },
    { clave: 'equipo', nombre: 'Equipo', trazos: ['M9 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z', 'M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5', 'M17.5 6.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z', 'M16 14.6c2.8.2 4.8 2 5.5 5.4'] }
];
function armarRail() {
    const c = $('destinos'); c.textContent = '';
    for (const d of DESTINOS) {
        const b = el('button', 'navb'); b.type = 'button'; b.dataset.destino = d.clave;
        b.appendChild(iconoSvg(d.trazos, 'ic'));
        b.appendChild(el('span', 'txt', d.nombre));
        const hot = el('span', 'mn-rail-hot'); hot.hidden = true; b.appendChild(hot);
        b.addEventListener('click', () => ir(d.clave));
        c.appendChild(b);
    }
}
/** El contador del rail: mis pendientes abiertos (la misma funcion que pinta Inicio, misAbiertas de reglas.js). */
function contadores() {
    const n = misAbiertas(estado.tareas, estado.cuenta && estado.cuenta.username).length;
    const hot = document.querySelector('[data-destino="inicio"] .mn-rail-hot');
    hot.textContent = String(n); hot.hidden = n === 0; hot.title = `${n} pendiente${n === 1 ? '' : 's'} tuyo${n === 1 ? '' : 's'}`;
}

// ---------------------------------------------------------------- ruta
/** El hash que manda: #inicio · #proyectos · #p/<clave> · #archivos · #gastos · #equipo (el formato de Proyectos, asi
 *  sus ligas pegadas abren aqui). Cualquier otro cae en Inicio. */
function leerHash() {
    const h = decodeURIComponent(location.hash.replace(/^#/, ''));
    const m = /^p\/([^/]+)/.exec(h);
    if (m) return { pestana: 'proyecto', clave: m[1] };
    const p = h.split('/')[0];
    return { pestana: DESTINOS.some(d => d.clave === p) ? p : 'inicio' };
}
function ir(pestana, clave) { fijarHash(pestana === 'proyecto' ? '#p/' + clave : '#' + pestana); pintar(); }
function pintar() {
    if (!estado.sesion) return;
    const r = leerHash();
    estado.pestana = r.pestana;
    const destinoRail = r.pestana === 'proyecto' ? 'proyectos' : r.pestana;
    for (const b of document.querySelectorAll('#destinos .navb')) {
        const on = b.dataset.destino === destinoRail;
        b.classList.toggle('is-on', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    }
    const v = $('vista'); v.textContent = '';
    const nav = { ir };
    if (r.pestana === 'inicio') pintarInicio(v, nav);
    else if (r.pestana === 'proyectos') pintarProyectos(v, nav);
    else if (r.pestana === 'proyecto') {
        const p = proyectoPorClave(r.clave);
        estado.proyectoAbiertoId = p ? p.id : null;
        if (p) pintarProyecto(v, p, nav); else pintarNoEncontrado(v, r.clave, nav);
    }
    else pintarEnConstruccion(v, r.pestana, nav);
    document.title = 'MINSA ERP · ' + (r.pestana === 'proyecto' ? 'Proyecto' : DESTINOS.find(d => d.clave === r.pestana).nombre);
    v.dataset.pantalla = r.pestana;
}
window.addEventListener('popstate', pintar);
window.addEventListener('hashchange', pintar);

// ---------------------------------------------------------------- entrada (Proyectos v0.160.0)
// C-02 de Proyectos (v0.87.0): se guarda la PROMESA; initialize()/handleRedirectPromise() corren una sola vez.
let msalListo = null;
function prepararMsal() {
    return msalListo ??= (async () => { await pca.initialize(); return pca.handleRedirectPromise(); })().catch(e => { msalListo = null; throw e; });
}
async function token() {
    const r = await pca.acquireTokenSilent({ scopes: CONFIG.scopes, account: estado.cuenta || pca.getAllAccounts()[0] });
    return r.accessToken;
}
function pista(texto) { $('textoEntrar').textContent = texto; }
function fallaEntrada(e, prefijo) {
    estado.siteId = null; estado.sesion = false;
    $('pantallaSesion').classList.add('oculto'); $('pantallaEntrar').classList.remove('oculto');
    avisarEntrada(prefijo + ': ' + (e && e.message ? e.message : String(e)));
    $('btnEntrar').disabled = false;
    pista(navigator.onLine === false ? 'Sin conexión: hace falta red para entrar.' : 'No se pudo entrar. Vuelve a intentarlo.');
}
// #avisos vive dentro del shell; antes de entrar el error va en la pista de la tarjeta de entrada y en consola.
function avisarEntrada(texto) { console.error(texto); avisar(texto, 'error'); }

async function entrar() {
    $('btnEntrar').disabled = true;
    pista('Entrando…');
    try {
        await prepararMsal();
        if (pca.getAllAccounts().length === 0) { await pca.loginRedirect({ scopes: CONFIG.scopes }); return; }
        await sesionIniciada();
    } catch (e) { fallaEntrada(e, 'No se pudo entrar'); }
}
async function arrancar() {
    if (window.self !== window.top) return;
    try {
        const respuesta = await prepararMsal();
        if (respuesta && respuesta.account) pca.setActiveAccount(respuesta.account);   // C-09 de Proyectos: la cuenta que vuelve del login
        if (respuesta || pca.getAllAccounts().length > 0) { pista('Entrando…'); await sesionIniciada(); }
        else { $('btnEntrar').disabled = false; $('btnEntrar').focus(); }
    } catch (e) { fallaEntrada(e, 'No se pudo terminar el inicio de sesión'); }
}
async function salir() {
    try { await pca.logoutRedirect({ account: estado.cuenta }); }
    catch (_) { sessionStorage.clear(); window.location.reload(); }
}

/** Lee las tres listas que pintan las pantallas y, una vez por sesion, los nombres reales de las columnas de PROY_Tareas
 *  (C-02 de Proyectos: AsignadoPor solo se escribe si la lista ya lo tiene; si la lectura falla queda null y no se manda).
 *  v0.3.0 escribe en PROY_Tareas y PROY_Actividad (tarjetas.js) y, al borrar, suelta las ligas de PROY_Ligas. */
async function cargarTodo() {
    const s = estado.siteId, c = estado.cliente;
    const columnasTareas = async () => estado.columnasTareas || c.columnas(s, await c.idDeLista(s, L.tareas)).then(cs => new Set(cs.map(x => x.name))).catch(e => { console.warn('PROY_Tareas: no se pudieron leer las columnas; AsignadoPor no se escribe.', e && e.message); return null; });
    const [proyectos, tareas, roles, colsTareas] = await Promise.all([...[L.proyectos, L.tareas, L.roles].map(n => c.renglones(s, n)), columnasTareas()]);
    estado.proyectos = proyectos; estado.tareas = tareas; estado.roles = roles; estado.columnasTareas = colsTareas;
    estado.cargadoEl = Date.now();
}
// Tras una escritura propia se repinta; tras un 412 se RELEE (la verdad esta en SharePoint) y se repinta.
function repintar() { if (!estado.sesion) return; contadores(); pintar(); }
alCambiarTareas(repintar);
fijarReleer(async () => { try { await cargarTodo(); } catch (e) { avisar('No se pudo releer: ' + (e && e.message ? e.message : e), 'error'); } repintar(); });
engancharTarjetas();
async function sesionIniciada() {
    estado.cuenta = pca.getActiveAccount() || pca.getAllAccounts()[0];
    let ultimo = await token();
    estado.cliente = crearCliente(CONFIG.graph, async () => { try { ultimo = await token(); } catch (_) { /* el ultimo leido; el 401 lo dira */ } return ultimo; });
    pista('Abriendo el sitio Administración…');
    estado.siteId = await estado.cliente.sitio(CONFIG.sharepointHost, CONFIG.sitio);
    pista('Leyendo proyectos y pendientes…');
    await cargarTodo();
    estado.rol = rolDe(estado.cuenta.username, estado.roles);
    $('quien').textContent = nombreDe(estado.cuenta.username, estado.roles);
    $('quien').title = estado.cuenta.username;
    $('quien').dataset.iniciales = iniciales(estado.cuenta.username);
    $('rolQuien').textContent = estado.rol;
    armarRail(); contadores();
    estado.sesion = true;
    $('pantallaEntrar').classList.add('oculto');
    $('pantallaSesion').classList.remove('oculto');
    pintar();
}

$('btnEntrar').addEventListener('click', entrar);
$('btnSalir').addEventListener('click', salir);

if ('serviceWorker' in navigator) {
    // S-24 de Proyectos (v0.153.0): la CSP exige Trusted Types; «minsa-sw» es la UNICA politica que permite y solo deja pasar './sw.js'.
    const politicaSw = window.trustedTypes && trustedTypes.createPolicy ? trustedTypes.createPolicy('minsa-sw', { createScriptURL: u => { if (u !== './sw.js') throw new TypeError('minsa-sw: solo ./sw.js'); return u; } }) : null;
    navigator.serviceWorker.register(politicaSw ? politicaSw.createScriptURL('./sw.js') : './sw.js').then(reg => reg.update && reg.update()).catch(() => {});
}

arrancar();
