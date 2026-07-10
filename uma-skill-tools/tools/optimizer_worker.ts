import { parentPort, workerData } from 'worker_threads';
import * as fs from 'fs';
import * as path from 'path';
import { RaceSolverBuilder } from '../RaceSolverBuilder';
import { RaceSolver } from '../RaceSolver';
import { MultiRaceCoordinator } from '../MultiRaceCoordinator';

const { options, metaProfiles, globalWisdomSeeds } = workerData;

// Convert globalWisdomSeeds object back to Map if needed, or use as is
const wisdomSeedsMap = new Map<string, [number, number]>(Object.entries(globalWisdomSeeds));

parentPort?.on('message', (msg) => {
    const { id, X, activeSkills, simCount } = msg;

    const speed = X[0];
    const stamina = X[1];
    const power = X[2];
    const guts = X[3];
    const wisdom = X[4];

    // Build the 18 horses: 1 candidate (index 0) + 17 meta profiles
    const builders = [];
    
    // Candidate
    const candidateBuilder = new RaceSolverBuilder(simCount)
        .seed(12345)
        .horse({
            strategy: options.strategy,
            distanceAptitude: options.distApt, surfaceAptitude: options.surfApt, strategyAptitude: options.stratApt,
            speed, stamina, power, guts, wisdom
        })
        .course(options.courseid)
        .mood((options.mood === 'random' ? Math.floor(Math.random() * 5) - 2 : parseInt(options.mood, 10)) as any)
        .ground(options.ground).weather(options.weather).season(options.season).time(options.time).popularity(options.popularity).order(1, 1).numUmas(18)
        .withStaminaSyoubu();
    
    if (options.wisdomChecks) {
        candidateBuilder.withWisdomChecks(wisdomSeedsMap);
    }
    
    activeSkills.forEach((skillId: string) => {
        try { candidateBuilder.addSkill(skillId); } catch(e) { console.error(`[Candidate] addSkill error for ${skillId}:`, e); }
    });

    builders.push(candidateBuilder);

    // Meta Profiles
    for (let i = 0; i < metaProfiles.length; i++) {
        const p = metaProfiles[i];
        const pBuilder = new RaceSolverBuilder(simCount)
            .seed(12345 + i + 1)
            .horse({
                strategy: p.strategy,
                distanceAptitude: options.distApt, surfaceAptitude: options.surfApt, strategyAptitude: options.stratApt,
                speed: p.speed, stamina: p.stamina, power: p.power, guts: p.guts, wisdom: p.wisdom
            })
            .course(options.courseid)
            .mood((options.mood === 'random' ? Math.floor(Math.random() * 5) - 2 : parseInt(options.mood, 10)) as any)
            .ground(options.ground).weather(options.weather).season(options.season).time(options.time).popularity(options.popularity).order(1, 1).numUmas(18)
            .withStaminaSyoubu();
            
        if (options.wisdomChecks) {
            pBuilder.withWisdomChecks(wisdomSeedsMap);
        }
        
        p.skills.forEach((skillId: string) => {
            try { pBuilder.addSkill(skillId); } catch(e) { console.error(`[NPC] addSkill error for ${skillId}:`, e); }
        });
        
        builders.push(pBuilder);
    }

    const generators = builders.map(b => b.build());
    let totalTime = 0;
    let validSamples = 0;
    let totalWins = 0;
    let totalRank = 0;

    for (let s = 0; s < simCount; s++) {
        const solvers = [];
        let valid = true;
        for (const gen of generators) {
            try {
                const solver = gen.next().value as RaceSolver;
                if (!solver) valid = false;
                solvers.push(solver);
            } catch (e: any) {
                console.error(e.stack || e);
                process.exit(1);
            }
        }
        
        if (!valid) continue;

        // Course distance
        const distance = builders[0]._course.distance;
        const coordinator = new MultiRaceCoordinator(solvers, distance);

        const dt = 1/15;
        // Watchdog to prevent infinite loop just in case
        let iter = 0;
        while (!coordinator.tick(dt) && iter < 50000) {
            iter++;
        }

        if (iter >= 50000) {
            throw new Error("Timeout de Simulación: Bucle infinito detectado (superó 50000 ticks)");
        }

        const candidateSolver = solvers[0];
        
        let finishTime = candidateSolver.accumulatetime.t;
        
        // Rank logic
        const rankedSolvers = [...solvers].sort((a, b) => {
            const tA = a.pos < distance ? 99999 + (distance - a.pos) : a.accumulatetime.t;
            const tB = b.pos < distance ? 99999 + (distance - b.pos) : b.accumulatetime.t;
            return tA - tB;
        });
        
        const rank = rankedSolvers.indexOf(candidateSolver) + 1;
        if (rank === 1) totalWins++;
        totalRank += rank;
        
        // If the candidate didn't finish (e.g. ran out of stamina and stopped before the finish line)
        if (candidateSolver.pos < distance) {
            // Inflate cost heavily based on remaining distance to severely penalize out-of-stamina builds
            const missingDistance = distance - candidateSolver.pos;
            // Base time up to that point + harsh penalty for not finishing (e.g. 5 seconds per missing meter)
            finishTime += (missingDistance * 5.0); 
        }

        if (isNaN(finishTime)) {
            throw new Error("finishTime es NaN");
        }
        
        totalTime += finishTime;
        validSamples++;
    }

    const avgTime = validSamples > 0 ? totalTime / validSamples : 999999;
    const avgRank = validSamples > 0 ? totalRank / validSamples : 18;
    const winRate = validSamples > 0 ? totalWins / validSamples : 0;
    parentPort?.postMessage({ id, avgTime, avgRank, winRate });
});
