const vscode = require('vscode');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Spawns a process with full console-window suppression on Windows.
 * Uses spawn() with windowsHide:true + shell:false + detached:false so that
 * Windows applies CREATE_NO_WINDOW to the child process, preventing the brief
 * console flash that console-subsystem .exe files (like agy.exe) can cause
 * even when called via execFile with windowsHide:true.
 *
 * Callback signature matches execFile: (error, stdout, stderr) => void.
 */
function spawnHidden(file, args, options, callback) {
  const spawnOpts = {
    windowsHide: true,
    shell: false,
    detached: false,
    stdio: 'pipe',
    ...options
  };

  let stdout = '';
  let stderr = '';
  let finished = false;

  let child;
  try {
    child = spawn(file, args, spawnOpts);
  } catch (err) {
    return callback(err, '', '');
  }

  child.stdout.on('data', (data) => { stdout += data.toString(); });
  child.stderr.on('data', (data) => { stderr += data.toString(); });

  const timer = options.timeout
    ? setTimeout(() => {
        if (!finished) {
          finished = true;
          try { child.kill(); } catch (_) {}
          const err = new Error(`Command timed out after ${options.timeout}ms`);
          err.code = 'ETIMEDOUT';
          callback(err, stdout, stderr);
        }
      }, options.timeout)
    : null;

  child.on('error', (err) => {
    if (finished) return;
    finished = true;
    if (timer) clearTimeout(timer);
    callback(err, stdout, stderr);
  });

  child.on('close', (code) => {
    if (finished) return;
    finished = true;
    if (timer) clearTimeout(timer);
    if (code !== 0) {
      const err = new Error(`Process exited with code ${code}`);
      err.code = code;
      callback(err, stdout, stderr);
    } else {
      callback(null, stdout, stderr);
    }
  });
}

// Global output channel for diagnostics

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

/**
 * Returns an ASCII progress bar string, e.g. [████████░░] for 80%.
 */
function getAsciiProgressBar(percent, totalBlocks = 10) {
  const safePercent = Math.max(0, Math.min(100, isNaN(percent) ? 0 : Number(percent)));
  const filled = Math.round((safePercent / 100) * totalBlocks);
  const empty = Math.max(0, totalBlocks - filled);
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Returns a health badge and label based on remaining percentage quota:
 * >= 50%: 🟢 Healthy
 * 20% - 49%: 🟡 Moderate
 * < 20%: 🔴 Critical
 */
function getStatusBadge(percent) {
  if (percent >= 50) {
    return '🟢 Healthy';
  } else if (percent >= 20) {
    return '🟡 Moderate';
  } else {
    return '🔴 Critical';
  }
}

/**
 * Converts a UTC ISO timestamp (e.g., 2026-09-12T08:27:43Z)
 * into a local formatted time.
 * For same-day resets: 04:27 PM
 * For future multi-day resets: Sep 19, 11:27 AM (in 4d 17h)
 */
function formatResetTime(isoString) {
  if (!isoString) return '--:--';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '--:--';

  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

  const isSameDay = date.getFullYear() === now.getFullYear() &&
                    date.getMonth() === now.getMonth() &&
                    date.getDate() === now.getDate();

  const baseStr = isSameDay
    ? timeStr
    : `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;

  if (diffMs > 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    const remHours = diffHours % 24;
    const remMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffDays > 0) {
      return `${baseStr} (in ${diffDays}d ${remHours}h)`;
    } else if (diffHours > 0) {
      return `${baseStr} (in ${diffHours}h${remMinutes > 0 ? ` ${remMinutes}m` : ''})`;
    } else if (remMinutes > 0) {
      return `${baseStr} (in ${remMinutes}m)`;
    } else {
      return `${baseStr} (in < 1m)`;
    }
  }

  return baseStr;
}

const formatLocalTime = formatResetTime;

/**
 * Strips enclosing quotes and trims whitespace from a path or command string.
 */
function sanitizePath(rawPath) {
  if (typeof rawPath !== 'string') return '';
  return rawPath.trim().replace(/^["']+|["']+$/g, '').trim();
}

/**
 * Shortened group display name:
 * "Gemini Models" -> "Gem"
 * "Claude and GPT models" -> "Claude"
 */
function getShortGroupName(group) {
  let name = (group || '').replace(/\s+models$/i, '').replace(/and GPT/i, '').trim();
  if (/gemini/i.test(name)) return 'Gem';
  if (/claude/i.test(name)) return 'Claude';
  return name || 'Model';
}

/**
 * Shortened group single-letter code for detailed view:
 * "Claude and GPT models" -> "C"
 * "Gemini Models" -> "G"
 */
function getGroupCode(group) {
  if (/claude/i.test(group)) return 'C';
  if (/gemini/i.test(group)) return 'G';
  const cleaned = (group || '').replace(/\s+models$/i, '').trim();
  return cleaned ? cleaned[0].toUpperCase() : 'M';
}

/**
 * Shortened limit display name:
 * "Five Hour Limit Remaining" -> "5h"
 * "Weekly Limit Remaining" -> "Weekly"
 */
function getShortLimitName(limit, window) {
  if (window && /5h/i.test(window)) return '5h';
  if (window && /weekly/i.test(window)) return 'Weekly';
  if (/five\s*hour|5\s*h/i.test(limit)) return '5h';
  if (/weekly/i.test(limit)) return 'Weekly';
  if (/daily/i.test(limit)) return 'Daily';
  if (/monthly/i.test(limit)) return 'Monthly';
  return (limit || '').replace(/\s+Limit Remaining$/i, '').replace(/\s+Remaining$/i, '').trim() || 'Limit';
}

/**
 * Formats a clean model & limit row label for markdown tables.
 */
function formatModelLabel(group, limit) {
  const gName = (group || '').replace(/\s+models$/i, '').trim();
  let lName = (limit || '').replace(/\s+Limit Remaining$/i, '').replace(/\s+Remaining$/i, '').trim();
  if (/five\s*hour|5\s*h/i.test(lName)) lName = '5h';
  if (/weekly/i.test(lName)) lName = 'Weekly';
  if (!gName) return `**${lName || 'Limit'}**`;
  if (!lName) return `**${gName}**`;
  return `**${gName} (${lName})**`;
}

/**
 * Sorts group names deterministically with Claude first, then Gemini, then others alphabetically.
 */
function sortGroups(groups) {
  return [...new Set(groups)].sort((a, b) => {
    const aClaude = /claude/i.test(a);
    const bClaude = /claude/i.test(b);
    if (aClaude && !bClaude) return -1;
    if (!aClaude && bClaude) return 1;
    const aGem = /gemini/i.test(a);
    const bGem = /gemini/i.test(b);
    if (aGem && !bGem) return -1;
    if (!aGem && bGem) return 1;
    return a.localeCompare(b);
  });
}

/**
 * Formats the status bar text according to the user's selected format:
 * - compact: $(dashboard) Claude: 100% | Gem: 55%
 * - lowestOnly: $(dashboard) Gem: 55% (5h)
 * - detailed: $(dashboard) C: 100%/67% | G: 55%/14%
 * - iconOnly: $(dashboard)
 */
function formatStatusBarText(parsedRows, format = 'compact') {
  if (!Array.isArray(parsedRows) || parsedRows.length === 0) {
    return '$(dashboard) Ag: No Data';
  }

  if (format === 'iconOnly') {
    return '$(dashboard)';
  }

  if (format === 'lowestOnly') {
    const sorted = [...parsedRows].sort((a, b) => a.percent - b.percent);
    const lowest = sorted[0];
    const groupName = getShortGroupName(lowest.group);
    const limitName = getShortLimitName(lowest.limit, lowest.window);
    return `$(dashboard) ${groupName}: ${lowest.percent}% (${limitName})`;
  }

  if (format === 'detailed') {
    const groups = sortGroups(parsedRows.map(r => r.group));
    const parts = [];
    for (const group of groups) {
      const groupRows = parsedRows.filter(r => r.group === group);
      const code = getGroupCode(group);
      const fiveHour = groupRows.find(r => /five\s*hour|5\s*h/i.test(r.limit) || (r.window && /5h/i.test(r.window)));
      const weekly = groupRows.find(r => /weekly/i.test(r.limit) || (r.window && /weekly/i.test(r.window)));
      if (fiveHour && weekly) {
        parts.push(`${code}: ${fiveHour.percent}%/${weekly.percent}%`);
      } else {
        parts.push(`${code}: ${groupRows.map(r => `${r.percent}%`).join('/')}`);
      }
    }
    return `$(dashboard) ${parts.join(' | ')}`;
  }

  // Default: 'compact'
  const claude5h = parsedRows.find(r => /claude/i.test(r.group) && (/five\s*hour|5\s*h/i.test(r.limit) || (r.window && /5h/i.test(r.window))));
  const gemini5h = parsedRows.find(r => /gemini/i.test(r.group) && (/five\s*hour|5\s*h/i.test(r.limit) || (r.window && /5h/i.test(r.window))));
  const allGroups = sortGroups(parsedRows.map(r => r.group));
  const onlyClaudeAndGemini = allGroups.length <= 2 && allGroups.every(g => /gemini|claude/i.test(g));

  if (onlyClaudeAndGemini && claude5h && gemini5h) {
    return `$(dashboard) Claude: ${claude5h.percent}% | Gem: ${gemini5h.percent}%`;
  } else {
    const groupSummaries = [];
    for (const group of allGroups) {
      const groupRows = parsedRows.filter(r => r.group === group);
      const shortRow = groupRows.find(r => /five\s*hour|5\s*h|hourly|short/i.test(r.limit) || (r.window && /5h/i.test(r.window))) || groupRows[0];
      const shortName = getShortGroupName(group);
      groupSummaries.push(`${shortName}: ${shortRow.percent}%`);
    }
    return `$(dashboard) ${groupSummaries.join(' | ')}`;
  }
}

/**
 * Updates status bar colors with native visual health tinting.
 */
function updateStatusBarVisuals(statusBarItem, minPercent, criticalThreshold = 20) {
  const safePercent = Number(minPercent);
  if (!isFinite(safePercent) || isNaN(safePercent)) {
    statusBarItem.backgroundColor = undefined;
    statusBarItem.color = undefined;
    return;
  }

  if (safePercent < criticalThreshold) {
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    statusBarItem.color = new vscode.ThemeColor('statusBarItem.errorForeground');
  } else if (safePercent < 50) {
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
  } else {
    statusBarItem.backgroundColor = undefined;
    statusBarItem.color = undefined;
  }
}

/**
 * Checks for critical quota thresholds and shows notifications when quota enters critical boundary.
 */
function checkCriticalAlerts(parsedRows, config = {}, state = {}) {
  const { notifyOnCritical = true, criticalThreshold = 20 } = config;
  if (!state.alertedKeys) {
    state.alertedKeys = new Set();
  }
  const alertedKeys = state.alertedKeys;
  const notifyFn = state.notifyFn || ((msg) => vscode.window.showWarningMessage(msg, 'View Details', 'Dismiss'));

  if (!notifyOnCritical || !Array.isArray(parsedRows) || parsedRows.length === 0) {
    return [];
  }

  const newAlerts = [];
  for (const row of parsedRows) {
    const normLimit = getShortLimitName(row.limit, row.window);
    const key = `${row.group || ''}::${normLimit}`;
    if (row.percent < criticalThreshold) {
      if (!alertedKeys.has(key)) {
        alertedKeys.add(key);
        newAlerts.push(row);
      }
    } else {
      alertedKeys.delete(key);
    }
  }

  if (newAlerts.length > 0) {
    let msg = '';
    if (newAlerts.length === 1) {
      const a = newAlerts[0];
      const modelLabel = formatModelLabel(a.group, a.limit).replace(/\*/g, '');
      msg = `Antigravity quota critical: ${modelLabel} is at ${a.percent}%!`;
    } else {
      const summaries = newAlerts.map(a => `${formatModelLabel(a.group, a.limit).replace(/\*/g, '')} (${a.percent}%)`).join(', ');
      msg = `Antigravity quota critical for multiple limits: ${summaries}`;
    }

    log(`Quota critical alert triggered: ${msg}`, 'WARN');
    try {
      const res = notifyFn(msg, newAlerts);
      if (res && typeof res.then === 'function') {
        res.then(choice => {
          if (choice === 'View Details') {
            vscode.commands.executeCommand('antigravity.showDetails');
          }
        }).catch(err => {
          log(`Critical alert action failed: ${err.message}`, 'WARN');
        });
      }
    } catch (err) {
      log(`Failed to trigger notification: ${err.message}`, 'WARN');
    }
  }

  return newAlerts;
}

/**
 * Returns candidate commands and fallback paths to locate the agy CLI binary.
 * On Windows, known full .exe paths are listed first to avoid PATH lookups
 * that can briefly spawn a visible console window.
 */
function getCliCandidates() {
  const configPath = vscode.workspace.getConfiguration('antigravity').get('cliPath', 'agy');
  const configured = sanitizePath(configPath) || 'agy';

  if (process.platform === 'win32') {
    const candidates = [];

    // If the user configured a custom path, honour it first
    if (configured !== 'agy') {
      candidates.push(configured);
    }

    // Prefer known absolute .exe paths first — avoids a PATH search that can
    // briefly flash a console window on Windows before the process is hidden.
    const localAppData = process.env.LOCALAPPDATA || '';
    if (localAppData) {
      candidates.push(path.join(localAppData, 'agy', 'bin', 'agy.exe'));
    }
    const userProfile = process.env.USERPROFILE || '';
    if (userProfile) {
      candidates.push(path.join(userProfile, '.gemini', 'antigravity-cli', 'bin', 'agy.exe'));
    }

    // Generic names as last-resort fallbacks
    candidates.push('agy.exe');
    candidates.push('agy');

    return [...new Set(candidates.filter(Boolean))];
  }

  // Non-Windows: original order
  const candidates = [configured];
  const home = process.env.HOME || '';
  if (home) {
    candidates.push(path.join(home, '.local', 'bin', 'agy'));
  }
  candidates.push('/usr/local/bin/agy');
  candidates.push('/opt/homebrew/bin/agy');
  candidates.push('/home/linuxbrew/.linuxbrew/bin/agy');

  return [...new Set(candidates.filter(Boolean))];
}

/**
 * Attempts candidate CLI paths with JSON engine first, falling back to legacy regex output.
 */
function executeUsageCommand(candidates, callback, options = {}) {
  if (!candidates || candidates.length === 0) {
    log('No CLI candidates found to execute', 'ERROR');
    return callback(new Error('CLI binary not found or failed to execute'));
  }

  const [current, ...rest] = candidates;
  const sanitized = sanitizePath(current);
  if (!sanitized) {
    return executeUsageCommand(rest, callback, options);
  }

  const isExplicitPath = sanitized.includes('/') || sanitized.includes('\\');
  if (isExplicitPath && !fs.existsSync(sanitized)) {
    return executeUsageCommand(rest, callback, options);
  }

  const startTime = Date.now();
  log(`Executing: ${sanitized} -p /usage --output-format json`);

  spawnHidden(sanitized, ['-p', '/usage', '--output-format', 'json'], { timeout: 10000 }, (jsonError, jsonStdout, jsonStderr) => {
    const latency = Date.now() - startTime;
    if (!jsonError && jsonStdout) {
      log(`JSON engine succeeded in ${latency}ms`);
      return callback(null, jsonStdout, jsonStderr);
    }

    log(`JSON command failed (${latency}ms, error: ${jsonError ? jsonError.message : 'no output'}). Attempting legacy format...`, 'WARN');

    // If candidate binary doesn't exist (ENOENT), don't retry legacy on same candidate
    if (jsonError && jsonError.code === 'ENOENT') {
      if (rest.length > 0) {
        return executeUsageCommand(rest, callback, options);
      }
      return callback(jsonError, jsonStdout, jsonStderr);
    }

    // Try legacy fallback without --output-format json
    const legacyStart = Date.now();
    spawnHidden(sanitized, ['-p', '/usage'], { timeout: 10000 }, (legacyError, legacyStdout, legacyStderr) => {
      const legLatency = Date.now() - legacyStart;
      if (!legacyError) {
        log(`Legacy text engine succeeded in ${legLatency}ms`);
        return callback(null, legacyStdout, legacyStderr);
      }

      log(`Candidate failed: ${sanitized} (${legLatency}ms, error: ${legacyError.message})`, 'WARN');
      if (rest.length > 0) {
        return executeUsageCommand(rest, callback, options);
      }
      return callback(legacyError, legacyStdout, legacyStderr);
    });
  });
}

/**
 * Fetches available models from `agy models`.
 */
function executeModelsCommand(candidates, callback, options = {}) {
  if (!candidates || candidates.length === 0) {
    return callback(new Error('CLI binary not found or failed to execute'));
  }

  const [current, ...rest] = candidates;
  const sanitized = sanitizePath(current);
  if (!sanitized) {
    return executeModelsCommand(rest, callback, options);
  }

  const isExplicitPath = sanitized.includes('/') || sanitized.includes('\\');
  if (isExplicitPath && !fs.existsSync(sanitized)) {
    return executeModelsCommand(rest, callback, options);
  }

  const start = Date.now();
  log(`Executing models query: ${sanitized} models`);

  spawnHidden(sanitized, ['models'], { timeout: 10000 }, (error, stdout, stderr) => {
    const latency = Date.now() - start;
    if (error) {
      log(`Models query candidate failed (${latency}ms): ${error.message}`, 'WARN');
      if (rest.length > 0) {
        return executeModelsCommand(rest, callback, options);
      }
      return callback(error, stdout, stderr);
    }
    log(`Models query succeeded in ${latency}ms`);
    return callback(null, stdout, stderr);
  });
}

/**
 * Parses CLI models list output into structured model objects.
 */
function parseModelsOutput(raw) {
  if (!raw || typeof raw !== 'string') return [];
  const cleanRaw = raw.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
  const lines = cleanRaw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const models = [];

  for (const line of lines) {
    if (/^fetching\s+available\s+models/i.test(line)) continue;
    if (/^usage:/i.test(line) || /^flags:/i.test(line) || /^error:/i.test(line)) continue;

    const parts = line.split(/\t+/);
    if (parts.length >= 2) {
      models.push({
        id: parts[0].trim(),
        name: parts.slice(1).join(' ').trim()
      });
    } else {
      const spaceParts = line.split(/\s{2,}/);
      if (spaceParts.length >= 2) {
        models.push({
          id: spaceParts[0].trim(),
          name: spaceParts.slice(1).join(' ').trim()
        });
      } else if (!line.includes(' ') && /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(line)) {
        models.push({
          id: line,
          name: line
        });
      }
    }
  }

  return models;
}

/**
 * Dynamically parses usage lines from CLI output.
 * Supports structured JSON engine output with robust regex fallback.
 */
function parseUsageOutput(raw) {
  if (!raw || typeof raw !== 'string') return [];

  const cleanRaw = raw.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').trim();

  // 1. Structured JSON Engine Parsing
  const firstBrace = cleanRaw.indexOf('{');
  const lastBrace = cleanRaw.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      const jsonCandidate = cleanRaw.slice(firstBrace, lastBrace + 1);
      const parsedJson = JSON.parse(jsonCandidate);
      const groups = parsedJson?.command?.data?.groups || parsedJson?.groups || parsedJson?.data?.groups;

      if (Array.isArray(groups)) {
        const results = [];
        for (const grp of groups) {
          const groupName = grp.name || 'Unknown Group';
          const groupDesc = grp.description || '';
          const buckets = Array.isArray(grp.buckets) ? grp.buckets : [];

          for (const b of buckets) {
            const percent = typeof b.remaining_fraction === 'number'
              ? Math.round(b.remaining_fraction * 100)
              : (typeof b.percent === 'number' ? b.percent : 0);

            const limitName = b.name || 'Limit';
            let window = b.window || '';
            if (!window) {
              if (/5h|five\s*hour/i.test(b.id || limitName)) window = '5h';
              else if (/weekly/i.test(b.id || limitName)) window = 'weekly';
              else if (/daily/i.test(b.id || limitName)) window = 'daily';
              else if (/monthly/i.test(b.id || limitName)) window = 'monthly';
            }

            results.push({
              group: groupName,
              groupDescription: groupDesc,
              limit: limitName,
              bucketId: b.id || `${groupName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${window || 'limit'}`,
              window,
              percent,
              remainingFraction: typeof b.remaining_fraction === 'number' ? b.remaining_fraction : (percent / 100),
              resetTime: b.reset_time || b.resetTime || '',
              description: b.description || ''
            });
          }
        }
        if (results.length > 0) {
          return results;
        }
      }

      // If JSON payload contained a tabular .response string, parse it with regex fallback
      if (typeof parsedJson.response === 'string' && parsedJson.response.trim()) {
        return parseUsageOutput(parsedJson.response);
      }
    } catch {
      // If JSON parsing errors, fall through to text regex parsing
    }
  }

  // 2. Legacy / Tabular Text Regex Engine
  const lines = cleanRaw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const results = [];

  for (const line of lines) {
    const endMatch = line.match(/\s+(\d+)\s*%(?:\s+(\S+))?$/);
    if (!endMatch) continue;

    const percent = parseInt(endMatch[1], 10);
    const resetTime = endMatch[2] ? endMatch[2].trim() : '';
    const prefix = line.slice(0, endMatch.index).trim();

    let group = '';
    let limit = '';

    if (prefix.includes('\t')) {
      const parts = prefix.split(/\t+/).map(s => s.trim()).filter(Boolean);
      group = parts[0] || '';
      limit = parts.slice(1).join(' ') || '';
    } else {
      const spaceParts = prefix.split(/\s{2,}/).map(s => s.trim()).filter(Boolean);
      if (spaceParts.length >= 2) {
        group = spaceParts[0];
        limit = spaceParts.slice(1).join(' ');
      } else {
        const lm = prefix.match(/^(.*?)\s+((?:Five\s+Hour|Weekly|Daily|Hourly|Monthly|[^\s]+)\s+Limit(?:\s+Remaining)?)$/i);
        if (lm) {
          group = lm[1].trim();
          limit = lm[2].trim();
        } else {
          group = prefix;
          limit = 'Limit';
        }
      }
    }

    if (group && limit) {
      let window = '';
      if (/five\s*hour|5\s*h/i.test(limit)) window = '5h';
      else if (/weekly/i.test(limit)) window = 'weekly';
      else if (/daily/i.test(limit)) window = 'daily';
      else if (/monthly/i.test(limit)) window = 'monthly';

      results.push({
        group,
        limit,
        percent,
        resetTime,
        window,
        bucketId: `${group.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${window || 'limit'}`,
        description: ''
      });
    }
  }

  return results;
}

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

/**
 * Displays the interactive QuickPick dashboard with ASCII progress bars and actions.
 */
async function showDetails(state) {
  const quickPick = vscode.window.createQuickPick();
  quickPick.title = 'Antigravity Usage Dashboard & Models';
  quickPick.placeholder = 'Select an action, view quota limits, or copy model IDs';

  const items = [];

  // Quota items
  items.push({ kind: vscode.QuickPickItemKind.Separator, label: 'Quota Limits' });
  if (!state.lastParsedRows || state.lastParsedRows.length === 0) {
    items.push({
      label: '$(warning) No quota metrics loaded',
      description: 'Run "Refresh Quotas" to fetch metrics',
      action: 'refresh'
    });
  } else {
    for (const r of state.lastParsedRows) {
      const bar = getAsciiProgressBar(r.percent, 10);
      const groupName = getShortGroupName(r.group);
      const limitName = getShortLimitName(r.limit, r.window);
      const resetDesc = r.description ? r.description : `Resets ${formatResetTime(r.resetTime)}`;
      items.push({
        label: `[${bar}] ${r.percent}% — ${groupName} ${limitName}`,
        description: resetDesc,
        detail: `Group: ${r.group} • Limit: ${r.limit} • Status: ${getStatusBadge(r.percent)} • Click to copy info`,
        row: r
      });
    }
  }

  // Model catalog items
  if (state.lastModels && state.lastModels.length > 0) {
    items.push({ kind: vscode.QuickPickItemKind.Separator, label: 'Available Models' });
    for (const m of state.lastModels) {
      items.push({
        label: `$(symbol-misc) ${m.id}`,
        description: m.name,
        detail: 'Click to copy model ID to clipboard',
        modelId: m.id
      });
    }
  }

  // Actions items
  items.push({ kind: vscode.QuickPickItemKind.Separator, label: 'Actions' });
  items.push({
    label: '$(sync) Refresh Quotas',
    description: 'Fetch latest usage metrics from agy CLI',
    action: 'refresh'
  });
  items.push({
    label: '$(gear) Open Settings',
    description: 'Configure Antigravity extension settings',
    action: 'settings'
  });
  items.push({
    label: '$(copy) Copy Diagnostics',
    description: 'Copy system and quota diagnostics to clipboard',
    action: 'copyDiagnostics'
  });
  items.push({
    label: '$(output) Show Logs',
    description: 'View diagnostic execution logs in Output panel',
    action: 'showLogs'
  });

  quickPick.items = items;

  quickPick.onDidAccept(() => {
    const selected = quickPick.selectedItems[0];
    quickPick.hide();
    quickPick.dispose();
    if (!selected) return;

    if (selected.action === 'refresh') {
      vscode.commands.executeCommand('antigravity.refreshUsage');
    } else if (selected.action === 'settings') {
      vscode.commands.executeCommand('workbench.action.openSettings', 'antigravity');
    } else if (selected.action === 'copyDiagnostics') {
      const diag = getDiagnosticsReport(state);
      vscode.env.clipboard.writeText(diag);
      vscode.window.showInformationMessage('Antigravity diagnostics copied to clipboard!');
    } else if (selected.action === 'showLogs') {
      vscode.commands.executeCommand('antigravity.showLogs');
    } else if (selected.modelId) {
      vscode.env.clipboard.writeText(selected.modelId);
      vscode.window.showInformationMessage(`Copied model ID "${selected.modelId}" to clipboard!`);
    } else if (selected.row) {
      const summary = `${selected.row.group} ${selected.row.limit}: ${selected.row.percent}% remaining (${formatResetTime(selected.row.resetTime)})`;
      vscode.env.clipboard.writeText(summary);
      vscode.window.showInformationMessage(`Copied quota info: "${summary}" to clipboard!`);
    }
  });

  quickPick.onDidHide(() => {
    quickPick.dispose();
  });

  quickPick.show();
}

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
    timer: null,
    lastParsedRows: [],
    lastModels: [],
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
    const candidates = getCliCandidates();
    executeModelsCommand(candidates, (err, stdout) => {
      if (!err && stdout) {
        state.lastModels = parseModelsOutput(stdout);
        log(`Fetched ${state.lastModels.length} available models`);
        treeDataProvider.refresh(state.lastParsedRows, state.lastModels);
      }
    });
  }

  function fetchUsage() {
    if (state.isFetching) {
      log('Usage fetch skipped: another request is in progress');
      return;
    }
    state.isFetching = true;

    const candidates = getCliCandidates();
    log(`Starting usage fetch across ${candidates.length} candidates`);

    executeUsageCommand(candidates, (error, stdout, stderr) => {
      state.isFetching = false;

      if (error) {
        statusBarItem.text = '$(warning) Ag: CLI Missing';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');

        treeDataProvider.refresh([], [], 'Antigravity CLI binary missing or failed');

        const errMd = new vscode.MarkdownString();
        errMd.isTrusted = true;
        errMd.supportThemeIcons = true;
        errMd.appendMarkdown(`### $(warning) Antigravity CLI Missing\n\n`);
        errMd.appendMarkdown(`Unable to find or execute the \`agy\` CLI binary.\n\n`);
        if (error.message) {
          errMd.appendMarkdown(`**Error Details:** ${error.message}\n\n`);
        }
        errMd.appendMarkdown(`**Troubleshooting:**\n`);
        errMd.appendMarkdown(`1. Ensure the Antigravity CLI (\`agy\`) is installed and authenticated.\n`);
        errMd.appendMarkdown(`2. Or specify the executable name/path in Settings: \`antigravity.cliPath\`.\n\n`);
        errMd.appendMarkdown(`---\n* [$(sync) Refresh](command:antigravity.refreshUsage) &nbsp;|&nbsp; [$(output) Logs](command:antigravity.showLogs) &nbsp;|&nbsp; [$(gear) Settings](command:workbench.action.openSettings?%22antigravity%22)*\n`);

        statusBarItem.tooltip = errMd;
        return;
      }

      const raw = String(stdout || stderr || '').trim();
      const parsedRows = parseUsageOutput(raw);
      log(`Parsed ${parsedRows.length} quota items from output`);

      if (parsedRows.length === 0) {
        statusBarItem.text = '$(warning) Ag: Error';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');

        treeDataProvider.refresh([], [], 'Unable to parse quota metrics');

        const errMd = new vscode.MarkdownString();
        errMd.isTrusted = true;
        errMd.supportThemeIcons = true;
        errMd.appendMarkdown(`### $(warning) Antigravity Quota Unavailable\n\n`);
        errMd.appendMarkdown(`Unable to parse quota metrics from CLI output.\n\n`);
        if (raw) {
          errMd.appendMarkdown(`**CLI Output:**\n\`\`\`\n${raw.slice(0, 500)}\n\`\`\`\n\n`);
        }
        errMd.appendMarkdown(`---\n* [$(sync) Refresh](command:antigravity.refreshUsage) &nbsp;|&nbsp; [$(output) Logs](command:antigravity.showLogs) &nbsp;|&nbsp; [$(gear) Settings](command:workbench.action.openSettings?%22antigravity%22)*\n`);

        statusBarItem.tooltip = errMd;
        return;
      }

      state.lastParsedRows = parsedRows;

      // Update status bar display with chosen format and health tinting
      updateStatusBarDisplay();

      // Check for critical quota alert notifications
      const config = vscode.workspace.getConfiguration('antigravity');
      checkCriticalAlerts(parsedRows, {
        notifyOnCritical: config.get('notifyOnCritical', true),
        criticalThreshold: config.get('criticalThreshold', 20)
      }, state);

      // Update tree view
      treeDataProvider.refresh(parsedRows, state.lastModels);

      // Styled Markdown UI Tooltip with Dynamic Model Rows & clickable links
      const md = new vscode.MarkdownString();
      md.isTrusted = true;
      md.supportThemeIcons = true;

      md.appendMarkdown(`### $(dashboard) Antigravity Quotas\n\n`);
      md.appendMarkdown(`| Model | Remaining | Status | Reset Time |\n`);
      md.appendMarkdown(`| :--- | :---: | :---: | :---: |\n`);

      for (const row of parsedRows) {
        const label = formatModelLabel(row.group, row.limit);
        const badge = getStatusBadge(row.percent);
        const resetStr = formatResetTime(row.resetTime);
        md.appendMarkdown(`| ${label} | ${row.percent}% | ${badge} | ${resetStr} |\n`);
      }

      md.appendMarkdown(`\n---\n* [$(sync) Refresh](command:antigravity.refreshUsage) &nbsp;|&nbsp; [$(list-selection) Details](command:antigravity.showDetails) &nbsp;|&nbsp; [$(output) Logs](command:antigravity.showLogs) &nbsp;|&nbsp; [$(gear) Settings](command:workbench.action.openSettings?%22antigravity%22)*\n`);

      statusBarItem.tooltip = md;
    });
  }

  function setupPolling() {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
    const intervalSec = vscode.workspace.getConfiguration('antigravity').get('refreshInterval', 60);
    if (typeof intervalSec === 'number' && intervalSec > 0) {
      state.timer = setInterval(fetchUsage, intervalSec * 1000);
    }
  }

  const refreshCmd = vscode.commands.registerCommand('antigravity.refreshUsage', () => {
    statusBarItem.text = '$(sync~spin) Ag: Refreshing...';
    statusBarItem.backgroundColor = undefined;
    statusBarItem.color = undefined;
    fetchUsage();
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
    if (event.affectsConfiguration('antigravity.refreshInterval')) {
      setupPolling();
    }
    if (event.affectsConfiguration('antigravity.cliPath')) {
      statusBarItem.text = '$(sync~spin) Ag: Checking...';
      statusBarItem.backgroundColor = undefined;
      statusBarItem.color = undefined;
      fetchUsage();
      fetchModelsList();
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
  fetchUsage();
  fetchModelsList();

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
        if (state.timer) {
          clearInterval(state.timer);
          state.timer = null;
        }
      }
    }
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
  getOutputChannel,
  log,
  getStatusBadge,
  formatResetTime,
  formatLocalTime,
  sanitizePath,
  getCliCandidates,
  executeUsageCommand,
  executeModelsCommand,
  parseUsageOutput,
  parseModelsOutput,
  formatModelLabel,
  getAsciiProgressBar,
  getShortGroupName,
  getShortLimitName,
  getGroupCode,
  formatStatusBarText,
  updateStatusBarVisuals,
  checkCriticalAlerts,
  getDiagnosticsReport,
  QuotaTreeDataProvider,
  showDetails,
  sortGroups
};