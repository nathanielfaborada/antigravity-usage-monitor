const { activate, deactivate } = require('./src/monitor');

// Keep the existing exports available to extension tests and integrations.
module.exports = {
  activate,
  deactivate,
  ...require('./src/logger'),
  ...require('./src/quota'),
  ...require('./src/cli'),
  ...require('./src/parsers'),
  ...require('./src/ui/statusBar'),
  ...require('./src/alerts'),
  ...require('./src/diagnostics'),
  ...require('./src/ui/treeView'),
  ...require('./src/ui/dashboard')
};
