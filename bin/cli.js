#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const command = process.argv[2];
const targetDir = process.argv[3] || process.cwd();

if (command === 'install') {
  const skillsDir = path.join(targetDir, '.claude', 'skills');
  const pkgRoot = path.resolve(__dirname, '..');

  const entries = fs.readdirSync(pkgRoot, { withFileTypes: true });
  const skills = entries
    .filter(e => e.isDirectory() && e.name.startsWith('design-token-'))
    .map(e => e.name);

  fs.mkdirSync(skillsDir, { recursive: true });

  for (const skill of skills) {
    const src = path.join(pkgRoot, skill);
    const dest = path.join(skillsDir, skill);
    fs.cpSync(src, dest, { recursive: true });
    console.log(`  installed ${skill}`);
  }

  console.log(`\nInstalled ${skills.length} skills to ${skillsDir}/`);
} else {
  console.log('Usage: npx quieto-skills install [target-dir]');
}
