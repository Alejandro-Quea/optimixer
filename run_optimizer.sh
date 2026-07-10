#!/bin/bash
# Navegar al directorio donde se encuentra este script
cd "$(dirname "$0")"

# Comprobar si pide ayuda
if [ "$1" = "help" ] || [ "$1" = "--help" ]; then
    echo "=========================================="
    echo "   MENÚ DE AYUDA Y PISTAS"
    echo "=========================================="
    cd uma-skill-tools
    npx ts-node tools/help_menu.ts
    exit 0
fi

echo "=========================================="
echo "   INICIANDO OPTIMIZADOR UMALATOR"
echo "=========================================="

# Leer los valores desde el archivo config.txt
if [ -f "config.txt" ]; then
    source config.txt
else
    echo "ERROR: No se encontró el archivo config.txt."
    exit 1
fi

# Construir los argumentos para la línea de comandos
ARGS=""
if [ -n "$COURSE_ID" ]; then ARGS="$ARGS --courseid $COURSE_ID"; fi
if [ -n "$MAX_RATING" ]; then ARGS="$ARGS --max-rating $MAX_RATING"; fi
if [ -n "$LEAGUE" ]; then ARGS="$ARGS --league $LEAGUE"; fi
if [ -n "$MAX_STAT" ]; then ARGS="$ARGS --max-stat $MAX_STAT"; fi
if [ -n "$STRATEGY" ]; then ARGS="$ARGS --strategy $STRATEGY"; fi
if [ -n "$SIM_COUNT" ]; then ARGS="$ARGS --sim-count $SIM_COUNT"; fi
if [ "$WISDOM_CHECKS" = "true" ]; then 
    ARGS="$ARGS --wisdom-checks"
elif [ "$WISDOM_CHECKS" = "false" ]; then 
    ARGS="$ARGS --no-wisdom-checks"
fi
if [ -n "$UMA_ID" ]; then ARGS="$ARGS --uma-id $UMA_ID"; fi
if [ -n "$THREADS" ]; then ARGS="$ARGS --threads $THREADS"; fi
if [ -n "$ITERATIONS" ]; then ARGS="$ARGS --iterations $ITERATIONS"; fi
if [ -n "$DIST_APT" ]; then ARGS="$ARGS --dist-apt $DIST_APT"; fi
if [ -n "$SURF_APT" ]; then ARGS="$ARGS --surf-apt $SURF_APT"; fi
if [ -n "$STRAT_APT" ]; then ARGS="$ARGS --strat-apt $STRAT_APT"; fi
if [ -n "$MOOD" ]; then ARGS="$ARGS --mood $MOOD"; fi
if [ -n "$GROUND" ]; then ARGS="$ARGS --ground $GROUND"; fi
if [ -n "$WEATHER" ]; then ARGS="$ARGS --weather $WEATHER"; fi
if [ -n "$SEASON" ]; then ARGS="$ARGS --season $SEASON"; fi
if [ -n "$TIME" ]; then ARGS="$ARGS --time $TIME"; fi
if [ -n "$POPULARITY" ]; then ARGS="$ARGS --popularity $POPULARITY"; fi

echo "=========================================="

# Moverse a la carpeta del código fuente para usar las dependencias correctas
cd uma-skill-tools

# Ejecutar el optimizador con node/typescript y duplicar la salida en pantalla y archivo
npx ts-node tools/optimizer.ts $ARGS | tee ../resultados.txt

echo "=========================================="
echo "OPTIMIZACIÓN FINALIZADA."
echo "Puedes revisar 'resultados.txt' para ver el resumen."
