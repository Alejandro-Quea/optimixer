import { RaceSolver } from './RaceSolver';

export class MultiRaceCoordinator {
    solvers: RaceSolver[];
    distance: number;
    numUmas: number;

    constructor(solvers: RaceSolver[], distance: number) {
        this.solvers = solvers;
        this.distance = distance;
        this.numUmas = solvers.length;
        
        // Initialize state
        for (let i = 0; i < this.solvers.length; i++) {
            this.solvers[i].currentRank = i + 1;
            this.solvers[i].distanceTop = 0;
            this.solvers[i].isOvertaking = false;
            this.solvers[i].isCompeting = false;
            this.solvers[i].distanceDiffRate = 0;
        }
    }

    tick(dt: number): boolean {
        let allFinished = true;
        
        for (const s of this.solvers) {
            if (s.pos < this.distance) {
                // We must save the old pos to check if they were passed
                const oldPos = s.pos;
                s.step(dt);
                if (s.pos >= this.distance) {
                    // Crossed the finish line this tick! Interpolate exact time.
                    const fraction = (this.distance - oldPos) / (s.pos - oldPos);
                    s.accumulatetime.t -= dt * (1 - fraction);
                } else {
                    allFinished = false;
                }
            }
        }

        if (allFinished) return true;

        // Sort by position (furthest first) to determine rankings
        const sorted = [...this.solvers].sort((a, b) => b.pos - a.pos);
        const topPos = sorted[0].pos;

        for (let i = 0; i < sorted.length; i++) {
            const solver = sorted[i];
            const oldRank = solver.currentRank;
            solver.currentRank = i + 1;
            solver.distanceTop = topPos - solver.pos;
            
            // Deterministic overtake (gained rank)
            solver.isOvertaking = solver.currentRank < oldRank;
            
            // Deterministic compete (any horse within 1 meter sideways)
            solver.isCompeting = false;
            if (i > 0 && Math.abs(sorted[i - 1].pos - solver.pos) < 1.0) solver.isCompeting = true;
            if (i < sorted.length - 1 && Math.abs(sorted[i + 1].pos - solver.pos) < 1.0) solver.isCompeting = true;
            
            // Deterministic distance rate to front
            solver.distanceDiffRate = (solver.distanceTop / this.distance) * 100;
        }

        return false;
    }
}
