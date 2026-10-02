// npm run vendor:vigente — S-06 (v0.77.0): ¿el MSAL vendorizado es el ultimo publicado? Va por red, por eso
// NO esta en `npm test`. Sale 0 si coincide, 1 si npm tiene uno mas nuevo, 2 si no pudo preguntar.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const cab = /^\/\*! @azure\/msal-browser v(\d+\.\d+\.\d+) /.exec(readFileSync(join(raiz, 'vendor', 'msal-browser.min.js'), 'utf8'));
if (!cab) { console.log('vendor: sin cabecera de version'); process.exit(2); }
let ultima;
try { ultima = execSync('npm view @azure/msal-browser version', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
catch (_) { console.log(`vendor: ${cab[1]} · npm no contesto (sin red?)`); process.exit(2); }
if (ultima === cab[1]) { console.log(`vendor: ${cab[1]} = npm latest`); process.exit(0); }
console.log(`vendor: ${cab[1]} · npm latest ${ultima} — subir: curl -sL https://cdn.jsdelivr.net/npm/@azure/msal-browser@${ultima}/lib/msal-browser.min.js, fila nueva en vendor/INTEGRIDAD.md y los tres integrity (ver ahi)`);
process.exit(1);
