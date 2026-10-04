const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const commands = new Map();
const config = { backgroundRefresh: false };
let apiRequests = 0;
let apiResponses = [];
let launches = 0;
let capturedOptions;
let interval;
let now = 0;
let responses = [];
const statusBars = [];
const vscode = {
  StatusBarAlignment: { Right: 1 },
  ThemeColor: class {},
  MarkdownString: class { appendMarkdown() {} appendText() {} },
  EventEmitter: class { fire() {} },
  window: {
    createOutputChannel: () => ({ appendLine() {} }),
    createStatusBarItem: () => {
      const item = { show() {} };
      statusBars.push(item);
      return item;
    },
    createTreeView: () => ({})
  },
  workspace: {
    getConfiguration: () => ({ get: (key, fallback) => config[key] ?? fallback }),
    onDidChangeConfiguration: () => ({})
  },
  commands: { registerCommand: (name, fn) => { commands.set(name, fn); return {}; } }
};
const sandbox = {
  module: { exports: {} }, process,
  Date: class extends Date { static now() { return now; } },
  setTimeout: () => 1, clearTimeout() {},
  setInterval: fn => { interval = fn; return 1; }, clearInterval() { interval = undefined; },
  require: name => name === 'vscode' ? vscode : name === 'child_process' ? {
    spawn: (file, args, options) => {
      launches++;
      capturedOptions = options;
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.stdin = { end() {} };
      child.kill = () => {};
      responses.push(() => { child.stderr.emit('data', Buffer.from('Unauthorized')); child.emit('close', 1); });
      return child;
    }
  } : require(name)
};
const modules = new Map();
function loadModule(filename) {
  if (filename.endsWith(`${path.sep}src${path.sep}api.js`)) {
    const query = callback => {
      apiRequests++;
      apiResponses.push((error = new Error('Quota API unavailable (HTTP 401).'), stdout = '') => callback(error, stdout, ''));
    };
    return { executeApiUsageCommand: query, executeApiModelsCommand: query };
  }
  if (modules.has(filename)) return modules.get(filename).exports;
  const module = { exports: {} };
  modules.set(filename, module);
  const context = {
    ...sandbox,
    module,
    require: name => name.startsWith('.')
      ? loadModule(require.resolve(path.resolve(path.dirname(filename), name)))
      : sandbox.require(name)
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return module.exports;
}
const extension = loadModule(require.resolve('../extension.js'));
const context = { subscriptions: [] };
extension.activate(context);
assert.equal(launches, 0, 'Manual mode must not launch CLI on activation');
assert.equal(interval, undefined);
commands.get('antigravity.refreshUsage')();
assert.equal(apiRequests, 2, 'Manual refresh queries API usage and models');
assert.equal(launches, 0, 'API manual refresh must not spawn processes');
commands.get('antigravity.refreshUsage')();
assert.equal(apiRequests, 2, 'Concurrent refreshes must not overlap');
assert.equal(launches, 0);
extension.executeUsageCommand(['agy'], () => {});
assert.equal(capturedOptions.windowsHide, true);
assert.equal(capturedOptions.shell, false);
assert.equal(capturedOptions.detached, false);
assert.equal(capturedOptions.stdio, 'pipe');
for (const disposable of context.subscriptions) disposable.dispose?.();

let calls = [];
const cache = {};
const unsupported = Object.assign(new Error('unknown option --output-format'), { code: 1 });
const run = (file, args, options, callback) => {
  calls.push(args);
  if (args.includes('--output-format')) callback(unsupported, '', '');
  else callback(null, 'usage data', '');
};
extension.executeUsageCommand(['agy'], err => assert.equal(err, null), { run, cache });
assert.equal(calls.length, 2);
calls = [];
extension.executeUsageCommand([cache.file], err => assert.equal(err, null), { run, cache });
assert.equal(calls.length, 1, 'Cached legacy mode must avoid repeated JSON failures');
assert.equal(calls[0].includes('--output-format'), false);
for (const code of [1, 'ETIMEDOUT']) {
  let attempts = 0;
  const error = Object.assign(new Error('Unauthorized or network timeout'), { code });
  extension.executeUsageCommand(['agy', 'other'], err => assert.equal(err, error), {
    run: (file, args, options, callback) => { attempts++; callback(error, '', ''); }
  });
  assert.equal(attempts, 1, 'Operational failures must not relaunch the CLI');
}
let missingAttempts = 0;
extension.executeUsageCommand(['missing', 'agy'], err => assert.equal(err, null), {
  run: (file, args, options, callback) => {
    missingAttempts++;
    callback(file === 'missing' ? Object.assign(new Error('missing'), { code: 'ENOENT' }) : null, 'data', '');
  }
});
assert.equal(missingAttempts, 2, 'Missing binaries must still allow discovery');

config.backgroundRefresh = true;
apiResponses = [];
const backgroundContext = { subscriptions: [] };
extension.activate(backgroundContext);
for (const response of apiResponses.splice(0)) response();
assert.equal(typeof interval, 'function');
const beforeBackoff = apiRequests;
now = 60000;
interval();
assert.equal(apiRequests, beforeBackoff, 'Failure must skip the next polling tick');
now = 120000;
interval();
assert.equal(apiRequests, beforeBackoff + 1, 'Polling must resume after backoff');
for (const response of apiResponses.splice(0)) response();
commands.get('antigravity.refreshUsage')();
assert.equal(apiRequests, beforeBackoff + 3, 'Manual refresh must bypass backoff');
assert.equal(launches, 1, 'API failures must never fall back to a CLI process');
for (const disposable of backgroundContext.subscriptions) disposable.dispose?.();
for (const response of apiResponses.splice(0)) assert.doesNotThrow(response);
config.backgroundRefresh = false;
config.statusBarFormat = 'iconOnly';
const staleContext = { subscriptions: [] };
extension.activate(staleContext);
commands.get('antigravity.refreshUsage')();
const quota = JSON.stringify({ groups: [{ name: 'Gemini Models', buckets: [{ remaining_fraction: 0.8, window: '5h' }] }] });
const successResponses = apiResponses.splice(0);
successResponses[0](null, quota);
successResponses[1]();
const status = statusBars.at(-1);
const previousText = status.text;
commands.get('antigravity.refreshUsage')();
const emptyResponses = apiResponses.splice(0);
emptyResponses[0](null, '{}');
emptyResponses[1]();
assert.equal(status.text, `${previousText} (stale)`, 'Empty responses must preserve previous readings and the configured format');
for (const disposable of staleContext.subscriptions) disposable.dispose?.();
config.usageSource = 'cli';
extension.activate({ subscriptions: [] });
assert.equal(interval, undefined, 'Legacy CLI mode must never poll or run on startup');
console.log('Process regression checks passed: manual startup, concurrency, suppression, retry limits, legacy cache, discovery, backoff and disposal.');
