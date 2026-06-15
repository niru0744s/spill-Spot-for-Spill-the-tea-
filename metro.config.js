const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// Exclude backend directory from Metro's file scanning/bundling
config.resolver.blockList = [
  /[\\/]backend[\\/]/,
].concat(config.resolver.blockList || []);

module.exports = config;
