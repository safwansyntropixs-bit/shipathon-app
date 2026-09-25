const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
if (!config.resolver.assetExts.includes('ogg')) {
  config.resolver.assetExts.push('ogg');
}
if (!config.resolver.assetExts.includes('task')) {
  config.resolver.assetExts.push('task', 'tflite');
}

module.exports = withNativeWind(config, { input: "./app/globals.css" });
