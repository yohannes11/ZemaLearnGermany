// Metro, with one addition: code shared with the website (../web/static/core/js, e.g. the streak tally) is part
// of the app's build, imported as `@shared/…` (Expo resolves the path from tsconfig.json). One file, used by both.
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const shared = path.resolve(__dirname, '../web/static/core/js');

config.watchFolders = [...(config.watchFolders ?? []), shared];

module.exports = config;
