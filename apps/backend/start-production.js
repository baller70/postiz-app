const { register } = require("tsconfig-paths");
const tsconfig = require("../../tsconfig.base.json");

register({
  baseUrl: __dirname + "/dist",
  paths: tsconfig.compilerOptions.paths,
});

require("./dist/apps/backend/src/main");
