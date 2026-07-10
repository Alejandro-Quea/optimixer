import { RaceSolverBuilder } from './RaceSolverBuilder';
import { GroundCondition, Weather, Season, Time } from './RaceParameters';

function testRun(speed: number, stamina: number, power: number, guts: number, wisdom: number) {
    const builder = new RaceSolverBuilder(1)
        .horse({
            strategy: 'senkou',
            distanceAptitude: 'S', surfaceAptitude: 'A', strategyAptitude: 'A',
            speed, stamina, power, guts, wisdom
        })
        .course(11613)
        .mood(2)
        .ground('Good').weather('Sunny').season('Spring').time('Midday').popularity(1).order(1, 1).numUmas(18)
        .withStaminaSyoubu();
        
    const gen = builder.build();
    let solver = gen.next().value as any;
    
    const dt = 1/15;
    while (solver.pos < builder._course.distance) {
        solver.step(dt);
    }
    console.log(`Speed: ${speed}, Stamina: ${stamina}, Power: ${power}, Guts: ${guts}, Wisdom: ${wisdom} -> Time: ${solver.accumulatetime.t}`);
}

testRun(1500, 1500, 1500, 1500, 1500);
testRun(1, 1, 1, 1, 1);
testRun(1, 18, 19, 23, 3);
