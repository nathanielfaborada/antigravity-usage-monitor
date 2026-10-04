const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { spawnHidden } = require('./process');
const { log } = require('./logger');

/**
 * Strips enclosing quotes and trims whitespace from a path or command string.
 */
function sanitizePath(rawPath) {
  if (typeof rawPath !== 'string') return '';
  return rawPath.trim().replace(/^["']+|["']+$/g, '').trim();
}

/**
 * Returns candidate commands and fallback paths to locate the agy CLI binary.
 * On Windows, known full .exe paths are listed first for predictable resolution.
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

    // Prefer known absolute .exe paths before generic PATH resolution.
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
    if (options.cache && options.cache.file === sanitized) delete options.cache.file;
    return executeUsageCommand(rest, callback, options);
  }

  const startTime = Date.now();
  const cache = options.cache || {};
  const legacy = cache.file === sanitized && cache.legacy;
  const run = options.run || spawnHidden;
  const args = legacy ? ['-p', '/usage'] : ['-p', '/usage', '--output-format', 'json'];
  log(`Executing: ${sanitized} ${args.join(' ')}`);

  run(sanitized, args, { timeout: 10000 }, (jsonError, jsonStdout, jsonStderr) => {
    const latency = Date.now() - startTime;
    if (!jsonError && jsonStdout) {
      cache.file = sanitized;
      cache.legacy = Boolean(legacy);
      log(`Usage query succeeded in ${latency}ms`);
      return callback(null, jsonStdout, jsonStderr);
    }

    log(`Usage command failed (${latency}ms, error: ${jsonError ? jsonError.message : 'no output'})`, 'WARN');

    // If candidate binary doesn't exist (ENOENT), don't retry legacy on same candidate
    if (jsonError && jsonError.code === 'ENOENT') {
      if (cache.file === sanitized) delete cache.file;
      if (rest.length > 0) {
        return executeUsageCommand(rest, callback, options);
      }
      return callback(jsonError, jsonStdout, jsonStderr);
    }

    // Authentication, network and timeout errors won't improve by launching
    // the same CLI again. Only unsupported JSON flags warrant a legacy retry.
    const unsupportedJson = /(?:unknown|unrecognized|unsupported|unexpected|invalid|not supported)[^\n]*(?:output-format|json)|(?:output-format|json)[^\n]*(?:unknown|unrecognized|unsupported|unexpected|invalid|not supported)/i.test(`${jsonStdout || ''}\n${jsonStderr || ''}\n${jsonError ? jsonError.message : ''}`);
    if (legacy || !unsupportedJson) {
      return callback(jsonError || new Error('CLI returned no usage output'), jsonStdout, jsonStderr);
    }

    // Try legacy fallback without --output-format json
    const legacyStart = Date.now();
    run(sanitized, ['-p', '/usage'], { timeout: 10000 }, (legacyError, legacyStdout, legacyStderr) => {
      const legLatency = Date.now() - legacyStart;
      if (!legacyError) {
        cache.file = sanitized;
        cache.legacy = true;
        log(`Legacy text engine succeeded in ${legLatency}ms`);
        return callback(null, legacyStdout, legacyStderr);
      }

      log(`Candidate failed: ${sanitized} (${legLatency}ms, error: ${legacyError.message})`, 'WARN');
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

  const run = options.run || spawnHidden;
  run(sanitized, ['models'], { timeout: 10000 }, (error, stdout, stderr) => {
    const latency = Date.now() - start;
    if (error) {
      log(`Models query candidate failed (${latency}ms): ${error.message}`, 'WARN');
      if (error.code === 'ENOENT' && rest.length > 0) {
        return executeModelsCommand(rest, callback, options);
      }
      return callback(error, stdout, stderr);
    }
    log(`Models query succeeded in ${latency}ms`);
    return callback(null, stdout, stderr);
  });
}

module.exports = { sanitizePath, getCliCandidates, executeUsageCommand, executeModelsCommand };
