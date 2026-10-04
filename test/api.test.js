const assert = require('assert');
const { fetchSummary, normalizeSummary } = require('../src/api');
const { parseUsageOutput } = require('../src/parsers');

suite('Silent quota API', () => {
  test('normalizes API fields without inventing missing quotas', () => {
    const summary = normalizeSummary({ groups: [{ name: 'Gemini Models', buckets: [
      { id: 'gemini-5h', window: '5h', remainingFraction: 0.55, resetTime: '2026-10-05T00:00:00Z' },
      { id: 'gemini-weekly', window: 'weekly', remaining_fraction: 0 },
      { id: 'missing' }, { id: 'invalid', remaining_fraction: 2 }
    ] }] });
    const rows = parseUsageOutput(JSON.stringify(summary));
    assert.deepStrictEqual(rows.map(row => row.percent), [55, 0]);
    assert.strictEqual(rows[0].resetTime, '2026-10-05T00:00:00Z');
    assert.throws(() => normalizeSummary({ groups: [] }), /no valid quota buckets/);
    assert.throws(() => normalizeSummary({}), /no quota groups/);
  });
  test('reads current login for each query and never retries another provider', async () => {
    let reads = 0;
    let requests = 0;
    const options = {
      readToken: () => `test-token-${++reads}`,
      request: async (method, token) => {
        requests++;
        assert.strictEqual(method, 'retrieveUserQuotaSummary');
        assert.strictEqual(token, `test-token-${reads}`);
        throw new Error('Quota API unavailable (HTTP 401).');
      }
    };
    await assert.rejects(fetchSummary(options), /HTTP 401/);
    await assert.rejects(fetchSummary(options), /HTTP 401/);
    assert.strictEqual(reads, 2);
    assert.strictEqual(requests, 2);
  });
});
