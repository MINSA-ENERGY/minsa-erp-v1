// ERP de MINSA ENERGY — v0.1.0, ESQUELETO (fase 3 del plan, docs/plan.md). Sustituira a MINSA Proyectos.
//
// Solo hace dos cosas, a proposito: entrar con Entra (MSAL por REDIRECCION, token en sessionStorage, la misma
// secuencia de entrada de Proyectos v0.160.0 app.js) y leer las listas PROY_* con el motor traido de Proyectos
// (graph.js + reglas.js + comun.js), para probar que el motor vive aqui antes de la primera pantalla real.
// Nada de innerHTML: todo textContent (lo exige test/sw.test.js).

import { CONFIG } from './config.js';
import { crearCliente } from './graph.js';
import { rolDe, nombreDe } from './reglas.js';
import { $, L, VERSION, estado, el, avisar } from './comun.js';

// La redirect URI de produccion es la registrada en Entra; en cualquier otro host (localhost de la E2E) la pagina misma.
const PRODUCCION = new URL(CONFIG.redirectProduccion);
const redirectUri = location.host === PRODUCCION.host ? PRODUCCION.href : new URL('./', window.location.href).href;

// NO llamar `msal` a esta variable: taparia el global del bundle UMD.
const pca = new msal.PublicClientApplication({
    auth: { clientId: CONFIG.clientId, authority: `https://login.microsoftonline.com/${CONFIG.tenantId}`, redirectUri },
    cache: { cacheLocation: 'sessionStorage' }
});

$('pie').textContent = `MINSA ERP v${VERSION}`;

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
    avisar(prefijo + ': ' + (e && e.message ? e.message : String(e)), 'error');
    $('btnEntrar').disabled = false;
    pista(navigator.onLine === false ? 'Sin conexión: hace falta red para entrar.' : 'No se pudo entrar. Vuelve a intentarlo.');
}

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

// La prueba del motor: abre el sitio Administracion y cuenta los renglones de cada lista PROY_* de config.js.
// PROY_Capital puede no existir (Proyectos lo tolera): se pinta «no existe» en vez de fallar la entrada.
async function sesionIniciada() {
    estado.cuenta = pca.getActiveAccount() || pca.getAllAccounts()[0];
    let ultimo = await token();
    estado.cliente = crearCliente(CONFIG.graph, async () => { try { ultimo = await token(); } catch (_) { /* el ultimo leido; el 401 lo dira */ } return ultimo; });
    pista('Abriendo el sitio Administración…');
    estado.siteId = await estado.cliente.sitio(CONFIG.sharepointHost, CONFIG.sitio);
    await estado.cliente.listas(estado.siteId);
    const lista = $('listas'); lista.textContent = '';
    for (const nombre of Object.values(L)) {
        const li = el('li'); li.dataset.lista = nombre;
        li.appendChild(el('span', '', nombre));
        let n;
        try {
            const filas = await estado.cliente.renglones(estado.siteId, nombre);
            if (nombre === L.roles) estado.roles = filas;
            n = filas.length === 1 ? '1 renglón' : `${filas.length} renglones`;
        } catch (e) {
            if (nombre !== L.capital) throw e;
            n = 'no existe';
        }
        li.appendChild(el('span', 'n', n));
        lista.appendChild(li);
    }
    estado.rol = rolDe(estado.cuenta.username, estado.roles);
    $('quien').textContent = `${nombreDe(estado.cuenta.username, estado.roles)} · ${estado.rol}`;
    $('quien').title = estado.cuenta.username;
    estado.sesion = true;
    $('pantallaEntrar').classList.add('oculto');
    $('pantallaSesion').classList.remove('oculto');
}

$('btnEntrar').addEventListener('click', entrar);
$('btnSalir').addEventListener('click', salir);

if ('serviceWorker' in navigator) {
    // S-24 de Proyectos (v0.153.0): la CSP exige Trusted Types; «minsa-sw» es la UNICA politica que permite y solo deja pasar './sw.js'.
    const politicaSw = window.trustedTypes && trustedTypes.createPolicy ? trustedTypes.createPolicy('minsa-sw', { createScriptURL: u => { if (u !== './sw.js') throw new TypeError('minsa-sw: solo ./sw.js'); return u; } }) : null;
    navigator.serviceWorker.register(politicaSw ? politicaSw.createScriptURL('./sw.js') : './sw.js').then(reg => reg.update && reg.update()).catch(() => {});
}

arrancar();
