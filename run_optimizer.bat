@echo off
setlocal EnableDelayedExpansion

cd /d "%~dp0"

if "%~1"=="help" goto show_help
if "%~1"=="--help" goto show_help

echo ==========================================
echo    INICIANDO OPTIMIZADOR UMALATOR
echo ==========================================

if not exist "config.txt" (
    echo ERROR: No se encontro el archivo config.txt.
    exit /b 1
)

:: Leer config.txt ignorando lineas vacias y comentarios
for /f "usebackq tokens=1,* delims==" %%A in ("config.txt") do (
    set "key=%%A"
    set "val=%%B"
    :: Ignorar comentarios
    if "!key:~0,1!" neq "#" (
        if defined val (
            set "!key!=!val!"
        )
    )
)

:: Construir argumentos
set "ARGS="
if defined COURSE_ID set "ARGS=!ARGS! --courseid !COURSE_ID!"
if defined MAX_RATING set "ARGS=!ARGS! --max-rating !MAX_RATING!"
if defined LEAGUE set "ARGS=!ARGS! --league !LEAGUE!"
if defined MAX_STAT set "ARGS=!ARGS! --max-stat !MAX_STAT!"
if defined STRATEGY set "ARGS=!ARGS! --strategy !STRATEGY!"
if defined SIM_COUNT set "ARGS=!ARGS! --sim-count !SIM_COUNT!"

if "%WISDOM_CHECKS%"=="true" (
    set "ARGS=!ARGS! --wisdom-checks"
) else if "%WISDOM_CHECKS%"=="false" (
    set "ARGS=!ARGS! --no-wisdom-checks"
)

if defined UMA_ID set "ARGS=!ARGS! --uma-id !UMA_ID!"
if defined THREADS set "ARGS=!ARGS! --threads !THREADS!"
if defined ITERATIONS set "ARGS=!ARGS! --iterations !ITERATIONS!"
if defined DIST_APT set "ARGS=!ARGS! --dist-apt !DIST_APT!"
if defined SURF_APT set "ARGS=!ARGS! --surf-apt !SURF_APT!"
if defined STRAT_APT set "ARGS=!ARGS! --strat-apt !STRAT_APT!"
if defined MOOD set "ARGS=!ARGS! --mood !MOOD!"
if defined GROUND set "ARGS=!ARGS! --ground !GROUND!"
if defined WEATHER set "ARGS=!ARGS! --weather !WEATHER!"
if defined SEASON set "ARGS=!ARGS! --season !SEASON!"
if defined TIME set "ARGS=!ARGS! --time !TIME!"
if defined POPULARITY set "ARGS=!ARGS! --popularity !POPULARITY!"

echo ==========================================

cd uma-skill-tools

:: Ejecutar optimizador directamente en CMD (sin powershell para evitar bloqueos)
call npx ts-node tools/optimizer.ts !ARGS!

echo ==========================================
echo OPTIMIZACION FINALIZADA.
pause
exit /b 0

:show_help
echo ==========================================
echo    MENU DE AYUDA Y PISTAS
echo ==========================================
cd uma-skill-tools
call npx ts-node tools/help_menu.ts
pause
exit /b 0
