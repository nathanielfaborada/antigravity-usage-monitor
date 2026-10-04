const vscode = require('vscode');
const { getCliCandidates } = require('./cli');

/**
 * Builds a JSON-serializable diagnostics snapshot.
 */
function getDiagnosticsReport(state = {}) {
  const config = vscode.workspace.getConfiguration('antigravity');
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    platform: process.platform,
    arch: process.arch,
    cliCandidates: getCliCandidates(),
    configuration: {
      usageSource: config.get('usageSource', 'api'),
      backgroundRefresh: config.get('backgroundRefresh', true),
      cliPath: config.get('cliPath', 'agy'),
      refreshInterval: config.get('refreshInterval', 60),
      statusBarFormat: config.get('statusBarFormat', 'compact'),
      notifyOnCritical: config.get('notifyOnCritical', true),
      criticalThreshold: config.get('criticalThreshold', 20)
    },
    quotaCount: (state.lastParsedRows || []).length,
    quotas: state.lastParsedRows || [],
    modelCount: (state.lastModels || []).length,
    models: state.lastModels || []
  }, null, 2);
}

module.exports = { getDiagnosticsReport };
