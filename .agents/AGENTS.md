
# Reglas de Optimización Umalator

Al modificar o trabajar con el optimizador de Umalator o generar código relacionado a él, SIEMPRE debes aplicar las siguientes restricciones de negocio (Game Mechanics):

1. **Filtrado de Habilidades (Debuffs y Traducidas):** 
   - Jamás permitas que el optimizador seleccione habilidades con `score <= 0`. Son penalizaciones.
   - Sólo utiliza habilidades que posean traducción en el archivo `skillnames.json` (Excluye contenido JP inaccesible en la versión Global).
2. **Jerarquía de Habilidades:** 
   - Jamás asumas que las habilidades son independientes. Utiliza siempre el `groupId` expuesto en `skill_meta.json` para asegurarte de que variaciones (Base/Dorada/Evolución) sean mutuamente exclusivas al equipar.
3. **Mecánicas Probabilísticas (RNG):** 
   - Las simulaciones no son deterministas si se usa la estadística de Wisdom. Se debe usar un arreglo de `sim-count` (Ej. 10 simulaciones promedio) en combinación con `builder.withWisdomChecks(seeds)`.
4. **Oikurabe (Guts Dueling):**
   - El stat de Guts no funcionará correctamente sin un contrincante. SIEMPRE debes inicializar a un caballo espejo o rival (`builder.pacer(...)`) para activar estas mecánicas.

