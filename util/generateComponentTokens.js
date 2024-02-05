const fs = require('fs');
const templates = require('./templates');

const COMPONENT_NAME = process.argv[2];

// Check if there is a component name supplied as an argument
if (!COMPONENT_NAME) {
  console.error('Please provide a component name');
  process.exit(1);
}

console.log(`Creating boilerplate token files for the ${COMPONENT_NAME} component...`);

// Create the component directory
const COMPONENT_DIRECTORY = `./src/tokens/components/${COMPONENT_NAME}`;

// Check if the component directory already exists
if (fs.existsSync(COMPONENT_DIRECTORY)) {
  console.error(`The component directory ${COMPONENT_DIRECTORY} already exists`);
  process.exit(1);
}

// Create the component directory
fs.mkdirSync(COMPONENT_DIRECTORY);

const GENERATED_FILES = templates.map((template) => template(COMPONENT_NAME));

// Create the token files
GENERATED_FILES.forEach((file) => {
  fs.writeFileSync(`${COMPONENT_DIRECTORY}/${COMPONENT_NAME}.${file.extension}`, file.content);
});

console.log(`Boilerplate token files created for the ${COMPONENT_NAME} component ✅`);
