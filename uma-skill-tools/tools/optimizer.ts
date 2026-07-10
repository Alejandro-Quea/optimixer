// @ts-nocheck
import { program, Option } from 'commander';
import * as fs from 'fs';
import { RaceSolverBuilder, buildBaseStats, buildSkillData, Perspective } from '../RaceSolverBuilder';
import { CourseData } from '../CourseData';
import { Region, RegionList } from '../Region';
import { getParser } from '../ConditionParser';
import skills from '../data/skill_data.json';
import skillmeta from '../../uma-tools/skill_meta.json';
import skillnames from '../../uma-tools/umalator-global/skillnames.json';
import { scoreUma } from '../../uma-tools/components/scorecalc';
import { HorseState, DEFAULT_HORSE_STATE, SkillSet, Aptitude } from '../../uma-tools/components/HorseDefTypes';
import { RaceSolver } from '../RaceSolver';
import { ErlangRandomPolicy } from '../ActivationSamplePolicy';

program
	.addOption(new Option('-s, --strategy <strategy>', 'strategy to test skills for')
		.choices(['nige', 'senkou', 'sasi', 'oikomi'])
		.default('senkou')
	)
	.addOption(new Option('-c, --courseid <id>', 'ID of the course to simulate')
		.default(11613)
		.argParser(x => parseInt(x, 10))
	)
	.addOption(new Option('--league <league>', 'League mode (open or ranked)')
		.choices(['open', 'ranked'])
		.default('open')
	)
	.addOption(new Option('-m, --max-rating <rating>', 'maximum rating capacity (C_max) for open league')
		.default(10000)
		.argParser(x => parseInt(x, 10))
	)
	.addOption(new Option('--max-stat <stat>', 'maximum value for each stat')
		.default(1500)
		.argParser(x => parseInt(x, 10))
	)
	.addOption(new Option('--sim-count <count>', 'number of simulations per evaluation').default('20'))
	.addOption(new Option('--wisdom-checks', 'enable skill wisdom checks').default(true))
	.addOption(new Option('--no-wisdom-checks', 'disable skill wisdom checks'))
	.addOption(new Option('--uma-id <id>', 'uma id for character specific skills'))
	.addOption(new Option('--threads <count>', 'number of worker threads').default(2)
		.argParser(x => parseInt(x, 10))
	)
	.addOption(new Option('--iterations <count>', 'simulated annealing iterations').default('50000')
		.argParser(x => parseInt(x, 10))
	)
	.addOption(new Option('--dist-apt <apt>', 'Distance Aptitude').default('S'))
	.addOption(new Option('--surf-apt <apt>', 'Surface Aptitude').default('A'))
	.addOption(new Option('--strat-apt <apt>', 'Strategy Aptitude').default('A'))
    .addOption(new Option('--mood <mood>', 'Mood (-2 to 2, or random)').default('random'))
    .addOption(new Option('--ground <ground>', 'Ground Condition (Good, Yielding, Soft, Heavy)').default('Good'))
    .addOption(new Option('--weather <weather>', 'Weather (Sunny, Cloudy, Rainy, Snowy)').default('Sunny'))
    .addOption(new Option('--season <season>', 'Season (Spring, Summer, Autumn, Winter)').default('Spring'))
    .addOption(new Option('--time <time>', 'Time (Morning, Midday, Evening, Night)').default('Midday'))
    .addOption(new Option('--popularity <pop>', 'Popularity').default(1).argParser(x => parseInt(x, 10)));

program.parse();
const options = program.opts();

const BLACKLIST_ALL = ['910071', '200333', '200343', '202303', '201081', '201561', '105601211'];

let rawAvailableSkills = Object.keys(skills).filter(id => {
    if (BLACKLIST_ALL.indexOf(id) > -1) return false;
    
    // Exclude Native Uniques. The game auto-equips the Uma's own native unique,
    // and equipping other characters' native uniques is strictly illegal.
    if (id.length === 6 && id.startsWith('1')) return false;

    // Exclude the Inherited Unique of the CURRENT Uma (you cannot inherit from yourself).
    if (options.umaId && id.startsWith('9') && id.length === 6) {
        const baseId = id.substring(1, 5);
        const umaBaseId = options.umaId.substring(1, 5);
        if (baseId === umaBaseId) return false;
    }

    const skill = skills[id];
    const meta = skillmeta[id];
    // Exclude negative effects, ensure it has a score > 0, and ensure it has an English name (translated)
    return !skill.alternatives[0].effects.some(ef => ef.type <= 0) && meta && meta.score > 0 && skillnames[id] != null;
});

const parser = getParser();
const validSkills = [];
const courseId = options.courseid;
const testBuilder = new RaceSolverBuilder(1).course(courseId);
const courseData = testBuilder._course;
const wholeCourse = new RegionList();
wholeCourse.push(new Region(0, courseData.distance));

const horseApt = { strategy: options.strategy, distanceAptitude: options.distApt, surfaceAptitude: options.surfApt, strategyAptitude: options.stratApt, speed: 1000, stamina: 1000, power: 1000, guts: 1000, wisdom: 1000 };
const baseStats = buildBaseStats(horseApt, 2);
const moodVal = options.mood === 'random' ? 0 : parseInt(options.mood, 10);

// Determine order bounds based on strategy for accurate skill pre-filtering
let expectedOrderMin = 1;
let expectedOrderMax = 1;
const strat = options.strategy.toLowerCase();
if (strat === 'nige') { expectedOrderMin = 1; expectedOrderMax = 3; }
else if (strat === 'senkou') { expectedOrderMin = 2; expectedOrderMax = 6; }
else if (strat === 'sasi') { expectedOrderMin = 5; expectedOrderMax = 12; }
else if (strat === 'oikomi') { expectedOrderMin = 10; expectedOrderMax = 18; }

const raceParams = { mood: moodVal as any, groundCondition: options.ground as any, weather: options.weather as any, season: options.season as any, time: options.time as any, grade: 'G1' as const, popularity: options.popularity, orderRange: [expectedOrderMin, expectedOrderMax] as [number, number], numUmas: 18 };

for (const id of rawAvailableSkills) {
    try {
        const triggers = buildSkillData(baseStats, raceParams, courseData, wholeCourse, parser, id, Perspective.Self, false);
        if (triggers && triggers.some((t: any) => t.regions.length > 0 && t.regions[0].start < 9999)) {
            validSkills.push(id);
        }
    } catch(e) {
        // Skill broken, ignore
    }
}
rawAvailableSkills = validSkills;

// Group skills by groupId to prevent mutually exclusive skills
const groupMap = new Map<string, string[]>();
for (const id of rawAvailableSkills) {
	const groupId = skillmeta[id]?.groupId;
	if (groupId) {
		if (!groupMap.has(groupId)) groupMap.set(groupId, []);
		groupMap.get(groupId).push(id);
	} else {
		groupMap.set(id, [id]); // use its own ID as group if none exists
	}
}

const skillGroups = Array.from(groupMap.entries()).map(([groupId, ids]) => ({ groupId, skills: ids }));
console.log(`Filtered available skills down to ${rawAvailableSkills.length} safe skills across ${skillGroups.length} groups.`);

const N_GROUPS = skillGroups.length;
const N_SKILLS = rawAvailableSkills.length;
const STAT_LIMIT = options.maxStat;
const C_MAX = options.league === 'open' ? options.maxRating : 999999;
const ITERATIONS = options.iterations; // SA loops

const skillIndexMap = new Map<string, number>();
rawAvailableSkills.forEach((id, idx) => skillIndexMap.set(id, idx));

const skillGroupIndices = skillGroups.map(group => group.skills.map(id => skillIndexMap.get(id)!));
const skillToGroupIdx = new Int32Array(N_SKILLS);
for (let g = 0; g < skillGroupIndices.length; g++) {
    for (const sIdx of skillGroupIndices[g]) {
        skillToGroupIdx[sIdx] = g;
    }
}

// Hyperparameters
const T_0 = 2500.0;
const T_MIN = 0.001;
const ALPHA = Math.pow(T_MIN / T_0, 1.0 / ITERATIONS); // Dynamically calculate cooling based on iterations

const MAX_INHERITANCE_SKILLS = 4;
interface EvalResult { cost: number; avgTime: number; avgRank: number; winRate: number; }
const evaluationCache = new Map<string, EvalResult>();

function getActiveSkills(X: Int32Array): string[] {
    const activeSkills: string[] = [];
    let inheritCount = 0;
    for (let i = 0; i < N_SKILLS; i++) {
        if (X[5 + i] === 1) {
            const skillId = rawAvailableSkills[i];
            if (skillId[0] === '9') {
                if (inheritCount < MAX_INHERITANCE_SKILLS) {
                    inheritCount++;
                    activeSkills.push(skillId);
                }
            } else {
                activeSkills.push(skillId);
            }
        }
    }
    return activeSkills;
}

function getRating(X: Int32Array): number {
    const horseState: HorseState = {
        ...DEFAULT_HORSE_STATE,
        outfitId: options.umaId || '',
        speed: X[0],
        stamina: X[1],
        power: X[2],
        guts: X[3],
        wisdom: X[4],
        strategy: options.strategy.charAt(0).toUpperCase() + options.strategy.slice(1) as any,
        distanceAptitude: options.distApt as Aptitude,
        surfaceAptitude: options.surfApt as Aptitude,
        strategyAptitude: options.stratApt as Aptitude,
        aptitudes: [
            options.distApt, options.distApt, options.distApt, options.distApt,
            options.stratApt, options.stratApt, options.stratApt, options.stratApt,
            options.surfApt, options.surfApt
        ] as Aptitude[],
        skills: SkillSet(getActiveSkills(X)),
    };
    return scoreUma(horseState);
}

const globalWisdomSeeds = new Map<string, [number, number]>();
for (const group of skillGroups) {
    for (const skill of group.skills) {
        globalWisdomSeeds.set(skill, [Math.random() * 0x7fffffff | 0, Math.random() * 0x7fffffff | 0]);
    }
}

const metaFile = options.league === 'open' ? '../data/meta_profiles_open.json' : '../data/meta_profiles_ranked.json';
const metaProfiles = JSON.parse(fs.readFileSync(require('path').join(__dirname, metaFile), 'utf8'));
const { Worker } = require('worker_threads');
import * as os from 'os';
import * as path from 'path';

const numCPUs = options.threads; // User configurable threads
const workers: Worker[] = [];
const workerCallbacks = new Map<number, (val: number) => void>();
let nextMessageId = 0;
let nextWorkerIdx = 0;

for (let i = 0; i < numCPUs; i++) {
    const worker = new Worker(path.join(__dirname, 'optimizer_worker.ts'), {
        workerData: {
            options,
            metaProfiles,
            globalWisdomSeeds: Object.fromEntries(globalWisdomSeeds)
        },
        execArgv: ['-r', 'ts-node/register'] // Ensure TS is executed properly
    });
    worker.on('message', (msg) => {
        const { id, avgTime, avgRank, winRate } = msg;
        if (workerCallbacks.has(id)) {
            workerCallbacks.get(id)!({ avgTime, avgRank, winRate });
            workerCallbacks.delete(id);
        }
    });
    workers.push(worker);
}

function evaluateCost(X: Int32Array): Promise<EvalResult> {
    const stateHash = X.join(',');
    if (evaluationCache.has(stateHash)) {
        return Promise.resolve(evaluationCache.get(stateHash)!);
    }

    const activeSkills = getActiveSkills(X);
    
    return new Promise(resolve => {
        const id = nextMessageId++;
        workerCallbacks.set(id, (res: {avgTime: number, avgRank: number, winRate: number}) => {
            const currentRating = getRating(X);
            // Calibración de Soft Penalty: +1.0 sec per 10 rating points over C_MAX
            const penalty = 0.1 * Math.max(0, currentRating - C_MAX);
            const totalCost = res.avgTime + penalty;
            
            if (totalCost > 1000) {
                console.log("Candidato rechazado. Cost:", totalCost.toFixed(2), "Rating:", currentRating, "Stats:", Array.from(X.slice(0, 5)));
            }
            
            const evalResult = { cost: totalCost, avgTime: res.avgTime, avgRank: res.avgRank, winRate: res.winRate };
            evaluationCache.set(stateHash, evalResult);
            resolve(evalResult);
        });
        
        const worker = workers[nextWorkerIdx];
        nextWorkerIdx = (nextWorkerIdx + 1) % workers.length;
        worker.postMessage({ id, X, activeSkills, simCount: options.simCount });
    });
}

function getMinStatsRequired(strategy: string): number[] {
    const strat = strategy.toLowerCase();
    if (strat === 'nige') return [800, 600, 600, 400, 600];
    if (strat === 'senkou') return [800, 600, 800, 400, 400];
    if (strat === 'sasi') return [800, 600, 800, 400, 400];
    if (strat === 'oikomi') return [800, 600, 1000, 400, 400];
    return [600, 600, 600, 400, 400];
}



function generateValidInitialX(): Int32Array {
    let X = new Int32Array(5 + N_SKILLS);
    for (let i = 0; i < 5; i++) {
        X[i] = 1;
    }
    
    // Sembrado Caótico en la Frontera
    let attempts = 0;
    while (getRating(X) < (C_MAX * 0.95) && attempts < 5000) {
        let randStat = Math.floor(Math.random() * 5);
        let chunk = Math.floor(Math.random() * 100) + 20; // 20 to 119
        if (X[randStat] + chunk <= STAT_LIMIT) {
            X[randStat] += chunk;
            if (getRating(X) > C_MAX) {
                X[randStat] -= chunk;
                // Ajuste fino
                if (X[randStat] + 10 <= STAT_LIMIT) {
                    X[randStat] += 10;
                    if (getRating(X) > C_MAX) {
                        X[randStat] -= 10;
                        break;
                    }
                } else {
                    break;
                }
            }
        }
        attempts++;
    }
    return X;
}

async function runOptimizer() {
    let fs = require('fs');
    fs.writeFileSync('../debug_log.txt', '--- INICIO DE OPTIMIZACIÓN ---\n');
    fs.appendFileSync('../debug_log.txt', '[CHECK] Inicializando optimizador y leyendo opciones...\n');
    fs.appendFileSync('../debug_log.txt', `[CHECK] Worker Threads creados: ${numCPUs}\n`);
    
    let X = generateValidInitialX();
    let currentX = new Int32Array(X);
    
    fs.appendFileSync('../debug_log.txt', '[CHECK] Generando candidato inicial y verificando colisiones...\n');
    
    let currentEval = await evaluateCost(currentX);
    let currentCost = currentEval.cost;
    let bestX = new Int32Array(currentX);
    let bestEval = currentEval;
    
    fs.appendFileSync('../debug_log.txt', '[CHECK] Bucle de Recocido Simulado iniciado. Imprimiendo estadísticas cada 500 iteraciones.\n');
    let T = T_0;
    let stagnationCounter = 0;
    let reheatingLock = 0;

    console.log(`\n==========================================`);
    console.log(`   UMALATOR META OPTIMIZER (18-UMA SIM)`);
    console.log(`==========================================`);
    console.log(`Strategy:  ${options.strategy.toUpperCase()}`);
    console.log(`Aptitudes: Dist: ${options.distApt} | Surf: ${options.surfApt} | Strat: ${options.stratApt}`);
    console.log(`Track:     ${options.ground}, ${options.weather}, ${options.season}, ${options.time}`);
    console.log(`Opponents: 17 Meta Profiles (${options.league.toUpperCase()} LEAGUE)`);
    console.log(`------------------------------------------`);
    console.log(`Starting Simulated Annealing (${ITERATIONS} iterations)`);
    console.log(`Samples per eval: ${options.simCount} | Wisdom Checks: ${options.wisdomChecks}`);
    console.log(`Stats Limit: ${STAT_LIMIT} | Max Rating: ${C_MAX}`);
    console.log(`Initial Evaluated Cost: ${currentCost.toFixed(2)}`);
    console.log(`==========================================\n`);

    for (let iter = 0; iter < ITERATIONS; iter++) {
        if (reheatingLock > 0) reheatingLock--;
        let nextX = new Int32Array(currentX);
        
        const r = Math.random();
        
        let validMutation = false;
        let attempts = 0;
        
        while (!validMutation && attempts < 50) {
            nextX.set(currentX);
            validMutation = true;
            const currentR = getRating(currentX);
            
            // Mutación Libre (Dejamos que la Función de Costo penalice los excesos)
            if (r < 0.6) {
                // Intercambio Crudo de Stats
                const statIncrease = Math.floor(Math.random() * 5);
                const statDecrease = Math.floor(Math.random() * 5);
                
                if (statIncrease !== statDecrease) {
                    const MAX_STEP = 50;
                    const currentStepLimit = Math.max(1, Math.round((T / T_0) * MAX_STEP));
                    const delta = Math.floor(Math.random() * currentStepLimit) + 1;
                    
                    nextX[statIncrease] += delta;
                    nextX[statDecrease] -= delta;
                }
            } else {
                // Intercambio de Habilidades
                const isAdding = Math.random() < 0.5; // 50% chance to add, 50% chance to remove
                
                if (isAdding) {
                    // Añadir habilidad
                    const sIdx = Math.floor(Math.random() * N_SKILLS);
                    if (nextX[5 + sIdx] === 0) {
                        nextX[5 + sIdx] = 1;
                        const gIdx = skillToGroupIdx[sIdx];
                        for (const otherSIdx of skillGroupIndices[gIdx]) {
                            if (otherSIdx !== sIdx) nextX[5 + otherSIdx] = 0;
                        }
                        // Compensación aproximada cruda (-50 a un stat)
                        const statToDecrease = Math.floor(Math.random() * 5);
                        nextX[statToDecrease] -= 50;
                    }
                } else {
                    // Quitar habilidad
                    const activeIndices = [];
                    for (let i = 0; i < N_SKILLS; i++) {
                        if (nextX[5 + i] === 1) activeIndices.push(i);
                    }
                    if (activeIndices.length > 0) {
                        const sIdx = activeIndices[Math.floor(Math.random() * activeIndices.length)];
                        nextX[5 + sIdx] = 0;
                        // Compensación aproximada cruda (+50 a un stat)
                        const statToIncrease = Math.floor(Math.random() * 5);
                        nextX[statToIncrease] += 50;
                    }
                }
            }
            
            // Auditoría Final de Límites
            for (let i = 0; i < 5; i++) {
                if (nextX[i] < 1) nextX[i] = 1;
                if (nextX[i] > STAT_LIMIT) nextX[i] = STAT_LIMIT;
            }
            
            attempts++;
        }
        
        if (!validMutation) continue;
        
        const nextEval = await evaluateCost(nextX);
        const nextCost = nextEval.cost;
        const deltaE = nextCost - currentCost;
        
        const isAccepted = deltaE < 0 || Math.random() < Math.exp(-deltaE / T);
        
        // --- MUTATION STREAM LOGGING ---
        if (iter % 100 === 0) {
            fs.writeFileSync('../mutation_stream.txt', `=== MUTATION STREAM (Iter ${iter} to ${iter + 99}) ===\n`);
        }
        const mutStatus = isAccepted ? '✅ ACCEPTED' : '❌ REJECTED';
        const nRating = getRating(nextX);
        const mutLog = `[Iter ${String(iter).padStart(5)}] ${mutStatus} | Cost: ${nextCost.toFixed(2)} | Rating: ${nRating} | Stats: [${nextX[0]}, ${nextX[1]}, ${nextX[2]}, ${nextX[3]}, ${nextX[4]}] | Skills: ${getActiveSkills(nextX).length}\n`;
        fs.appendFileSync('../mutation_stream.txt', mutLog);
        // -------------------------------
        
        if (isAccepted) {
            currentX.set(nextX);
            currentCost = nextCost;
            currentEval = nextEval;
            if (currentCost < bestEval.cost) {
                bestX.set(currentX);
                bestEval = currentEval;
                stagnationCounter = 0;
            } else {
                stagnationCounter++;
            }
        } else {
            stagnationCounter++;
        }
        
        if (iter % 500 === 0) {
            const currentRating = getRating(bestX);
            // Log to file (Verbose)
            const logLine = `[Iter ${iter}] Best Cost: ${bestEval.cost.toFixed(2)} | Avg Time: ${bestEval.avgTime.toFixed(2)}s | WinRate: ${(bestEval.winRate * 100).toFixed(1)}% | Avg Rank: ${bestEval.avgRank.toFixed(1)} | Rating: ${currentRating} | T: ${T.toFixed(2)}\n` +
                            `  -> Stats: SPD ${bestX[0]} | STA ${bestX[1]} | POW ${bestX[2]} | GUT ${bestX[3]} | WIS ${bestX[4]}\n` +
                            `  -> Skills: ${getActiveSkills(bestX).length}\n`;
            fs.appendFileSync('../debug_log.txt', logLine);
            
            // Clean Terminal UI (Uniform row)
            const iterStr = String(iter).padStart(5, ' ');
            const tempStr = T.toFixed(1).padStart(6, ' ');
            const costStr = bestEval.cost.toFixed(2).padStart(6, ' ');
            const winStr = (bestEval.winRate * 100).toFixed(1).padStart(5, ' ');
            const rankStr = bestEval.avgRank.toFixed(1).padStart(4, ' ');
            const stagStr = String(stagnationCounter).padStart(4, ' ');
            
            console.log(`[Iter ${iterStr}] Temp: ${tempStr} | Cost: ${costStr}s | Win: ${winStr}% | Rank: ${rankStr} | Rating: ${currentRating} | Stagnation: ${stagStr}`);
        }
        
        T = Math.max(T_MIN, T * ALPHA);
        
        if (stagnationCounter > (ITERATIONS * 0.10) && iter <= (ITERATIONS * 0.80) && reheatingLock === 0) {
            T = Math.min(T_0, T * 2.0);
            stagnationCounter = 0;
            reheatingLock = Math.floor(ITERATIONS * 0.10);
        }
    }

    console.log("Optimization finished!");
    console.log(`Optimized Cost: ${bestEval.cost.toFixed(2)} (Time: ${bestEval.avgTime.toFixed(2)}s, Rank: ${bestEval.avgRank.toFixed(1)}, Win: ${(bestEval.winRate*100).toFixed(1)}%)`);
    console.log("Best Stats:");
    console.log(`Speed: ${bestX[0]}, Stamina: ${bestX[1]}, Power: ${bestX[2]}, Guts: ${bestX[3]}, Wisdom: ${bestX[4]}`);
    const finalSkills = getActiveSkills(bestX);
    console.log(`Active Skills: ${finalSkills.length}`);
    console.log("Equipped Skills:", finalSkills.map(id => skillnames[id]?.[0] || id).join(', '));
    
    // Shut down workers
    workers.forEach(w => w.terminate());
}

runOptimizer().catch(console.error);
