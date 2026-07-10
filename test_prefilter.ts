import { RaceSolverBuilder, buildBaseStats, buildSkillData, Perspective } from '../uma-skill-tools/RaceSolverBuilder';
import { Region, RegionList } from '../uma-skill-tools/Region';
import { getParser } from '../uma-skill-tools/ConditionParser';
import skillnames from '../uma-tools/umalator-global/skillnames.json';

const testBuilder = new RaceSolverBuilder(1)
    .horse({ strategy: 'Nige', distanceAptitude: 'S', surfaceAptitude: 'A', strategyAptitude: 'A', speed: 1000, stamina: 1000, power: 1000, guts: 1000, wisdom: 1000 })
    .course(11613) // nakayama 1600 turf? wait 11613 is usually something.
    .mood(2).ground('Good').weather('Sunny').season('Spring').time('Midday').popularity(1).order(1, 1).numUmas(18);

const parser = getParser();
const courseData = testBuilder._course;
const wholeCourse = new RegionList();
wholeCourse.push(new Region(0, courseData.distance));
const baseStats = buildBaseStats(testBuilder._horse, 2);

const testSkills = ['200011', '201651', '201661', '101001211'];
// 200011 is distance_type==1
// let's see which pass
for (const id of testSkills) {
    if (!skillnames[id]) continue;
    try {
        const triggers = buildSkillData(baseStats, testBuilder._raceParams, courseData, wholeCourse, parser, id, Perspective.Self, false);
        const valid = triggers && triggers.some(t => t.regions.length > 0 && t.regions[0].start < 9999);
        console.log(`Skill ${skillnames[id][0]} (${id}): valid = ${valid}`);
    } catch(e) {
        console.log(`Skill ${id} threw: ${e.message}`);
    }
}
