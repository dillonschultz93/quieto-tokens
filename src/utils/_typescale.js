// A function that generates a type scale based on a modular scale
const scaleUp = (base, ratio, steps) => {
  const typeScale = [];
  for (let i = 0; i <= steps; i++) {
    typeScale.push(Math.round(base * ratio ** i));
  }
  return typeScale;
};

const scaleDown = (base, ratio, steps) => {
  const typeScale = [];
  for (let i = 0; i <= steps; i++) {
    typeScale.push(Math.round(base / ratio ** i));
  }
  return typeScale;
}

module.exports = {
  scaleUp,
  scaleDown
};
