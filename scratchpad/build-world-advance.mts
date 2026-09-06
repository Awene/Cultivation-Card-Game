// Default: isolated compilation. --local-status updates only local dist/修仙状态栏.
// Both modes disable schema dump, card sync and publishing.
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const frontend = fileURLToPath(new URL('../../tavern_helper_template-main/', import.meta.url));
process.chdir(frontend);
const require = createRequire(path.join(frontend, 'package.json'));
const webpack = require('webpack');
const factories = (await import('../../tavern_helper_template-main/webpack.config.ts')).default;
const localStatus = process.argv.includes('--local-status');
const configs = factories.map(factory => factory({}, { mode: 'development' }))
  .filter(config => /src[\\/](修仙状态栏|正文美化)[\\/]index\.ts$/.test(String(config.entry)));
if (configs.length !== 2) throw new Error('Expected status and body configs');
if (localStatus) configs.splice(0, configs.length, ...configs.filter(config => String(config.entry).includes('修仙状态栏')));
for (const config of configs) {
  config.mode = 'development';
  config.devtool = false;
  config.output.path = localStatus ? path.join(frontend, 'dist', '修仙状态栏') : fileURLToPath(new URL('./world-advance-build/' + path.basename(path.dirname(String(config.entry))) + '/', import.meta.url));
  config.output.clean = false;
  config.plugins = config.plugins.filter(plugin => !['watch_tavern_helper', 'schema_dump', 'tavern_sync'].includes(plugin?.apply?.name));
}
const compiler = webpack(configs);
compiler.run((error, stats) => {
  console.log(error || stats.toString({ all: false, errors: true, warnings: true, timings: true }));
  compiler.close(() => { process.exitCode = error || stats.hasErrors() ? 1 : 0; });
});
