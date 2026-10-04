const vscode = require('vscode');
let outputChannel;

function getOutputChannel() {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('Antigravity Usage');
  }
  return outputChannel;
}

function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  try {
    const channel = getOutputChannel();
    channel.appendLine(`[${timestamp}] [${level}] ${message}`);
  } catch {
    // Fallback if VS Code window is not ready
  }
}

module.exports = { getOutputChannel, log };
