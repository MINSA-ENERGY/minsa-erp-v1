// ERP v0.8.0 — los colores de tarjeta (COLORES de reglas.js, la misma clave que guarda Proyectos en PROY_Tareas.Color) salen de la
// paleta ya declarada en estilo.css: cada clave tiene su token --tono-<clave> y su regla [data-tono="<clave>"], y ningun token de
// tono trae un color literal (#hex, rgb, hsl): solo var(...) o color-mix de var(...). La paleta es decision de Carlos
// (marca/minsa-design/ui/deuda-declarada.txt): esta prueba impide meter un color nuevo por la puerta de los tonos.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COLORES } from '../reglas.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(raiz, 'estilo.css'), 'utf8');
let n = 0, fallas = 0;
const ok = (nombre, cond, detalle = '') => { n++; if (!cond) { fallas++; console.error('FALLA: ' + nombre + (detalle ? ' — ' + detalle : '')); } };

const defs = new Map();
for (const m of css.matchAll(/--tono-([a-z]+)\s*:\s*([^;]+);/g)) defs.set(m[1], (defs.get(m[1]) || []).concat(m[2].trim()));
for (const { clave } of COLORES) {
    ok(`--tono-${clave} esta definido`, defs.has(clave));
    ok(`[data-tono="${clave}"] tiene regla`, css.includes(`[data-tono="${clave}"] { --tono: var(--tono-${clave}); }`));
}
ok('no hay tonos fuera de COLORES', [...defs.keys()].every(k => COLORES.some(c => c.clave === k)), [...defs.keys()].join(','));
for (const [k, vs] of defs) for (const v of vs) {
    const sinVars = v.replace(/var\(--[a-z0-9-]+\)/g, '').replace(/color-mix\(in srgb,|\d+%|[\s,()]/g, '');
    ok(`--tono-${k} solo usa tokens (sin color literal)`, sinVars === '', v);
}
ok('las 8 claves', COLORES.length === 8);
if (fallas) { console.error(`tonos: ${fallas} falla(s) de ${n}`); process.exit(1); }
console.log(`tonos: ok (${n} comprobaciones)`);
