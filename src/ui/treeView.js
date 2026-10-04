const vscode = require('vscode');
const { sortGroups, getAsciiProgressBar, formatResetTime, getStatusBadge } = require('../quota');

/**
 * TreeDataProvider for the dedicated Antigravity Activity Bar view.
 */
class QuotaTreeDataProvider {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.quotaRows = [];
    this.models = [];
    this.statusMessage = 'Initializing...';
  }

  refresh(quotaRows, models, statusMessage = '') {
    if (quotaRows !== undefined) this.quotaRows = quotaRows;
    if (models !== undefined) this.models = models;
    this.statusMessage = statusMessage;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element) {
    return element;
  }

  getChildren(element) {
    if (!element) {
      if (this.quotaRows.length === 0 && this.models.length === 0) {
        const item = new vscode.TreeItem(this.statusMessage || 'No Antigravity data available', vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon('info');
        return [item];
      }

      const items = [];
      const groups = sortGroups(this.quotaRows.map(r => r.group));
      for (const group of groups) {
        const groupItem = new vscode.TreeItem(group, vscode.TreeItemCollapsibleState.Expanded);
        groupItem.iconPath = new vscode.ThemeIcon('dashboard');
        groupItem.groupName = group;
        items.push(groupItem);
      }

      if (this.models.length > 0) {
        const modelsGroup = new vscode.TreeItem('Available Models', vscode.TreeItemCollapsibleState.Collapsed);
        modelsGroup.iconPath = new vscode.ThemeIcon('symbol-misc');
        modelsGroup.isModelsGroup = true;
        items.push(modelsGroup);
      }

      return items;
    }

    if (element.groupName) {
      const rows = this.quotaRows.filter(r => r.group === element.groupName);
      const criticalThreshold = vscode.workspace.getConfiguration('antigravity').get('criticalThreshold', 20);
      return rows.map(r => {
        const bar = getAsciiProgressBar(r.percent, 8);
        const label = `${r.limit}: ${r.percent}%`;
        const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
        item.description = `[${bar}] ${formatResetTime(r.resetTime)}`;

        const tooltip = new vscode.MarkdownString();
        tooltip.appendMarkdown(`**${r.group} - ${r.limit}**\n\n`);
        tooltip.appendMarkdown(`- **Remaining Quota**: ${r.percent}%\n`);
        tooltip.appendMarkdown(`- **Status**: ${getStatusBadge(r.percent)}\n`);
        tooltip.appendMarkdown(`- **Reset Time**: ${formatResetTime(r.resetTime)}\n`);
        if (r.description) {
          tooltip.appendMarkdown(`\n_${r.description}_\n`);
        }
        item.tooltip = tooltip;

        let iconColor = 'charts.green';
        if (r.percent < criticalThreshold) iconColor = 'charts.red';
        else if (r.percent < 50) iconColor = 'charts.yellow';
        item.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor(iconColor));
        item.command = {
          command: 'antigravity.showDetails',
          title: 'Show Details'
        };
        return item;
      });
    }

    if (element.isModelsGroup) {
      return this.models.map(m => {
        const item = new vscode.TreeItem(m.id, vscode.TreeItemCollapsibleState.None);
        item.description = m.name;
        item.iconPath = new vscode.ThemeIcon('symbol-property');
        item.tooltip = `Model: ${m.name}\nID: ${m.id}\nClick to copy ID to clipboard`;
        item.command = {
          command: 'antigravity.copyModelId',
          title: 'Copy Model ID',
          arguments: [m.id]
        };
        return item;
      });
    }

    return [];
  }
}

module.exports = { QuotaTreeDataProvider };
