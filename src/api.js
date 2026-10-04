const https = require('https');
const { readAccessToken } = require('./credentials');

function requestGoogle(method, accessToken) {
  return new Promise((resolve, reject) => {
    const body = '{}';
    const request = https.request({
      hostname: 'cloudcode-pa.googleapis.com',
      path: `/v1internal:${method}`, method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'antigravity-usage-monitor/0.1.5'
      }
    }, response => {
      if (response.statusCode !== 200) {
        response.resume();
        const message = response.statusCode === 401
          ? 'Antigravity login expired. Sign in again using Antigravity, then refresh.'
          : `Quota API unavailable (HTTP ${response.statusCode}).`;
        reject(new Error(message));
        return;
      }
      let output = '';
      let size = 0;
      response.on('data', data => {
        size += data.length;
        if (size > 1024 * 1024) {
          request.destroy();
          reject(new Error('Quota API response is too large.'));
        } else output += data.toString('utf8');
      });
      response.on('end', () => {
        try { resolve(JSON.parse(output)); }
        catch { reject(new Error('Quota API returned invalid data.')); }
      });
      response.on('error', () => reject(new Error('Quota API connection failed.')));
    });
    const timer = setTimeout(() => {
      request.destroy();
      reject(new Error('Quota API request timed out.'));
    }, 10000);
    request.on('close', () => clearTimeout(timer));
    request.on('error', () => reject(new Error('Unable to connect to the quota API.')));
    request.end(body);
  });
}

function normalizeSummary(payload) {
  const groups = payload.groups || payload.quotaSummary?.groups || payload.quota_summary?.groups;
  if (!Array.isArray(groups)) throw new Error('Quota API returned no quota groups.');
  const normalized = groups.map(group => ({
    name: group.name, description: group.description,
    buckets: (Array.isArray(group.buckets) ? group.buckets : []).flatMap(bucket => {
      const fraction = bucket.remaining_fraction ?? bucket.remainingFraction;
      if (typeof fraction !== 'number' || !Number.isFinite(fraction) || fraction < 0 || fraction > 1) return [];
      return [{
        ...bucket, remaining_fraction: fraction,
        reset_time: bucket.reset_time || bucket.resetTime || ''
      }];
    })
  })).filter(group => group.buckets.length);
  if (!normalized.length) throw new Error('Quota API returned no valid quota buckets.');
  return { groups: normalized };
}

async function fetchSummary(options = {}) {
  const accessToken = (options.readToken || readAccessToken)();
  const payload = await (options.request || requestGoogle)('retrieveUserQuotaSummary', accessToken);
  return normalizeSummary(payload);
}

function executeApiUsageCommand(callback) {
  fetchSummary().then(summary => callback(null, JSON.stringify(summary), ''), error => callback(error, '', ''));
}

function executeApiModelsCommand(callback) {
  Promise.resolve().then(() => requestGoogle('fetchAvailableModels', readAccessToken())).then(payload => {
    const models = payload.models || {};
    const output = Object.entries(models).filter(([, model]) => !model.isInternal)
      .map(([id, model]) => `${id}\t${model.displayName || model.name || id}`).join('\n');
    callback(null, output, '');
  }, error => callback(error, '', ''));
}

module.exports = { fetchSummary, normalizeSummary, executeApiUsageCommand, executeApiModelsCommand };
