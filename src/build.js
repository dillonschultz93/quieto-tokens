/* eslint-disable import/no-extraneous-dependencies */
const { registerTransforms } = require('@tokens-studio/sd-transforms');
const StyleDictionary = require('style-dictionary');

// Register Tokens Studio transforms
registerTransforms(StyleDictionary);

// Register custom transforms
// Append 'px' to fontSizes, lineHeights, letterSpacing, spacing, borderRadius, and borderWidth
StyleDictionary.registerTransform({
  type: 'value',
  name: 'typography/css/px',
  matcher: (prop) => prop.type === 'fontSizes' || prop.type === 'lineHeights' || prop.type === 'letterSpacing' || prop.type === 'spacing' || prop.type === 'borderRadius' || prop.type === 'borderWidth',
  transformer: (prop) => `${prop.value}px`,
});

// Convert font family name to a proper CSS font stack
StyleDictionary.registerTransform({
  type: 'value',
  name: 'typography/css/fontStack',
  matcher: (prop) => prop.type === 'fontFamilies',
  transformer: () => '-apple-system, BlinkMacSystemFont, avenir next, avenir, segoe ui, helvetica neue, helvetica, Cantarell, Ubuntu, roboto, noto, arial, sans-serif',
});

// Convert font weight to a proper CSS font weight
StyleDictionary.registerTransform({
  type: 'value',
  name: 'typography/css/fontWeight',
  matcher: (prop) => prop.type === 'fontWeights',
  transformer: (prop) => {
    switch (prop.value) {
      case 'Light':
        return '300';
      case 'Regular':
        return '400';
      case 'Medium':
        return '500';
      case 'Bold':
        return '700';
      default:
        return prop.value;
    }
  },
});

// Build core tokens
const StyleDictionaryExtended = StyleDictionary.extend({
  source: ['src/tokens/core.json'],
  platforms: {
    css: {
      transformGroup: 'tokens-studio',
      transforms: ['typography/css/px', 'typography/css/fontStack', 'typography/css/fontWeight', 'name/cti/kebab'],
      buildPath: 'dist/css/',
      files: [{
        destination: '_core-variables.css',
        format: 'css/variables',
      }],
    },
  },
});

// Build core light token set
const StyleDictionaryLightSet = StyleDictionary.extend({
  source: ['src/tokens/core.json', 'src/tokens/light.json'],
  platforms: {
    css: {
      transforms: ['name/cti/kebab'],
      buildPath: 'dist/css/',
      files: [{
        filter: (token) => token.filePath.includes('light.json'),
        destination: '_light-variables.css',
        format: 'css/variables',
      }],
    },
  },
});

// Build core dark token set
const StyleDictionaryDarkSet = StyleDictionary.extend({
  source: ['src/tokens/core.json', 'src/tokens/dark.json'],
  platforms: {
    css: {
      transforms: ['name/cti/kebab'],
      buildPath: 'dist/css/',
      files: [{
        filter: (token) => token.filePath.includes('dark.json'),
        destination: '_dark-variables.css',
        format: 'css/variables',
      }],
    },
  },
});

StyleDictionaryExtended.cleanAllPlatforms();
StyleDictionaryExtended.buildAllPlatforms();
StyleDictionaryLightSet.cleanAllPlatforms();
StyleDictionaryLightSet.buildAllPlatforms();
StyleDictionaryDarkSet.cleanAllPlatforms();
StyleDictionaryDarkSet.buildAllPlatforms();
