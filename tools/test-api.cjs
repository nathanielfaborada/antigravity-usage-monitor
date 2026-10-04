const path = require('node:path');
const childProcess = require('node:child_process');
for (const method of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) {
  childProcess[method] = () => { throw new Error('Process launch attempted during API refresh'); };
}
const extensionRoot = process.argv[2] || path.resolve(__dirname, '..');
const { fetchSummary } = require(path.join(extensionRoot, 'src/api'));
const { parseUsageOutput } = require(path.join(extensionRoot, 'src/parsers'));
fetchSummary().then(summary => {
  const rows = parseUsageOutput(JSON.stringify(summary));
  console.log(JSON.stringify({
    groups: summary.groups.length, parsedRows: rows.length,
    weekly: rows.filter(row => row.window === 'weekly').length,
    fiveHour: rows.filter(row => row.window === '5h').length
  }));
  if (rows.length === 0) process.exitCode = 1;
}, error => { console.error(error.message); process.exitCode = 1; });
