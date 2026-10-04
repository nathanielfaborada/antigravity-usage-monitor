const { spawn } = require('child_process');

/**
 * Spawns a process with direct console-window suppression on Windows.
 * Hides the directly launched console. A CLI that creates its own console or
 * launches additional processes must also suppress those windows itself.
 *
 * Callback signature matches execFile: (error, stdout, stderr) => void.
 */
function spawnHidden(file, args, options, callback) {
  const spawnOpts = {
    ...options,
    windowsHide: true,
    shell: false,
    detached: false,
    stdio: 'pipe'
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
  child.stdin.end();

  child.stdout.on('data', (data) => { stdout += data.toString(); });
  child.stderr.on('data', (data) => { stderr += data.toString(); });

  const timer = options.timeout
    ? setTimeout(() => {
        if (!finished) {
          finished = true;
          try { child.kill(); } catch {}
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

module.exports = { spawnHidden };
