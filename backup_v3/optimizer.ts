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
	.addOption(new Option('-m, --max-rating <rating>', 'maximum rating capacity (C_max)')
		.default(20000)
		.argParser(x => parseInt(x, 10))
	)
	.addOption(new Option('--max-stat <stat>', 'maximum value for each stat')
		.default(1500)
		.argParser(x => parseInt(x, 10))
	)
	.addOption(new Option('--sim-count <count>', 'number of simulations to average per evaluation')
		.default(10)
		.argParser(x => parseInt(x, 10))
	)
	.addOption(new Option('--uma-id <id>', 'ID of the Uma (e.g., 110801 for Duramente)').default(''))
	.addOption(new Option('--wisdom-checks', 'enable wisdom checks for skill activation failures').default(true))
	.addOption(new Option('--no-wisdom-checks', 'disable wisdom checks'))
	.addOption(new Option('--pacer-strategy <strategy>', 'strategy of the rival pacer horse, defaults to mirror current').default('mirror'))
	.addOption(new Option('--iterations <count>', 'number of SA iterations')
		.default(50000)
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
const C_MAX = options.maxRating;
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
const evaluationCache = new Map<string, number>();

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

function evaluateCost(X: Int32Array): number {
    const stateHash = X.join(',');
    
    if (evaluationCache.has(stateHash)) {
        return evaluationCache.get(stateHash)!;
    }

    const speed = X[0];
    const stamina = X[1];
    const power = X[2];
    const guts = X[3];
    const wisdom = X[4];
    
    const activeSkills = getActiveSkills(X);
    
    const pacerStrat = options.pacerStrategy === 'mirror' ? options.strategy : options.pacerStrategy;
    
    const builder = new RaceSolverBuilder(options.simCount)
        .seed(12345) // Seed fijo para que la evaluación sea determinista en cada iteración
        .horse({
            strategy: options.strategy,
            distanceAptitude: options.distApt, surfaceAptitude: options.surfApt, strategyAptitude: options.stratApt,
            speed, stamina, power, guts, wisdom
        })
        .pacer({
            strategy: pacerStrat,
            distanceAptitude: options.distApt, surfaceAptitude: options.surfApt, strategyAptitude: options.stratApt,
            speed, stamina, power, guts, wisdom
        })
        .course(options.courseid)
        .mood(options.mood === 'random' ? Math.floor(Math.random() * 5) - 2 : parseInt(options.mood, 10))
        .ground(options.ground).weather(options.weather).season(options.season).time(options.time).popularity(options.popularity).order(1, 1).numUmas(18)
        .withStaminaSyoubu();
    
    if (options.wisdomChecks) {
        builder.withWisdomChecks(globalWisdomSeeds);
    }
    
    activeSkills.forEach(id => {
        try { builder.addSkill(id); } catch(e) {}
    });
    
    const gen = builder.build();
    let totalTime = 0;
    let validSamples = 0;
    
    for (let s = 0; s < options.simCount; s++) {
        let solver;
        try {
            solver = gen.next().value as RaceSolver;
        } catch(e) {
            if (Math.random() < 0.001) console.error(e);
            continue;
        }
        if (!solver) continue;
        
        const dt = 1/15;
        while (solver.pos < builder._course.distance) {
            solver.step(dt);
        }
        totalTime += solver.accumulatetime.t;
        validSamples++;
    }
    
    if (validSamples === 0) {
        evaluationCache.set(stateHash, 999999);
        return 999999;
    }
    
    const totalTimeAvg = totalTime / validSamples;
    evaluationCache.set(stateHash, totalTimeAvg);
    return totalTimeAvg;
}

function getMinStatsRequired(strategy: string): number[] {
    const strat = strategy.toLowerCase();
    if (strat === 'nige') return [800, 600, 600, 400, 600];
    if (strat === 'senkou') return [800, 600, 800, 400, 400];
    if (strat === 'sasi') return [800, 600, 800, 400, 400];
    if (strat === 'oikomi') return [800, 600, 1000, 400, 400];
    return [600, 600, 600, 400, 400];
}

function getStatSacrificeOrder(strategy: string): number[] {
    const strat = strategy.toLowerCase();
    if (strat === 'nige') return [3, 1, 2, 4, 0];
    if (strat === 'senkou') return [3, 4, 1, 2, 0];
    if (strat === 'sasi') return [3, 4, 1, 0, 2];
    if (strat === 'oikomi') return [3, 4, 1, 0, 2];
    return [3, 4, 1, 2, 0];
}

function generateValidInitialX(): Int32Array {
    let X = new Int32Array(5 + N_SKILLS); // By default all skills are 0 (inactive)
    const minStats = getMinStatsRequired(options.strategy);
    for (let i = 0; i < 5; i++) {
        X[i] = minStats[i];
    }
    
    // Boundary Seeding: Subir stats hasta alcanzar el 95% del límite
    let attempts = 0;
    while (getRating(X) < (C_MAX * 0.95) && attempts < 1000) {
        let randStat = Math.floor(Math.random() * 5);
        X[randStat] = Math.min(STAT_LIMIT, X[randStat] + 20);
        attempts++;
    }
    
    // Paired repair just in case it overshoots
    let currentRating = getRating(X);
    const statSacrificeOrder = getStatSacrificeOrder(options.strategy);
    while (currentRating > C_MAX) {
        let repaired = false;
        for (let statIdx of statSacrificeOrder) {
            if (X[statIdx] - 15 >= minStats[statIdx]) {
                X[statIdx] -= 15;
                repaired = true;
                break;
            }
        }
        if (!repaired) break;
        currentRating = getRating(X);
    }
    return X;
}

let currentX = generateValidInitialX();
let currentCost = evaluateCost(currentX);
let bestX = new Int32Array(currentX);
let bestCost = currentCost;
let T = T_0;
let stagnationCounter = 0;
let reheatingLock = 0;

console.log(`Starting Simulated Annealing with SimCount=${options.simCount} and WisdomChecks=${options.wisdomChecks}...`);
console.log(`Stats limit: ${STAT_LIMIT}, Max Rating: ${C_MAX}, Initial Cost: ${currentCost.toFixed(2)}`);

const loopMinStats = getMinStatsRequired(options.strategy);

for (let iter = 0; iter < ITERATIONS; iter++) {
    if (reheatingLock > 0) reheatingLock--;
    let nextX = new Int32Array(currentX);
    
    const mutateSkill = Math.random() > 0.5;
    let validMutation = true;
    
    if (!mutateSkill) {
        // Mutate stats
        const statIdx = Math.floor(Math.random() * 5);
        const MAX_STEP = 50;
        const currentStepLimit = Math.max(1, Math.round((T / T_0) * MAX_STEP));
        const delta = Math.floor(Math.random() * (currentStepLimit * 2 + 1)) - currentStepLimit;
        
        const oldVal = nextX[statIdx];
        nextX[statIdx] = Math.max(loopMinStats[statIdx], Math.min(STAT_LIMIT, nextX[statIdx] + delta));
        
        if (nextX[statIdx] !== oldVal) {
            let currentRating = getRating(nextX);
            const statSacrificeOrder = getStatSacrificeOrder(options.strategy);
            while (currentRating > C_MAX) {
                let repaired = false;
                for (let sacrificeIdx of statSacrificeOrder) {
                    if (sacrificeIdx !== statIdx && nextX[sacrificeIdx] - 15 >= loopMinStats[sacrificeIdx]) {
                        nextX[sacrificeIdx] -= 15;
                        repaired = true;
                        break;
                    }
                }
                if (!repaired) {
                    // Try removing a random skill to afford the stat
                    const activeSkills = [];
                    for(let i = 0; i < N_SKILLS; i++) {
                        if (nextX[5 + i] === 1) activeSkills.push(i);
                    }
                    if (activeSkills.length > 0) {
                        const dropIdx = activeSkills[Math.floor(Math.random() * activeSkills.length)];
                        nextX[5 + dropIdx] = 0;
                        repaired = true;
                    }
                }
                if (!repaired) { validMutation = false; break; }
                currentRating = getRating(nextX);
            }
        }
    } else {
        // Mutate a skill (binary toggle)
        const sIdx = Math.floor(Math.random() * N_SKILLS);
        
        if (nextX[5 + sIdx] === 0) {
            // Turning ON a skill
            nextX[5 + sIdx] = 1;
            // Enforce zero duplicates by turning OFF other skills in the same group
            const gIdx = skillToGroupIdx[sIdx];
            for (const otherSIdx of skillGroupIndices[gIdx]) {
                if (otherSIdx !== sIdx) nextX[5 + otherSIdx] = 0;
            }
            
            // This costs rating. We must reduce stats to afford it.
            let currentRating = getRating(nextX);
            const statSacrificeOrder = getStatSacrificeOrder(options.strategy);
            while (currentRating > C_MAX) {
                let repaired = false;
                for (let statIdx of statSacrificeOrder) {
                    if (nextX[statIdx] - 15 >= loopMinStats[statIdx]) {
                        nextX[statIdx] -= 15;
                        repaired = true;
                        break;
                    }
                }
                if (!repaired) {
                    validMutation = false;
                    break;
                }
                currentRating = getRating(nextX);
            }
        } else {
            // Turning OFF a skill
            nextX[5 + sIdx] = 0;
            
            // Reinvest freed up rating into stats up to STAT_LIMIT
            let currentRating = getRating(nextX);
            const statSacrificeOrder = getStatSacrificeOrder(options.strategy);
            const priorityOrder = [...statSacrificeOrder].reverse();
            
            let spaceLeft = true;
            while (spaceLeft) {
                let invested = false;
                for (let statIdx of priorityOrder) {
                    if (nextX[statIdx] + 15 <= STAT_LIMIT) {
                        nextX[statIdx] += 15;
                        if (getRating(nextX) > C_MAX) {
                            nextX[statIdx] -= 15; // Overshot, revert and try next
                        } else {
                            invested = true;
                            break; // Successfully invested 15 points, recalculate
                        }
                    }
                }
                if (!invested) spaceLeft = false; // Could not invest more
            }
        }
    }
    
    if (!validMutation) continue;
    
    const nextCost = evaluateCost(nextX);
    const deltaE = nextCost - currentCost;
    
    if (deltaE < 0 || Math.random() < Math.exp(-deltaE / T)) {
        currentX.set(nextX);
        currentCost = nextCost;
        if (currentCost < bestCost) {
            bestX.set(currentX);
            bestCost = currentCost;
            stagnationCounter = 0;
        } else {
            stagnationCounter++;
        }
    } else {
        stagnationCounter++;
    }
    
    T = Math.max(T_MIN, T * ALPHA);
    
    // Reheating
    if (stagnationCounter > (ITERATIONS * 0.10) && iter <= (ITERATIONS * 0.80) && reheatingLock === 0) {
        T = Math.min(T_0, T * 2.0);
        stagnationCounter = 0;
        reheatingLock = Math.floor(ITERATIONS * 0.10);
    }
    
    if (iter % Math.floor(ITERATIONS / 40) === 0) {
        console.log(`Iteration ${iter}, Temp: ${T.toFixed(4)}, Best Cost: ${bestCost.toFixed(2)}, Stagnation: ${stagnationCounter}, Lock: ${reheatingLock}`);
    }
}

console.log("Optimization finished!");
console.log(`Best Cost (Time + Penalty): ${bestCost.toFixed(2)}`);
console.log("Best Stats:");
console.log(`Speed: ${bestX[0]}, Stamina: ${bestX[1]}, Power: ${bestX[2]}, Guts: ${bestX[3]}, Wisdom: ${bestX[4]}`);
const finalSkills = getActiveSkills(bestX);
console.log(`Active Skills: ${finalSkills.length}`);
console.log("Equipped Skills:", finalSkills.map(id => skillnames[id]?.[0] || id).join(', '));

const finalHorseState: HorseState = {
    ...DEFAULT_HORSE_STATE,
    outfitId: options.umaId || '',
    speed: bestX[0], stamina: bestX[1], power: bestX[2], guts: bestX[3], wisdom: bestX[4],
    strategy: options.strategy.charAt(0).toUpperCase() + options.strategy.slice(1) as any,
    skills: SkillSet(finalSkills),
};
console.log(`Final Rating: ${scoreUma(finalHorseState)}`);
