const assert = require('assert');
const vscode = require('vscode');
const extension = require('../extension');

suite('Extension Test Suite', () => {
	test('getStatusBadge returns correct badge based on thresholds', () => {
		assert.strictEqual(extension.getStatusBadge(100), '🟢 Healthy');
		assert.strictEqual(extension.getStatusBadge(50), '🟢 Healthy');
		assert.strictEqual(extension.getStatusBadge(49), '🟡 Moderate');
		assert.strictEqual(extension.getStatusBadge(20), '🟡 Moderate');
		assert.strictEqual(extension.getStatusBadge(19), '🔴 Critical');
		assert.strictEqual(extension.getStatusBadge(0), '🔴 Critical');
	});

	test('sanitizePath removes exterior quotes and trims whitespace', () => {
		assert.strictEqual(extension.sanitizePath('"C:\\Users\\bin\\agy.exe"'), 'C:\\Users\\bin\\agy.exe');
		assert.strictEqual(extension.sanitizePath('""C:\\Users\\bin\\agy.exe""'), 'C:\\Users\\bin\\agy.exe');
		assert.strictEqual(extension.sanitizePath("'agy'"), 'agy');
		assert.strictEqual(extension.sanitizePath("''agy''"), 'agy');
		assert.strictEqual(extension.sanitizePath('  "agy"  '), 'agy');
		assert.strictEqual(extension.sanitizePath(null), '');
		assert.strictEqual(extension.sanitizePath(undefined), '');
	});

	test('formatResetTime formats invalid and valid timestamps correctly', () => {
		assert.strictEqual(extension.formatResetTime(''), '--:--');
		assert.strictEqual(extension.formatResetTime(null), '--:--');
		assert.strictEqual(extension.formatResetTime('invalid-date'), '--:--');

		// Same-day future timestamp: e.g. 2 hours from now
		const now = new Date();
		const future2h = new Date(now.getTime() + 2 * 60 * 60 * 1000 + 15 * 60 * 1000);
		const future2hFormatted = extension.formatResetTime(future2h.toISOString());
		assert.ok(future2hFormatted.includes('(in 2h 15m)') || future2hFormatted.includes('(in 2h 14m)'), `Expected relative countdown in: ${future2hFormatted}`);

		// Same-day future timestamp: e.g. 45 minutes from now
		const future45m = new Date(now.getTime() + 45 * 60 * 1000);
		const future45mFormatted = extension.formatResetTime(future45m.toISOString());
		assert.ok(future45mFormatted.includes('(in 45m)') || future45mFormatted.includes('(in 44m)'), `Expected relative minutes in: ${future45mFormatted}`);

		// Future weekly timestamp (e.g., 7 days ahead)
		const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
		const weeklyFormatted = extension.formatResetTime(futureDate.toISOString());
		assert.ok(weeklyFormatted.includes('in 6d') || weeklyFormatted.includes('in 7d'), `Expected relative countdown in: ${weeklyFormatted}`);

		// Past timestamp
		const pastDate = new Date(now.getTime() - 10 * 60 * 1000);
		const pastFormatted = extension.formatResetTime(pastDate.toISOString());
		assert.ok(!pastFormatted.includes('(in'), `Past reset should not show 'in': ${pastFormatted}`);
	});

	test('formatModelLabel cleans and standardizes model names and limits', () => {
		assert.strictEqual(extension.formatModelLabel('Gemini Models', 'Five Hour Limit Remaining'), '**Gemini (5h)**');
		assert.strictEqual(extension.formatModelLabel('Claude and GPT models', 'Weekly Limit Remaining'), '**Claude and GPT (Weekly)**');
		assert.strictEqual(extension.formatModelLabel('Custom Models', 'Daily Limit Remaining'), '**Custom (Daily)**');
		assert.strictEqual(extension.formatModelLabel('', '5h Limit Remaining'), '**5h**');
	});

	test('parseUsageOutput correctly parses standard and dynamic model tiers in text format', () => {
		const standardOutput = [
			'Gemini Models\tWeekly Limit Remaining\t99%\t2026-09-21T01:40:21Z',
			'Gemini Models\tFive Hour Limit Remaining\t95%\t2026-09-14T06:40:21Z',
			'Claude and GPT models\tWeekly Limit Remaining\t67%\t2026-09-19T03:27:43Z',
			'Claude and GPT models\tFive Hour Limit Remaining\t100%\t2026-09-14T06:41:11Z'
		].join('\n');

		const parsed = extension.parseUsageOutput(standardOutput);
		assert.strictEqual(parsed.length, 4);
		assert.strictEqual(parsed[0].group, 'Gemini Models');
		assert.strictEqual(parsed[0].limit, 'Weekly Limit Remaining');
		assert.strictEqual(parsed[0].percent, 99);
		assert.strictEqual(parsed[0].resetTime, '2026-09-21T01:40:21Z');

		assert.strictEqual(parsed[3].group, 'Claude and GPT models');
		assert.strictEqual(parsed[3].percent, 100);

		// Dynamic tier model with spaces, subsecond milliseconds, and timezone offsets
		const dynamicOutput = [
			'DeepSeek Models  Daily Limit Remaining  75%  2026-09-15T00:00:00.123Z',
			'Ollama Models\tMonthly Limit Remaining\t88%\t2026-10-01T00:00:00+08:00',
			'\x1b[32mGemini Models Weekly Limit Remaining 90% 2026-09-21T01:40:21Z\x1b[0m'
		].join('\n');

		const dynamicParsed = extension.parseUsageOutput(dynamicOutput);
		assert.strictEqual(dynamicParsed.length, 3);
		assert.strictEqual(dynamicParsed[0].group, 'DeepSeek Models');
		assert.strictEqual(dynamicParsed[0].limit, 'Daily Limit Remaining');
		assert.strictEqual(dynamicParsed[0].percent, 75);
		assert.strictEqual(dynamicParsed[0].resetTime, '2026-09-15T00:00:00.123Z');

		assert.strictEqual(dynamicParsed[1].group, 'Ollama Models');
		assert.strictEqual(dynamicParsed[1].limit, 'Monthly Limit Remaining');
		assert.strictEqual(dynamicParsed[1].percent, 88);
		assert.strictEqual(dynamicParsed[1].resetTime, '2026-10-01T00:00:00+08:00');

		assert.strictEqual(dynamicParsed[2].group, 'Gemini Models');
		assert.strictEqual(dynamicParsed[2].limit, 'Weekly Limit Remaining');
		assert.strictEqual(dynamicParsed[2].percent, 90);
	});

	test('parseUsageOutput handles error or malformed output gracefully', () => {
		assert.deepStrictEqual(extension.parseUsageOutput(''), []);
		assert.deepStrictEqual(extension.parseUsageOutput(null), []);
		assert.deepStrictEqual(extension.parseUsageOutput('Please log in using agy auth login'), []);
		assert.deepStrictEqual(extension.parseUsageOutput('Error: Unauthorized'), []);
	});

	// Feature 1 Tests: Structured JSON Engine
	test('parseUsageOutput parses structured JSON engine output with rich buckets and descriptions', () => {
		const jsonOutput = JSON.stringify({
			conversation_id: 'test-conv',
			status: 'SUCCESS',
			command: {
				name: 'usage',
				data: {
					description: 'Quota consumption details',
					groups: [
						{
							name: 'Gemini Models',
							description: 'Gemini Flash and Pro',
							buckets: [
								{
									id: 'gemini-weekly',
									name: 'Weekly Limit Remaining',
									description: 'You have used some of your weekly limit, it will fully refresh in 6 days, 23 hours.',
									window: 'weekly',
									remaining_fraction: 0.9833,
									reset_time: '2026-09-21T01:40:21Z'
								},
								{
									id: 'gemini-5h',
									name: 'Five Hour Limit Remaining',
									description: 'It will fully refresh in 4 hours, 32 minutes.',
									window: '5h',
									remaining_fraction: 0.55,
									reset_time: '2026-09-14T06:40:21Z'
								}
							]
						},
						{
							name: 'Claude and GPT models',
							description: 'Claude and GPT',
							buckets: [
								{
									id: '3p-weekly',
									name: 'Weekly Limit Remaining',
									window: 'weekly',
									remaining_fraction: 0.67,
									reset_time: '2026-09-19T03:27:43Z'
								},
								{
									id: '3p-5h',
									name: 'Five Hour Limit Remaining',
									window: '5h',
									remaining_fraction: 1.0,
									reset_time: '2026-09-14T07:08:06Z'
								}
							]
						}
					]
				}
			}
		});

		const rows = extension.parseUsageOutput(jsonOutput);
		assert.strictEqual(rows.length, 4);

		assert.strictEqual(rows[0].group, 'Gemini Models');
		assert.strictEqual(rows[0].limit, 'Weekly Limit Remaining');
		assert.strictEqual(rows[0].bucketId, 'gemini-weekly');
		assert.strictEqual(rows[0].window, 'weekly');
		assert.strictEqual(rows[0].percent, 98);
		assert.strictEqual(rows[0].description, 'You have used some of your weekly limit, it will fully refresh in 6 days, 23 hours.');

		assert.strictEqual(rows[1].group, 'Gemini Models');
		assert.strictEqual(rows[1].percent, 55);
		assert.strictEqual(rows[1].bucketId, 'gemini-5h');

		assert.strictEqual(rows[3].group, 'Claude and GPT models');
		assert.strictEqual(rows[3].percent, 100);
	});

	test('parseUsageOutput falls back to response field if groups are absent in JSON', () => {
		const jsonWithResponse = JSON.stringify({
			status: 'SUCCESS',
			response: 'Gemini Models\tFive Hour Limit Remaining\t85%\t2026-09-14T06:40:21Z\n'
		});
		const rows = extension.parseUsageOutput(jsonWithResponse);
		assert.strictEqual(rows.length, 1);
		assert.strictEqual(rows[0].group, 'Gemini Models');
		assert.strictEqual(rows[0].percent, 85);
	});

	test('parseUsageOutput handles ANSI wrapped JSON and log prefix gracefully', () => {
		const rawWithAnsiAndPrefix = `Fetching usage...\n\x1b[32m${JSON.stringify({
			command: {
				data: {
					groups: [
						{
							name: 'Claude and GPT models',
							buckets: [
								{ id: '3p-5h', percent: 75, reset_time: '2026-09-14T07:00:00Z' }
							]
						}
					]
				}
			}
		})}\x1b[0m`;
		const rows = extension.parseUsageOutput(rawWithAnsiAndPrefix);
		assert.strictEqual(rows.length, 1);
		assert.strictEqual(rows[0].group, 'Claude and GPT models');
		assert.strictEqual(rows[0].percent, 75);
		assert.strictEqual(rows[0].window, '5h');
		assert.strictEqual(rows[0].bucketId, '3p-5h');
	});

	test('parseUsageOutput handles tabular line without reset time', () => {
		const textWithoutReset = 'Gemini Models\tFive Hour Limit Remaining\t82%';
		const rows = extension.parseUsageOutput(textWithoutReset);
		assert.strictEqual(rows.length, 1);
		assert.strictEqual(rows[0].percent, 82);
		assert.strictEqual(rows[0].resetTime, '');
	});

	// Feature 2 Tests: Native Visual Health Tinting
	test('updateStatusBarVisuals applies theme colors based on percent thresholds and handles non-finite', () => {
		const fakeItem = {
			backgroundColor: undefined,
			color: undefined
		};

		// Critical (< 20%)
		extension.updateStatusBarVisuals(fakeItem, 15, 20);
		assert.ok(fakeItem.backgroundColor instanceof vscode.ThemeColor);
		assert.strictEqual(fakeItem.backgroundColor.id, 'statusBarItem.errorBackground');
		assert.strictEqual(fakeItem.color.id, 'statusBarItem.errorForeground');

		// Warning / Moderate (20% - 49%)
		extension.updateStatusBarVisuals(fakeItem, 45, 20);
		assert.strictEqual(fakeItem.backgroundColor.id, 'statusBarItem.warningBackground');
		assert.strictEqual(fakeItem.color.id, 'statusBarItem.warningForeground');

		// Healthy (>= 50%)
		extension.updateStatusBarVisuals(fakeItem, 80, 20);
		assert.strictEqual(fakeItem.backgroundColor, undefined);
		assert.strictEqual(fakeItem.color, undefined);

		// Non-finite or NaN handling: should reset to undefined without throwing
		extension.updateStatusBarVisuals(fakeItem, NaN, 20);
		assert.strictEqual(fakeItem.backgroundColor, undefined);
		extension.updateStatusBarVisuals(fakeItem, Infinity, 20);
		assert.strictEqual(fakeItem.backgroundColor, undefined);
	});

	// Feature 3 Tests: Status Bar Formats & Sorting
	test('sortGroups puts Claude first, Gemini second, then others alphabetically', () => {
		const sorted = extension.sortGroups(['Custom Models', 'Gemini Models', 'Claude and GPT models', 'Anthropic']);
		assert.strictEqual(sorted[0], 'Claude and GPT models');
		assert.strictEqual(sorted[1], 'Gemini Models');
		assert.strictEqual(sorted[2], 'Anthropic');
		assert.strictEqual(sorted[3], 'Custom Models');
	});

	test('formatStatusBarText formats compact, lowestOnly, detailed, and iconOnly correctly', () => {
		const testRows = [
			{ group: 'Claude and GPT models', limit: 'Weekly Limit Remaining', percent: 67, window: 'weekly', resetTime: '' },
			{ group: 'Claude and GPT models', limit: 'Five Hour Limit Remaining', percent: 100, window: '5h', resetTime: '' },
			{ group: 'Gemini Models', limit: 'Weekly Limit Remaining', percent: 14, window: 'weekly', resetTime: '' },
			{ group: 'Gemini Models', limit: 'Five Hour Limit Remaining', percent: 55, window: '5h', resetTime: '' }
		];

		// compact format: $(dashboard) Claude: 100% | Gem: 55%
		const compactText = extension.formatStatusBarText(testRows, 'compact');
		assert.strictEqual(compactText, '$(dashboard) Claude: 100% | Gem: 55%');

		// lowestOnly format: $(dashboard) Gem: 14% (Weekly)
		const lowestText = extension.formatStatusBarText(testRows, 'lowestOnly');
		assert.strictEqual(lowestText, '$(dashboard) Gem: 14% (Weekly)');

		// detailed format: $(dashboard) C: 100%/67% | G: 55%/14%
		const detailedText = extension.formatStatusBarText(testRows, 'detailed');
		assert.strictEqual(detailedText, '$(dashboard) C: 100%/67% | G: 55%/14%');

		// Detailed format even if Gemini was first in array: C is still sorted first!
		const invertedRows = [...testRows].reverse();
		const invertedDetailed = extension.formatStatusBarText(invertedRows, 'detailed');
		assert.strictEqual(invertedDetailed, '$(dashboard) C: 100%/67% | G: 55%/14%');

		// iconOnly format: $(dashboard)
		const iconText = extension.formatStatusBarText(testRows, 'iconOnly');
		assert.strictEqual(iconText, '$(dashboard)');

		// Empty rows fallback
		assert.strictEqual(extension.formatStatusBarText([], 'compact'), '$(dashboard) Ag: No Data');
	});

	// Feature 4 Tests: Quota Depletion Alert Notifications
	test('checkCriticalAlerts notifies when quota crosses critical threshold and does not spam', () => {
		const state = { alertedKeys: new Set() };
		const notifiedMessages = [];
		const notifyFn = (msg) => {
			notifiedMessages.push(msg);
			return Promise.resolve('Dismiss');
		};

		const healthyRows = [
			{ group: 'Gemini Models', limit: '5h', bucketId: 'gemini-5h', percent: 60 }
		];
		// No alerts when healthy
		let alerts = extension.checkCriticalAlerts(healthyRows, { notifyOnCritical: true, criticalThreshold: 20 }, { ...state, notifyFn });
		assert.strictEqual(alerts.length, 0);
		assert.strictEqual(notifiedMessages.length, 0);

		// Drops below threshold
		const criticalRows = [
			{ group: 'Gemini Models', limit: '5h', bucketId: 'gemini-5h', percent: 15 }
		];
		alerts = extension.checkCriticalAlerts(criticalRows, { notifyOnCritical: true, criticalThreshold: 20 }, { ...state, notifyFn });
		assert.strictEqual(alerts.length, 1);
		assert.strictEqual(notifiedMessages.length, 1);
		assert.ok(notifiedMessages[0].includes('critical') && notifiedMessages[0].includes('15%'));

		// Next poll while still below threshold: should NOT notify again
		alerts = extension.checkCriticalAlerts(criticalRows, { notifyOnCritical: true, criticalThreshold: 20 }, { ...state, notifyFn });
		assert.strictEqual(alerts.length, 0);
		assert.strictEqual(notifiedMessages.length, 1);

		// Quota recovers above threshold
		extension.checkCriticalAlerts(healthyRows, { notifyOnCritical: true, criticalThreshold: 20 }, { ...state, notifyFn });

		// Drops again: should notify again!
		alerts = extension.checkCriticalAlerts(criticalRows, { notifyOnCritical: true, criticalThreshold: 20 }, { ...state, notifyFn });
		assert.strictEqual(alerts.length, 1);
		assert.strictEqual(notifiedMessages.length, 2);
	});

	// Feature 5 Tests: ASCII Progress Bar & Model Catalog Parsing
	test('getAsciiProgressBar returns accurate 10-block progress bar', () => {
		assert.strictEqual(extension.getAsciiProgressBar(100), '██████████');
		assert.strictEqual(extension.getAsciiProgressBar(80), '████████░░');
		assert.strictEqual(extension.getAsciiProgressBar(50), '█████░░░░░');
		assert.strictEqual(extension.getAsciiProgressBar(20), '██░░░░░░░░');
		assert.strictEqual(extension.getAsciiProgressBar(0), '░░░░░░░░░░');
		// Clamping
		assert.strictEqual(extension.getAsciiProgressBar(-10), '░░░░░░░░░░');
		assert.strictEqual(extension.getAsciiProgressBar(150), '██████████');
	});

	test('parseModelsOutput parses CLI models list into structured objects including bare IDs', () => {
		const rawModels = [
			'Fetching available models...',
			'gemini-3.8-flash-high\tGemini 3.8 Flash (High)',
			'gemini-3.8-flash-medium\tGemini 3.8 Flash (Medium)',
			'claude-sonnet-4-6\tClaude Sonnet 4.6 (Thinking)',
			'gpt-oss-120b-medium   GPT-OSS 120B (Medium)',
			'custom-standalone-model'
		].join('\n');

		const models = extension.parseModelsOutput(rawModels);
		assert.strictEqual(models.length, 5);
		assert.strictEqual(models[0].id, 'gemini-3.8-flash-high');
		assert.strictEqual(models[0].name, 'Gemini 3.8 Flash (High)');
		assert.strictEqual(models[2].id, 'claude-sonnet-4-6');
		assert.strictEqual(models[2].name, 'Claude Sonnet 4.6 (Thinking)');
		assert.strictEqual(models[3].id, 'gpt-oss-120b-medium');
		assert.strictEqual(models[3].name, 'GPT-OSS 120B (Medium)');
		assert.strictEqual(models[4].id, 'custom-standalone-model');
		assert.strictEqual(models[4].name, 'custom-standalone-model');
	});

	test('getDiagnosticsReport returns valid JSON with expected telemetry fields', () => {
		const state = {
			lastParsedRows: [{ group: 'Gemini Models', limit: '5h', percent: 90, resetTime: '' }],
			lastModels: [{ id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash' }]
		};
		const reportStr = extension.getDiagnosticsReport(state);
		const report = JSON.parse(reportStr);
		assert.ok(report.timestamp);
		assert.ok(report.platform);
		assert.ok(Array.isArray(report.cliCandidates));
		assert.strictEqual(report.quotaCount, 1);
		assert.strictEqual(report.modelCount, 1);
		assert.strictEqual(report.quotas[0].group, 'Gemini Models');
		assert.strictEqual(report.models[0].id, 'gemini-3.8-flash');
	});

	// Feature 6 Tests: TreeDataProvider
	test('QuotaTreeDataProvider displays groups, buckets, and model catalog nodes with commands', () => {
		const provider = new extension.QuotaTreeDataProvider();
		provider.refresh(
			[
				{ group: 'Gemini Models', limit: 'Five Hour Limit Remaining', percent: 90, resetTime: '2026-09-14T06:40:21Z', description: 'Refreshes in 4h' }
			],
			[
				{ id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash' }
			]
		);

		// Root items: Gemini Models group & Available Models group
		const rootItems = provider.getChildren();
		assert.strictEqual(rootItems.length, 2);
		assert.strictEqual(rootItems[0].label, 'Gemini Models');
		assert.strictEqual(rootItems[1].label, 'Available Models');

		// Children of Gemini Models group: quota bucket item
		const bucketItems = provider.getChildren(rootItems[0]);
		assert.strictEqual(bucketItems.length, 1);
		assert.ok(bucketItems[0].label.includes('Five Hour Limit Remaining: 90%'));
		assert.ok(bucketItems[0].description.includes('███████'));
		assert.strictEqual(bucketItems[0].command.command, 'antigravity.showDetails');

		// Children of Available Models group: model item
		const modelItems = provider.getChildren(rootItems[1]);
		assert.strictEqual(modelItems.length, 1);
		assert.strictEqual(modelItems[0].label, 'gemini-3.8-flash');
		assert.strictEqual(modelItems[0].description, 'Gemini 3.8 Flash');
		assert.strictEqual(modelItems[0].command.command, 'antigravity.copyModelId');
	});

	// Feature 7 Tests: OutputChannel & Logger
	test('log and getOutputChannel operate without error', () => {
		const channel = extension.getOutputChannel();
		assert.ok(channel);
		assert.strictEqual(channel.name, 'Antigravity Usage');
		// Verify calling log does not throw
		assert.doesNotThrow(() => {
			extension.log('Test diagnostics message', 'INFO');
		});
	});

	test('getCliCandidates returns non-empty list of candidate paths', () => {
		const candidates = extension.getCliCandidates();
		assert.ok(Array.isArray(candidates));
		assert.ok(candidates.length > 0);
	});

	test('executeUsageCommand handles empty candidate list with error callback', (done) => {
		extension.executeUsageCommand([], (err) => {
			assert.ok(err instanceof Error);
			done();
		});
	});

	test('executeModelsCommand handles empty candidate list with error callback', (done) => {
		extension.executeModelsCommand([], (err) => {
			assert.ok(err instanceof Error);
			done();
		});
	});

	test('All Antigravity commands are registered', async () => {
		const ext = vscode.extensions.getExtension('nathaniel-faborada.agy-quota-monitor');
		if (ext && !ext.isActive) {
			await ext.activate();
		}
		const commands = await vscode.commands.getCommands(true);
		assert.ok(commands.includes('antigravity.refreshUsage'), 'antigravity.refreshUsage should be registered');
		assert.ok(commands.includes('antigravity.showDetails'), 'antigravity.showDetails should be registered');
		assert.ok(commands.includes('antigravity.showLogs'), 'antigravity.showLogs should be registered');
		assert.ok(commands.includes('antigravity.copyModelId'), 'antigravity.copyModelId should be registered');
	});
});
