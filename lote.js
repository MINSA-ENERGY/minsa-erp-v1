// El manifiesto `_lote.json` que la app deja dentro de cada carpeta que sube al buzon.
// Copia de minsa-captura-app/app/manifiesto.js (contrato 1), firmada por esta app.
//
// POR QUE EXISTE. Lo que se sube desde Docs va al buzon `99_Pendiente-Archivar` de la biblioteca
// de la unidad, y la skill de archivar de esa unidad lo acomoda despues. El manifiesto le dice
// de que proyecto y tarea viene y a donde CREE la app que va; la skill lo propone en su plan y
// Carlos da el OK. NO ES UNA ORDEN: ahorra la clasificacion, no el visto bueno.
//
// EL MANIFIESTO SE SUBE AL FINAL, A PROPOSITO. Su presencia es la prueba de que el lote se
// subio COMPLETO. Una subida que se corta a la mitad deja la carpeta con algunas piezas y sin
// manifiesto, y `inventario-buzon.py` la trata como lote incompleto en vez de archivarla entera.

/** Nombre fijo del archivo. Las skills lo buscan por este nombre exacto. */
export const NOMBRE_MANIFIESTO = '_lote.json';

/** Version del CONTRATO, no de la app. Sube solo si cambia la forma del archivo. */
export const CONTRATO = 1;

/** Quien firma. `inventario-buzon.py` (APPS_QUE_ESCRIBEN_LOTES) lo acepta desde el 2026-09-11. */
export const APP = 'minsa-proyectos';

/**
 * Arma el manifiesto de un lote.
 *
 * @param {object} d
 * @param {string} d.appVersion  version de la app (package.json)
 * @param {string} d.unidad      clave de la biblioteca: CALYTEK, PITEPEC, RABASA, LEGAL, FINANZAS
 * @param {string} d.etiqueta    'Proyecto' (config.etiquetaLote)
 * @param {string} d.destino     ruta destino relativa a la RAIZ de la biblioteca (la app no la
 *                               sabe: propone la carpeta del proyecto en la biblioteca; la skill decide)
 * @param {string} d.fecha       YYYY-MM-DD (hora de Mexico)
 * @param {string} d.concepto    lo que escribio la persona, SIN convertir a slug
 * @param {string[]} d.archivos  nombres de las piezas que se subieron, en orden
 * @param {string} d.proyecto    clave del proyecto (PROY_Proyectos.Clave)
 * @param {number} [d.tarea]     id de la tarea en PROY_Tareas, si la hay
 * @param {string} [d.subido]    ISO 8601; por omision, ahora
 */
export function construirManifiesto(d) {
    const archivos = Array.isArray(d.archivos) ? d.archivos.map(texto) : [];
    return {
        app: APP,
        contrato: CONTRATO,
        app_version: texto(d.appVersion),
        unidad: texto(d.unidad),
        etiqueta: texto(d.etiqueta),
        destino: texto(d.destino),
        tipo: 'documento',
        fecha: texto(d.fecha),
        concepto: texto(d.concepto),
        archivos,
        paginas: archivos.length,
        proyecto: texto(d.proyecto),
        tarea: Number.isInteger(d.tarea) ? d.tarea : null,
        subido: d.subido || new Date().toISOString()
    };
}

/** Los bytes listos para subir. UTF-8 explicito: del otro lado lo lee Python. */
export function bytesDelManifiesto(manifiesto) {
    return new TextEncoder().encode(JSON.stringify(manifiesto, null, 2) + '\n');
}

/**
 * Revisa un manifiesto ya armado. Es la MISMA validacion que corre `inventario-buzon.py` del
 * otro lado, para que la app no suba nunca un manifiesto que la skill rechazaria.
 * @returns {{ok: boolean, motivo?: string}}
 */
export function validarManifiesto(m) {
    if (!m || typeof m !== 'object') return { ok: false, motivo: 'no es un objeto' };
    if (m.app !== APP) return { ok: false, motivo: 'no lo escribio esta app' };
    if (m.contrato !== CONTRATO) return { ok: false, motivo: `contrato ${m.contrato}, esta version lee ${CONTRATO}` };
    for (const campo of ['unidad', 'etiqueta', 'destino', 'tipo', 'fecha', 'proyecto']) {
        if (!texto(m[campo])) return { ok: false, motivo: `sin ${campo}` };
    }
    if (m.tipo !== 'documento') return { ok: false, motivo: `tipo "${m.tipo}" desconocido` };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(m.fecha)) return { ok: false, motivo: `fecha "${m.fecha}" no es YYYY-MM-DD` };
    if (!Array.isArray(m.archivos) || m.archivos.length === 0) return { ok: false, motivo: 'sin lista de archivos' };
    if (m.archivos.some(a => a === NOMBRE_MANIFIESTO)) return { ok: false, motivo: 'el manifiesto no se lista a si mismo' };
    if (!Number.isInteger(m.paginas) || m.paginas < 1) return { ok: false, motivo: `paginas ${JSON.stringify(m.paginas)}: debe ser un entero >= 1` };
    const partes = String(m.destino).replace(/\\/g, '/').split('/').filter(Boolean);
    if (!partes.length || partes.some(p => p === '..' || p === '.')) return { ok: false, motivo: `destino invalido: ${m.destino}` };
    if (partes[0] === '99_Pendiente-Archivar') return { ok: false, motivo: 'el destino apunta al propio buzon' };
    return { ok: true };
}

// ---------------------------------------------------------------- el recibo (el regreso)
// v0.108.0 (2026-09-25): al archivar un lote de esta app, la skill deja
// `99_Pendiente-Archivar/_resueltos/<carpeta del lote>.json` (`recibo-lote.py`) con la RUTA FINAL de
// cada pieza —movida y renombrada, o `duplicado` de algo que ya estaba archivado—. Docs lo lee cuando
// la carpeta del lote ya no existe, reemplaza la liga de tipo buzon por ligas a esas rutas y borra el
// recibo. Sin recibo, sigue el camino de antes («Buscar el archivado»).

export const CARPETA_RECIBOS = '_resueltos';
export const CONTRATO_RECIBO = 1;

/** Ruta del recibo de un lote, relativa a la raiz, a partir de la Ruta de su liga (`<buzon>/<carpeta>`). */
export function rutaRecibo(rutaLote, buzon = '99_Pendiente-Archivar') {
    const carpeta = String(rutaLote || '').replace(/\\/g, '/').split('/').filter(Boolean).pop();
    return carpeta ? `${buzon}/${CARPETA_RECIBOS}/${carpeta}.json` : null;
}

/**
 * Revisa un recibo leido del buzon. Lo escribe la skill, pero el buzon lo puede escribir cualquiera
 * con permiso: se trata como entrada hostil, igual que el manifiesto del otro lado.
 * @returns {{ok: boolean, motivo?: string, rutas?: {archivo: string, ruta: string, como: string}[]}}
 *   `rutas` trae cada pieza (movida o duplicada) sin repetir ruta. No hay recibo parcial: una pieza sin ruta
 *   lo invalida entero — quitar la liga del lote con una pieza pendiente la perderia en silencio.
 */
export function validarRecibo(r, { lote, proyecto } = {}) {
    if (!r || typeof r !== 'object') return { ok: false, motivo: 'no es un objeto' };
    if (r.app !== APP) return { ok: false, motivo: 'no es un recibo de esta app' };
    if (r.recibo !== CONTRATO_RECIBO) return { ok: false, motivo: `recibo ${r.recibo}, esta version lee ${CONTRATO_RECIBO}` };
    if (lote && r.lote !== lote) return { ok: false, motivo: `es del lote ${r.lote}, no de ${lote}` };
    if (proyecto && texto(r.proyecto) !== texto(proyecto)) return { ok: false, motivo: `es del proyecto ${r.proyecto}, no de ${proyecto}` };
    if (!Array.isArray(r.piezas) || !r.piezas.length) return { ok: false, motivo: 'sin piezas' };
    const rutas = [], vistas = new Set();
    for (const p of r.piezas) {
        if (!p || !['movido', 'duplicado'].includes(p.como)) return { ok: false, motivo: `pieza con «como» desconocido: ${p && p.como}` };
        const partes = String(p.ruta || '').replace(/\\/g, '/').split('/').filter(Boolean);
        if (!partes.length || partes.some(x => x === '..' || x === '.')) return { ok: false, motivo: `ruta invalida: ${p.ruta}` };
        if (partes[0] === '99_Pendiente-Archivar') return { ok: false, motivo: 'una pieza apunta al buzon' };
        const ruta = partes.join('/');
        if (vistas.has(ruta)) continue;
        vistas.add(ruta); rutas.push({ archivo: texto(p.archivo), ruta, como: p.como });
    }
    return { ok: true, rutas };
}

/** Nombre de la carpeta del lote en el buzon: `<fecha>_Proyecto_<clave>_<slug del concepto>`. */
export function nombreCarpetaLote(fecha, etiqueta, clave, conceptoSlug) {
    return [fecha, etiqueta, clave, conceptoSlug].filter(Boolean).join('_');
}

function texto(v) { return v === null || v === undefined ? '' : String(v).trim(); }
