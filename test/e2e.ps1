# Corre la E2E de los 3 roles en Edge headless. Desde PowerShell (no desde Bash: msedge no esta en el PATH).
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\test\e2e.ps1
# ASCII puro a proposito (PS 5.1 lee sin BOM como ANSI).
param([string[]]$Roles = @('gerencia', 'colaborador', 'lectura'))
$app = Split-Path -Parent $PSScriptRoot
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { Write-Host "No esta Edge en $edge"; exit 1 }
# C-01 (v0.90.0): puerto EFIMERO (--puerto 0) y se lee de la primera linea de la salida del servidor, asi dos corridas conviven
# y ninguna mide la app de OTRA sesion. Si el servidor muere o no anuncia puerto en 5 s, exit 2 (antes: 8080 fijo y ocupado).
$log = Join-Path $env:TEMP ("erp-e2e-srv-" + $PID + ".txt")
$srv = Start-Process -FilePath node -ArgumentList "servidor-local.js", "test/pruebas.html", "--puerto", "0" -WorkingDirectory $app -PassThru -WindowStyle Hidden -RedirectStandardOutput $log
$puerto = $null
foreach ($i in 1..25) {
    Start-Sleep -Milliseconds 200
    if ($srv.HasExited) { break }
    if ((Test-Path $log) -and ((Get-Content $log -Raw) -match 'PUERTO (\d+)')) { $puerto = $Matches[1]; break }
}
if (-not $puerto) { Write-Host ('SERVIDOR SIN PUERTO: murio al arrancar o no anuncio "PUERTO n" en 5 s (ver ' + $log + ').'); if (-not $srv.HasExited) { Stop-Process -Id $srv.Id -Force }; exit 2 }
Write-Host "servidor en el puerto $puerto"
$fallas = 0
try {
    foreach ($rol in $Roles) {
        $out = Join-Path $env:TEMP "erp-e2e-$rol.html"
        & $edge --headless=new --disable-gpu --virtual-time-budget=120000 --dump-dom "http://localhost:$puerto/?rol=$rol&refresco=0" 2>$null | Out-File -Encoding utf8 $out
        Start-Sleep -Seconds 1
        $s = Get-Content $out -Raw -Encoding UTF8
        Write-Host "=== $rol"
        if ($s -match 'PRUEBAS TERMINADAS: ([^<]+)') { Write-Host ("  " + $Matches[1]); if ($Matches[1] -notmatch ' 0 falla') { $fallas++ } } else { Write-Host "  SIN RESUMEN (largo $($s.Length))"; $fallas++ }
        [regex]::Matches($s, '\[FALLA\][^\n]*') | ForEach-Object { Write-Host ("  " + $_.Value) }
    }
} finally { Stop-Process -Id $srv.Id -Force }
if ($fallas) { exit 1 }
exit 0
