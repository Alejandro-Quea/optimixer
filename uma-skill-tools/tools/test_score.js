const { scoreUma } = require('../../uma-tools/components/scorecalc');
const { DEFAULT_HORSE_STATE, SkillSet } = require('../../uma-tools/components/HorseDefTypes');
const state = {
    ...DEFAULT_HORSE_STATE,
    speed: 1475, stamina: 380, power: 1005, guts: 1085, wisdom: 1064,
    skills: SkillSet([])
};
console.log("Stats only:", scoreUma(state));
