/* eslint-disable import/no-extraneous-dependencies */
const { registerTransforms } = require('@tokens-studio/sd-transforms');
const StyleDictionary = require('style-dictionary');

registerTransforms(StyleDictionary);

// Register custom transforms
// // Append 'px' to fontSizes, lineHeights, letterSpacing, spacing, borderRadius, and borderWidth
StyleDictionary.registerTransform({
  type: 'value',
  name: 'typography/css/px',
  matcher: (prop) => prop.type === 'lineHeights' || prop.type === 'letterSpacing',
  transformer: (prop) => `${prop.value}px`,
});

// Convert font family name to a proper CSS font stack
StyleDictionary.registerTransform({
  type: 'value',
  name: 'typography/css/fontStack',
  matcher: (prop) => prop.type === 'fontFamilies',
  transformer: () => '-apple-system, BlinkMacSystemFont, avenir next, avenir, segoe ui, helvetica neue, helvetica, Cantarell, Ubuntu, roboto, noto, arial, sans-serif',
});

// Build core tokens
const StyleDictionaryExtended = StyleDictionary.extend({
  source: ['src/tokens/core.json', 'src/tokens/components/**/core.json'],
  platforms: {
    'core-css': {
      transformGroup: 'tokens-studio',
      transforms: ['ts/size/px', 'typography/css/px', 'typography/css/fontStack', 'ts/typography/fontWeight', 'name/cti/kebab'],
      buildPath: 'dist/css/',
      files: [{
        destination: '_core.css',
        options: {
          outputReferences: true,
        },
        format: 'css/variables',
      }],
    },
  },
});

// Build light token set
const StyleDictionaryLightSet = StyleDictionary.extend({
  source: ['src/tokens/core.json', 'src/tokens/light.json', 'src/tokens/components/**/light.json'],
  platforms: {
    'light-css': {
      transforms: ['name/cti/kebab'],
      buildPath: 'dist/css/',
      files: [{
        filter: (token) => token.filePath.includes('light.json'),
        destination: '_light.css',
        options: {
          outputReferences: true,
        },
        format: 'css/variables',
      }],
    },
  },
});

// Build dark token set
const StyleDictionaryDarkSet = StyleDictionary.extend({
  source: ['src/tokens/core.json', 'src/tokens/dark.json', 'src/tokens/components/**/dark.json'],
  platforms: {
    'dark-css': {
      transforms: ['name/cti/kebab'],
      buildPath: 'dist/css/',
      files: [{
        filter: (token) => token.filePath.includes('dark.json'),
        destination: '_dark.css',
        options: {
          outputReferences: true,
        },
        format: 'css/variables',
      }],
    },
  },
});

// Clean all platforms
StyleDictionaryExtended.cleanAllPlatforms();
StyleDictionaryLightSet.cleanAllPlatforms();
StyleDictionaryDarkSet.cleanAllPlatforms();

// Build all platforms
StyleDictionaryExtended.buildAllPlatforms();
StyleDictionaryLightSet.buildAllPlatforms();
StyleDictionaryDarkSet.buildAllPlatforms();
