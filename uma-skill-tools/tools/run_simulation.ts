import * as fs from 'fs';
import { RaceSolver } from '../RaceSolver';
import { RaceSolverBuilder } from '../RaceSolverBuilder';

import skillnames from '../data/skillnames.json';
// Note: skill_meta is in uma-tools, so we need to read it from there:
const skill_meta = JSON.parse(fs.readFileSync('../../uma-tools/skill_meta.json', 'utf-8'));

// read config
const configPath = process.argv[2];
if (!configPath) {
    console.error("Usage: npx ts-node tools/run_simulation.ts <config.json>");
    process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const nsamples = config.nsamples || 10;
const course = config.course;
const horse = config.horse;
const raceParams = config.raceParams;
let rawSkills = config.skills || [];

// Step 1: Filter skills
// 1. Must exist in skillnames.json
// 2. Score must be > 0 in skill_meta
// 3. Mutually exclusive by groupId (highest score wins)

const validSkills = new Map<string, any>(); // groupId -> skillId

for (const skillId of rawSkills) {
    if (!(skillnames as any)[skillId]) {
        console.warn(`[WARN] Skill ${skillId} has no translation in skillnames.json. Excluding.`);
        continue;
    }
    const meta = skill_meta[skillId];
    if (!meta) {
        console.warn(`[WARN] Skill ${skillId} not found in skill_meta.json. Excluding.`);
        continue;
    }
    if (meta.score <= 0) {
        console.warn(`[WARN] Skill ${skillId} has score <= 0. Excluding.`);
        continue;
    }

    const groupId = meta.groupId;
    const existing = validSkills.get(groupId);
    if (existing) {
        const existingMeta = skill_meta[existing];
        if (meta.score > existingMeta.score) {
            validSkills.set(groupId, skillId);
        }
    } else {
        validSkills.set(groupId, skillId);
    }
}

const finalSkills = Array.from(validSkills.values());
console.log(`[INFO] Final skills to simulate: ${finalSkills.join(', ')}`);

const builder = new RaceSolverBuilder(nsamples);

builder.course(course)
       .horse(horse)
       .mood(raceParams.mood)
       .ground(raceParams.ground)
       .weather(raceParams.weather)
       .season(raceParams.season)
       .time(raceParams.time)
       .grade(raceParams.grade)
       .popularity(raceParams.popularity)
       .withAsiwotameru()
       .withStaminaSyoubu();

// Add skills
for (const skillId of finalSkills) {
    builder.addSkill(skillId);
}

// Oikurabe / Guts dueling requires a pacer

// Wisdom checks - creating a seeds map for each skill
const seeds = new Map<string, [number, number]>();
let seedGen = 12345;
for (const skillId of finalSkills) {
    seeds.set(skillId, [seedGen++, 0]);
}
builder.withWisdomChecks(seeds);

console.log("[INFO] Running simulations...");

const results = [];
const generator = builder.build();

const dt = 1/60; // 60 FPS stepping

let it = generator.next();
let i = 0;
while (!it.done) {
    const solver = it.value as RaceSolver;
    // We can also extract solver course safely from builder
    const courseDist = (builder as any)._course.distance;
    
    while (solver.pos < courseDist) {
        solver.step(dt);
    }
    
    results.push({
        simIndex: i,
        time: solver.accumulatetime.t,
        distance: solver.pos
    });
    
    i++;
    it = generator.next(false); // next(false) means don't redo
}

const times = results.map(r => r.time);
const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
const minTime = Math.min(...times);
const maxTime = Math.max(...times);

console.log("\n==== SIMULATION RESULTS ====");
console.log(`Total Simulations: ${nsamples}`);
console.log(`Average Time: ${avgTime.toFixed(4)} s`);
console.log(`Min Time: ${minTime.toFixed(4)} s`);
console.log(`Max Time: ${maxTime.toFixed(4)} s`);

// Write detailed output to JSON
fs.writeFileSync('simulation_results.json', JSON.stringify({
    summary: { avgTime, minTime, maxTime },
    details: results
}, null, 2));

console.log("[INFO] Detailed results saved to simulation_results.json");
