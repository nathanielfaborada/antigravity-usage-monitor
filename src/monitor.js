const vscode = require('vscode');
const { log, getOutputChannel } = require('./logger');
const { getCliCandidates, executeUsageCommand, executeModelsCommand } = require('./cli');
const { parseUsageOutput, parseModelsOutput } = require('./parsers');
const { executeApiUsageCommand, executeApiModelsCommand } = require('./api');
const { formatStatusBarText, updateStatusBarVisuals } = require('./ui/statusBar');
const { checkCriticalAlerts } = require('./alerts');
const { QuotaTreeDataProvider } = require('./ui/treeView');
const { showDetails } = require('./ui/dashboard');
const { createUsageTooltip } = require('./ui/tooltip');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  log('Antigravity Usage Monitor extension activated');

  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );

  statusBarItem.name = 'Antigravity Usage';
  statusBarItem.accessibilityInformation = { label: 'Antigravity Usage Quota Monitor' };
  statusBarItem.text = '$(sync~spin) Ag: Checking...';
  statusBarItem.tooltip = 'Click to show Antigravity quota dashboard';
  statusBarItem.command = 'antigravity.showDetails';
  statusBarItem.show();

  const treeDataProvider = new QuotaTreeDataProvider();
  const treeView = vscode.window.createTreeView('antigravity.quotaView', {
    treeDataProvider
  });

  const state = {
    isFetching: false,
    isFetchingModels: false,
    failures: 0,
    nextFetchAt: 0,
    disposed: false,
    cliCache: {},
    timer: null,
    lastParsedRows: [],
    lastModels: [],
    lastUpdated: null,
    alertedKeys: new Set()
  };

  function updateStatusBarDisplay() {
    if (!state.lastParsedRows || state.lastParsedRows.length === 0) return;
    const format = vscode.workspace.getConfiguration('antigravity').get('statusBarFormat', 'compact');
    const criticalThreshold = vscode.workspace.getConfiguration('antigravity').get('criticalThreshold', 20);
    statusBarItem.text = formatStatusBarText(state.lastParsedRows, format);
    const minPercent = Math.min(...state.lastParsedRows.map(r => r.percent));
    updateStatusBarVisuals(statusBarItem, minPercent, criticalThreshold);
  }

  function fetchModelsList() {
    if (state.disposed || state.isFetchingModels) return;
    state.isFetchingModels = true;
    const source = vscode.workspace.getConfiguration('antigravity').get('usageSource', 'api');
    const execute = callback => source === 'api'
      ? executeApiModelsCommand(callback)
      : executeModelsCommand(state.cliCache.file ? [state.cliCache.file] : getCliCandidates(), callback);
    execute((err, stdout) => {
      state.isFetchingModels = false;
      if (state.disposed) return;
      if (!err && stdout) {
        state.lastModels = parseModelsOutput(stdout);
        log(`Fetched ${state.lastModels.length} available models`);
        treeDataProvider.refresh(state.lastParsedRows, state.lastModels);
      }
    });
  }

  function fetchUsage(manual = false) {
    if (state.disposed || (!manual && Date.now() < state.nextFetchAt)) return;
    if (state.isFetching) {
      log('Usage fetch skipped: another request is in progress');
      return;
    }
    state.isFetching = true;

    const source = vscode.workspace.getConfiguration('antigravity').get('usageSource', 'api');
    if (!manual && source !== 'api') {
      state.isFetching = false;
      return;
    }
    const allCandidates = source === 'api' ? [] : getCliCandidates();
    const candidates = state.cliCache.file
      ? [state.cliCache.file, ...allCandidates.filter(file => file !== state.cliCache.file)]
      : allCandidates;
    log(`Starting ${source} usage fetch`);
    const execute = callback => source === 'api'
      ? executeApiUsageCommand(callback)
      : executeUsageCommand(candidates, callback, { cache: state.cliCache });

    execute((error, stdout, stderr) => {
      state.isFetching = false;
      if (state.disposed) return;
      const parsedRows = error ? [] : parseUsageOutput(String(stdout || stderr || '').trim());
      const failed = error || parsedRows.length === 0;
      if (failed) {
        state.failures += 1;
        const intervalSec = vscode.workspace.getConfiguration('antigravity').get('refreshInterval', 60);
        const delay = Math.min(3600000, Math.max(60000, intervalSec * 1000) * (2 ** Math.min(state.failures, 10)));
        state.nextFetchAt = Date.now() + delay;
        log(`Automatic refresh paused for ${delay / 1000}s after failure`, 'WARN');
      } else {
        state.failures = 0;
        state.nextFetchAt = 0;
      }

      if (failed) {
        const message = error
          ? (source === 'api' ? error.message : 'Manual CLI query failed')
          : 'Unable to parse quota metrics from the response.';
        log(message, 'WARN');
        const format = vscode.workspace.getConfiguration('antigravity').get('statusBarFormat', 'compact');
        statusBarItem.text = state.lastParsedRows.length
          ? `${formatStatusBarText(state.lastParsedRows, format)} (stale)`
          : '$(warning) Ag: Unavailable';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');

        treeDataProvider.refresh(state.lastParsedRows, state.lastModels, 'Quota unavailable. Check your Antigravity login.');

        const errMd = new vscode.MarkdownString();
        errMd.isTrusted = true;
        errMd.supportThemeIcons = true;
        errMd.appendMarkdown(`### $(warning) Antigravity Quota Unavailable\n\n`);
        errMd.appendText(message);
        errMd.appendMarkdown('\n\n');
        if (state.lastUpdated) errMd.appendMarkdown(`Showing previous values from ${state.lastUpdated.toLocaleTimeString()}.\n\n`);
        errMd.appendMarkdown(`**Troubleshooting:**\n`);
        errMd.appendMarkdown(`Sign in using Antigravity and refresh again.\n\n`);
        errMd.appendMarkdown(`---\n* [$(sync) Refresh](command:antigravity.refreshUsage) &nbsp;|&nbsp; [$(output) Logs](command:antigravity.showLogs) &nbsp;|&nbsp; [$(gear) Settings](command:workbench.action.openSettings?%22antigravity%22)*\n`);

        statusBarItem.tooltip = errMd;
        return;
      }

      log(`Parsed ${parsedRows.length} quota items from output`);

      state.lastParsedRows = parsedRows;
      state.lastUpdated = new Date();

      updateStatusBarDisplay();

      const config = vscode.workspace.getConfiguration('antigravity');
      checkCriticalAlerts(parsedRows, {
        notifyOnCritical: config.get('notifyOnCritical', true),
        criticalThreshold: config.get('criticalThreshold', 20)
      }, state);

      treeDataProvider.refresh(parsedRows, state.lastModels);

      statusBarItem.tooltip = createUsageTooltip(parsedRows);
    });
  }

  function setupPolling() {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
    const intervalSec = vscode.workspace.getConfiguration('antigravity').get('refreshInterval', 60);
    const config = vscode.workspace.getConfiguration('antigravity');
    const enabled = config.get('backgroundRefresh', true);
    if (enabled && config.get('usageSource', 'api') === 'api' && typeof intervalSec === 'number' && intervalSec > 0) {
      state.timer = setInterval(() => fetchUsage(), intervalSec * 1000);
    }
  }

  const refreshCmd = vscode.commands.registerCommand('antigravity.refreshUsage', () => {
    statusBarItem.text = '$(sync~spin) Ag: Refreshing...';
    statusBarItem.backgroundColor = undefined;
    statusBarItem.color = undefined;
    fetchUsage(true);
    fetchModelsList();
  });

  const detailsCmd = vscode.commands.registerCommand('antigravity.showDetails', () => {
    showDetails(state);
  });

  const logsCmd = vscode.commands.registerCommand('antigravity.showLogs', () => {
    getOutputChannel().show(true);
  });

  const copyModelCmd = vscode.commands.registerCommand('antigravity.copyModelId', async (modelId) => {
    let targetId = modelId;
    if (!targetId && state.lastModels && state.lastModels.length > 0) {
      const picked = await vscode.window.showQuickPick(
        state.lastModels.map(m => ({ label: m.id, description: m.name })),
        { placeHolder: 'Select a model ID to copy to clipboard' }
      );
      if (picked) {
        targetId = picked.label;
      }
    }
    if (targetId) {
      await vscode.env.clipboard.writeText(targetId);
      vscode.window.showInformationMessage(`Copied model ID "${targetId}" to clipboard!`);
    }
  });

  const configListener = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('antigravity.refreshInterval') || event.affectsConfiguration('antigravity.backgroundRefresh') || event.affectsConfiguration('antigravity.usageSource')) {
      setupPolling();
      if (!state.timer && !state.isFetching) {
        updateStatusBarDisplay();
      }
    }
    if (event.affectsConfiguration('antigravity.cliPath')) {
      state.cliCache = {};
      state.failures = 0;
      state.nextFetchAt = 0;
    }
    if (event.affectsConfiguration('antigravity.statusBarFormat') || event.affectsConfiguration('antigravity.criticalThreshold')) {
      updateStatusBarDisplay();
      treeDataProvider.refresh(state.lastParsedRows, state.lastModels);
      if (event.affectsConfiguration('antigravity.criticalThreshold') && state.lastParsedRows.length > 0) {
        const cfg = vscode.workspace.getConfiguration('antigravity');
        checkCriticalAlerts(state.lastParsedRows, {
          notifyOnCritical: cfg.get('notifyOnCritical', true),
          criticalThreshold: cfg.get('criticalThreshold', 20)
        }, state);
      }
    }
  });

  setupPolling();
  if (state.timer) {
    fetchUsage();
    fetchModelsList();
  } else {
    statusBarItem.text = '$(dashboard) Ag: Refresh to check';
    statusBarItem.tooltip = 'Run Antigravity: Refresh Usage to check quotas. Legacy CLI mode supports manual checks only.';
    treeDataProvider.refresh([], [], 'Run Antigravity: Refresh Usage to check quotas');
  }

  context.subscriptions.push(
    statusBarItem,
    treeView,
    refreshCmd,
    detailsCmd,
    logsCmd,
    copyModelCmd,
    configListener,
    {
      dispose: () => {
        state.disposed = true;
        if (state.timer) {
          clearInterval(state.timer);
          state.timer = null;
        }
      }
    }
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
