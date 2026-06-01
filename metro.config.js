const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Configure watchman to ignore non-existent directories
config.watchman = {
  enabled: true,
};

// Ensure proper project roots
if (!config.projectRoot) {
  config.projectRoot = __dirname;
}

module.exports = config;
