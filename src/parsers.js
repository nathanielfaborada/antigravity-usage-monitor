

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
          const groupName = grp.name || grp.displayName || grp.display_name || 'Unknown Group';
          const groupDesc = grp.description || '';
          const buckets = Array.isArray(grp.buckets) ? grp.buckets : [];

          for (const b of buckets) {
            const fraction = b.remaining_fraction ?? b.remainingFraction;
            const bucketId = b.id || b.bucketId || b.bucket_id;
            const percent = typeof fraction === 'number'
              ? Math.round(fraction * 100)
              : (typeof b.percent === 'number' ? b.percent : 0);

            const limitName = b.name || b.displayName || b.display_name || 'Limit';
            let window = b.window || '';
            if (!window) {
              if (/5h|five\s*hour/i.test(bucketId || limitName)) window = '5h';
              else if (/weekly/i.test(bucketId || limitName)) window = 'weekly';
              else if (/daily/i.test(bucketId || limitName)) window = 'daily';
              else if (/monthly/i.test(bucketId || limitName)) window = 'monthly';
            }

            results.push({
              group: groupName,
              groupDescription: groupDesc,
              limit: limitName,
              bucketId: bucketId || `${groupName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${window || 'limit'}`,
              window,
              percent,
              remainingFraction: typeof fraction === 'number' ? fraction : (percent / 100),
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

module.exports = { parseModelsOutput, parseUsageOutput };
