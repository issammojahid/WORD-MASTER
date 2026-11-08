const { getDefaultConfig } = require("expo/metro-config");
const {realpathSync}=require('node:fs');
const path=require('node:path');

const config = getDefaultConfig(__dirname);
const dependencies=realpathSync(path.join(__dirname,'node_modules'));
if(dependencies!==path.join(__dirname,'node_modules'))config.watchFolders=[...(config.watchFolders??[]),dependencies];

module.exports = config;
