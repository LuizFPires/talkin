// Metro em monorepo pnpm: observa a raiz do repo e resolve os node_modules do
// app e da raiz, para que os pacotes workspace (@talkin/core, @talkin/capture,
// que exportam TS do src/) sejam transpilados e empacotados no build.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = config;
