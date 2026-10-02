// node test/gastos.test.js — reglas puras de Gastos (ERP v0.6.0, fase 5: docs/plan.md decisiones 5, 7 y 10).
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { rolesErpDe, PUEDE_GASTO, misGastos, porReembolsar, resueltos, yaReembolsadoAntes, mesDe, totalesPorMes, sumaPorMoneda,
    formatoMonto, etiquetaEstado, etiquetaCfdi, extComprobante, tipoComprobante, comprobanteValido, nombreComprobante, rutaComprobante,
    faltanGasto, largoInvalido, camposGasto, camposReembolso, camposRechazo, ESTADOS_GASTO, MONEDAS, CATEGORIAS_GASTO, CFDI_ESTADOS, COMPROBANTE_MAX_MB } from '../gastos-reglas.js';

let n = 0;
const ok = (nombre, cond) => { assert.ok(cond, nombre); n++; };
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

// --- el esquema fundido: los catalogos de aqui son los de esquema.json, y nada de PROY_* cambio de lugar
const esquema = JSON.parse(readFileSync(join(raiz, 'esquema.json'), 'utf8'));
const lista = nombre => esquema.listas.find(l => l.nombre === nombre);
const col = (l, c) => lista(l).columnas.find(x => x.nombre === c);
ok('esquema: ERP_Gastos y ERP_Roles fundidos, claves gastos/rolesErp', lista('ERP_Gastos')?.clave === 'gastos' && lista('ERP_Roles')?.clave === 'rolesErp');
ok('esquema: las PROY_* siguen primero y en su orden', esquema.listas.slice(0, 6).map(l => l.nombre).join(',') === 'PROY_Proyectos,PROY_Tareas,PROY_Ligas,PROY_Roles,PROY_Actividad,PROY_Capital');
ok('esquema: estados = los de la app', col('ERP_Gastos', 'Estado').opciones.join(',') === ESTADOS_GASTO.join(','));
ok('esquema: monedas = las de la app', col('ERP_Gastos', 'Moneda').opciones.join(',') === MONEDAS.join(','));
ok('esquema: categorias = las de la app', col('ERP_Gastos', 'Categoria').opciones.join('|') === CATEGORIAS_GASTO.join('|'));
ok('esquema: CFDI = los de la app', col('ERP_Gastos', 'CfdiEstado').opciones.join(',') === CFDI_ESTADOS.join(','));
ok('esquema: rol tesoreria/contabilidad', col('ERP_Roles', 'Rol').opciones.join(',') === 'tesoreria,contabilidad');
ok('esquema: equipos de ERP_Gastos = config.js (mismas claves que PROY_Proyectos.Equipo)', (() => {
    const cfg = readFileSync(join(raiz, 'config.js'), 'utf8');
    return col('ERP_Gastos', 'Equipo').opciones.every(e => cfg.includes(`clave: '${e}'`));
})());
ok('esquema: biblioteca «Gastos» declarada', esquema.bibliotecas?.[0]?.nombre === 'Gastos');
// docs/ vive FUERA de este repo (en el de proyectos): si no esta junto, la comparacion se salta.
const docEsquema = join(raiz, '..', 'docs', 'gastos-esquema.json');
if (existsSync(docEsquema)) ok('esquema: identico a docs/gastos-esquema.json', (() => {
    const g = JSON.parse(readFileSync(docEsquema, 'utf8'));
    return JSON.stringify(g.listas) === JSON.stringify(esquema.listas.slice(-2)) && JSON.stringify(g.bibliotecas) === JSON.stringify(esquema.bibliotecas);
})());
const campos = camposGasto({ fechaIso: '2026-10-01T18:00:00.000Z', monto: '1,234.5', moneda: 'MXN', concepto: ' Casetas ', categoria: 'casetas', equipo: 'CALYTEK', proyectoId: '7', solicitante: 'a@x', capturadoPor: 'a@x', notas: '' });
ok('camposGasto: solo columnas de ERP_Gastos', Object.keys(campos).every(k => lista('ERP_Gastos').columnas.some(c => c.nombre === k)));
ok('camposGasto: valores', campos.Title === 'Casetas' && campos.Monto === 1234.5 && campos.ProyectoId === 7 && campos.Estado === 'registrado' && campos.CfdiEstado === 'sin-cfdi' && !('Notas' in campos));
ok('camposGasto: sin proyecto ni categoria no los manda', (() => { const c = camposGasto({ fechaIso: 'x', monto: '5', moneda: 'USD', concepto: 'a', categoria: '', equipo: 'PITEPEC', proyectoId: '', solicitante: 'b', capturadoPor: 'c', notas: ' fonda ' }); return !('ProyectoId' in c) && !('Categoria' in c) && c.Notas === 'fonda' && c.Moneda === 'USD' && c.CapturadoPor === 'c'; })());
for (const f of [camposReembolso('t@x'), camposRechazo('t@x', 'dup')]) ok('reembolso/rechazo: solo columnas de ERP_Gastos', Object.keys(f).every(k => lista('ERP_Gastos').columnas.some(c => c.nombre === k)));

// --- roles (ERP_Roles) y permisos (decisiones 5 y 7)
const rolesErp = [{ Title: 'Teso@Example.Invalid', Rol: 'tesoreria', Activo: true }, { Title: 'baja@example.invalid', Rol: 'tesoreria', Activo: false }, { Title: 'conta@example.invalid', Rol: 'contabilidad' }, { Title: 'raro@example.invalid', Rol: 'jefe' }];
ok('rolesErp: por correo sin mayusculas', rolesErpDe('teso@example.invalid', rolesErp).has('tesoreria'));
ok('rolesErp: inactivo no cuenta', rolesErpDe('baja@example.invalid', rolesErp).size === 0);
ok('rolesErp: Activo vacio cuenta como activo', rolesErpDe('conta@example.invalid', rolesErp).has('contabilidad'));
ok('rolesErp: rol desconocido no cuenta', rolesErpDe('raro@example.invalid', rolesErp).size === 0);
const T = new Set(['tesoreria']), V = new Set(), C = new Set(['contabilidad']);
ok('registrar: gerencia y colaborador si, lectura no', PUEDE_GASTO.registrar('gerencia', V) && PUEDE_GASTO.registrar('colaborador', V) && !PUEDE_GASTO.registrar('lectura', V));
ok('registrar: tesoreria aunque su rol de proyectos sea lectura', PUEDE_GASTO.registrar('lectura', T));
ok('tesoreria: solo con el rol (ni gerencia ni contabilidad)', PUEDE_GASTO.tesoreria(T) && !PUEDE_GASTO.tesoreria(V) && !PUEDE_GASTO.tesoreria(C) && PUEDE_GASTO.porOtro(T) && !PUEDE_GASTO.porOtro(C));

// --- listas
const G = [
    { id: 1, Solicitante: 'Yo@x', Fecha: '2026-09-01T18:00:00Z', Estado: 'registrado', Monto: 100, Moneda: 'MXN' },
    { id: 2, Solicitante: 'yo@x', Fecha: '2026-09-20T18:00:00Z', Estado: 'reembolsado', Monto: 50.25, Moneda: 'USD', ReembolsadoEl: '2026-09-21T18:00:00Z' },
    { id: 3, Solicitante: 'otra@x', Fecha: '2026-08-31T18:00:00Z', Estado: 'registrado', Monto: 10.1, Moneda: 'MXN', ReembolsadoEl: '2026-09-02T18:00:00Z' },
    { id: 4, Solicitante: 'otra@x', Fecha: '2026-09-01T18:00:00Z', Estado: 'rechazado', Monto: 7, Moneda: 'MXN' },
    { id: 5, Solicitante: 'otra@x', Fecha: '2026-10-01T03:00:00Z', Estado: 'registrado', Monto: 0.2, Moneda: 'MXN' }
];
ok('misGastos: por Solicitante sin mayusculas, el mas reciente primero', misGastos(G, 'YO@x').map(g => g.id).join(',') === '2,1');
ok('porReembolsar: solo registrado, el mas viejo primero', porReembolsar(G).map(g => g.id).join(',') === '3,1,5');
ok('resueltos: reembolsado y rechazado', resueltos(G).map(g => g.id).sort().join(',') === '2,4');
ok('yaReembolsadoAntes: sello lleno y estado distinto', yaReembolsadoAntes(G[2]) && !yaReembolsadoAntes(G[1]) && !yaReembolsadoAntes(G[0]));
ok('mesDe: en hora de Mexico (03:00Z del 1-oct es 30-sep alla)', mesDe(G[4]) === '2026-09');
const tot = totalesPorMes(G);
ok('totales: por mes y moneda, el mes mas reciente primero', tot.map(t => `${t.mes}/${t.moneda}`).join(',') === '2026-09/MXN,2026-09/USD,2026-08/MXN', tot.map(t => `${t.mes}/${t.moneda}`).join(','));
ok('totales: suma por estado sin mezclar monedas', tot[0].registrado === 100.2 && tot[0].rechazado === 7 && tot[0].n === 3 && tot[1].reembolsado === 50.25 && tot[1].registrado === 0);
ok('sumaPorMoneda: centavos exactos', JSON.stringify(sumaPorMoneda([{ Monto: 0.1, Moneda: 'MXN' }, { Monto: 0.2, Moneda: 'MXN' }, { Monto: 1, Moneda: 'USD' }])) === '{"MXN":0.3,"USD":1}');
ok('formatoMonto', formatoMonto(1234.5, 'MXN') === '$1,234.50 MXN' && formatoMonto(0, 'USD') === '$0.00 USD' && formatoMonto(3, 'EUR') === '$3.00 MXN');
ok('etiquetas de estado', etiquetaEstado('registrado').clase === 'warn' && etiquetaEstado('reembolsado').clase === 'ok' && etiquetaEstado('rechazado').clase === 'danger');
ok('CFDI: solo si la columna trae valor', etiquetaCfdi(undefined) === null && etiquetaCfdi('confirmado').texto === 'CFDI ✓' && etiquetaCfdi('propuesto').clase === 'info' && etiquetaCfdi('sin-cfdi').texto === 'Sin CFDI');

// --- comprobante: convencion del _LEEME de «Gastos»
ok('ext: del nombre, jpeg = jpg, o del MIME', extComprobante('IMG_1.JPEG', 'image/jpeg') === 'jpg' && extComprobante('foto', 'image/png') === 'png' && extComprobante('x', 'raro/tipo') === '');
ok('tipo: Ticket (foto) · Factura (PDF) · CFDI (XML) · Otro', tipoComprobante('a.heic', '') === 'Ticket' && tipoComprobante('blob', 'image/webp') === 'Ticket' && tipoComprobante('f.PDF', 'application/pdf') === 'Factura' && tipoComprobante('c.xml', 'text/xml') === 'CFDI' && tipoComprobante('z.zip', '') === 'Otro');
ok('valido: foto o PDF, no vacio, tope de MB', comprobanteValido({ name: 'a.jpg', type: 'image/jpeg', size: 10 }).ok && comprobanteValido({ name: 'b.pdf', type: 'application/pdf', size: 10 }).ok
    && !comprobanteValido({ name: 'c.xml', type: 'text/xml', size: 10 }).ok && !comprobanteValido({ name: 'd.jpg', type: 'image/jpeg', size: 0 }).ok
    && !comprobanteValido({ name: 'e.jpg', type: 'image/jpeg', size: COMPROBANTE_MAX_MB * 1048576 + 1 }).ok && !comprobanteValido(null).ok);
ok('nombre: AAAA-MM-DD_GASTO-<ID>_<Tipo>_<descripcion>.<ext>', nombreComprobante({ dia: '2026-10-01', id: 17, tipo: 'Ticket', concepto: 'Casetas Monterrey–planta (ida)', ext: 'jpg' }) === '2026-10-01_GASTO-17_Ticket_casetas-monterrey-planta-ida.jpg');
ok('nombre: segundo archivo con _2, sin acentos, descripcion de 40 a lo mas', (() => { const s = nombreComprobante({ dia: '2026-10-01', id: 3, tipo: 'Factura', concepto: 'Papelería y engargolado del expediente completo de la LAU', ext: 'pdf', n: 2 }); return s === '2026-10-01_GASTO-3_Factura_papeleria-y-engargolado-del-expediente_2.pdf' && !/[^\x20-\x7e]/.test(s); })());
ok('nombre: concepto sin letras = «gasto»', nombreComprobante({ dia: '2026-10-01', id: 1, tipo: 'Ticket', concepto: '¡¿?!', ext: 'png' }) === '2026-10-01_GASTO-1_Ticket_gasto.png');
ok('ruta: carpeta del mes del gasto', rutaComprobante('2026-09-30', 'x.jpg') === '2026-09/x.jpg');

// --- lo que falta (el boton lo dice) y largos
const base = { dia: '2026-10-01', monto: '850', concepto: 'Gasolina', equipo: 'CALYTEK', notas: '', conComprobante: true, hoy: '2026-10-01' };
ok('falta: nada si esta completo', faltanGasto(base).length === 0);
ok('falta: sin comprobante pide la nota', faltanGasto({ ...base, conComprobante: false }).join() === 'foto o nota' && faltanGasto({ ...base, conComprobante: false, notas: 'fonda' }).length === 0);
ok('falta: monto invalido, concepto, equipo', faltanGasto({ ...base, monto: '0', concepto: ' ', equipo: '' }).join('|') === 'el monto|el concepto|el equipo');
ok('falta: fecha vacia, invalida o futura', faltanGasto({ ...base, dia: '' })[0] === 'la fecha' && faltanGasto({ ...base, dia: '', fechaError: true })[0] === 'una fecha válida' && faltanGasto({ ...base, dia: '2026-10-02' })[0] === 'una fecha que no sea futura');
ok('largo: concepto > 255', largoInvalido({ concepto: 'x'.repeat(256) }) !== '' && largoInvalido({ concepto: 'x'.repeat(255), notas: '' }) === '');
ok('rechazo: motivo recortado a 255 y sin tocar el sello del reembolso', (() => { const r = camposRechazo('t', ' ' + 'm'.repeat(300)); return r.MotivoRechazo.length === 255 && !('ReembolsadoEl' in r) && !('ReembolsadoPor' in r) && r.Estado === 'rechazado'; })());
ok('reembolso: sella quien y cuando', (() => { const r = camposReembolso('t@x', new Date('2026-10-01T12:00:00Z')); return r.Estado === 'reembolsado' && r.ReembolsadoPor === 't@x' && r.ReembolsadoEl === '2026-10-01T12:00:00.000Z'; })());

console.log(`gastos: ok (${n} comprobaciones)`);
