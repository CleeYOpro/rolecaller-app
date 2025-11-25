/**
 * Metro config to support .wasm assets used by expo-sqlite web worker.
 * This avoids bundling errors where the wasm file can't be resolved.
 */
const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure .wasm is treated as an asset
if (config.resolver && Array.isArray(config.resolver.assetExts)) {
  if (!config.resolver.assetExts.includes('wasm')) {
    config.resolver.assetExts.push('wasm');
  }
}

module.exports = config;
