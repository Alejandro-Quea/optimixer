import courses from '../data/course_data.json';
import tracknames from '../data/tracknames.json';

const surfaceNames = { 1: 'Turf (Pasto)', 2: 'Dirt (Tierra)' };
const distTypes = { 1: 'Corta', 2: 'Milla', 3: 'Media', 4: 'Larga' };
const turnNames = { 1: 'Inner (Adentro)', 2: 'Outer (Afuera)', 3: 'Unused', 4: 'Sin Curvas' };

console.log("===============================================================");
console.log("                 PISTAS DISPONIBLES (COURSES)                  ");
console.log("===============================================================");
console.log("ID    | Nombre (Pista)  | Superficie   | Dist | Tipo   | Curva ");
console.log("---------------------------------------------------------------");

for (const id in courses) {
    const course = courses[id];
    const trackId = course.raceTrackId;
    const nameData = tracknames[trackId];
    
    // Fallbacks si la pista no tiene nombre
    const name = nameData ? (nameData[1] || nameData[0]) : "Desconocida";
    
    const surf = surfaceNames[course.surface as keyof typeof surfaceNames] || "???";
    const distT = distTypes[course.distanceType as keyof typeof distTypes] || "???";
    const turn = turnNames[course.turn as keyof typeof turnNames] || "???";
    
    // Ignorar las que son puras pruebas si no tienen nombre
    if (!nameData && id !== '10101') continue;

    console.log(`${id.padEnd(5)} | ${name.padEnd(15)} | ${surf.padEnd(12)} | ${String(course.distance).padEnd(4)} | ${distT.padEnd(6)} | ${turn}`);
}

console.log("===============================================================");
console.log("               CONFIGURACIÓN EN config.txt                     ");
console.log("===============================================================");
console.log("Parámetros ambientales que puedes añadir a tu config.txt:");
console.log("");
console.log("MOOD=random        # Opciones: -2 (Awful), -1 (Bad), 0 (Normal), 1 (Good), 2 (Great), o 'random'");
console.log("GROUND=Good        # Opciones: Firm, Good, Yielding, Soft, Heavy");
console.log("WEATHER=Sunny      # Opciones: Sunny, Cloudy, Rainy, Snowy");
console.log("SEASON=Spring      # Opciones: Spring, Summer, Autumn, Winter");
console.log("TIME=Midday        # Opciones: Morning, Midday, Evening, Night");
console.log("POPULARITY=1       # Popularidad (1 es favorita, mayor es menos popular)");
console.log("");
console.log("Ejemplo de uso:");
console.log("./run_optimizer.sh        -> Corre normalmente leyendo config.txt");
console.log("./run_optimizer.sh help   -> Muestra este menú");

import umas from '../../uma-tools/umas.json';

console.log("");
console.log("===============================================================");
console.log("                       LISTA DE UMAS                           ");
console.log("===============================================================");
console.log("UMA_ID | Nombre de la Umamusume (Variante)");
console.log("---------------------------------------------------------------");
for (const baseId in umas) {
    const uma = umas[baseId as keyof typeof umas] as any;
    const name = uma.name[1] || uma.name[0];
    for (const outfitId in uma.outfits) {
        const outfit = uma.outfits[outfitId];
        const epithet = outfit.epithet || "";
        console.log(`${outfitId} | ${name} ${epithet}`);
    }
}
console.log("===============================================================");
