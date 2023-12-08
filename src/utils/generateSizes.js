const typescale = require('./_typescale.js');

const upperScale = typescale.scaleUp(14, 1.12, 15);
const lowerScale = typescale.scaleDown(14, 1.12, 2);

const rawScale = upperScale.concat(lowerScale);

//Remove duplicates in the array and sort
const scale = [...new Set(rawScale)].sort((a, b) => a - b);

console.log(scale);
