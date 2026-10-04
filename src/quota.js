function getAsciiProgressBar(percent, totalBlocks = 10) {
  const safePercent = Math.max(0, Math.min(100, isNaN(percent) ? 0 : Number(percent)));
  const filled = Math.round((safePercent / 100) * totalBlocks);
  const empty = Math.max(0, totalBlocks - filled);
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function getStatusBadge(percent) {
  if (percent >= 50) {
    return '🟢 Healthy';
  } else if (percent >= 20) {
    return '🟡 Moderate';
  } else {
    return '🔴 Critical';
  }
}

// Show reset times locally, with a countdown for future resets.
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

function getShortGroupName(group) {
  let name = (group || '').replace(/\s+models$/i, '').replace(/and GPT/i, '').trim();
  if (/gemini/i.test(name)) return 'Gem';
  if (/claude/i.test(name)) return 'Claude';
  return name || 'Model';
}

function getGroupCode(group) {
  if (/claude/i.test(group)) return 'C';
  if (/gemini/i.test(group)) return 'G';
  const cleaned = (group || '').replace(/\s+models$/i, '').trim();
  return cleaned ? cleaned[0].toUpperCase() : 'M';
}

// Estimate an even daily share of weekly quota; round partial days up.
function computeDailyBudget(weeklyRow) {
  if (!weeklyRow || weeklyRow.window !== 'weekly') return null;

  const resetIso = weeklyRow.resetTime;
  if (!resetIso || typeof resetIso !== 'string' || resetIso.length < 8) return null;

  const resetDate = new Date(resetIso);
  if (isNaN(resetDate.getTime())) return null;

  const now = new Date();
  const msRemaining = resetDate - now;
  if (msRemaining <= 0) return null; // already past reset

  const hoursRemaining = msRemaining / (1000 * 60 * 60);
  const daysRemaining = Math.max(1, Math.ceil(hoursRemaining / 24));

  const dailyBudgetPercent = Math.floor(weeklyRow.percent / daysRemaining);

  return { dailyBudgetPercent, daysRemaining };
}

function getShortLimitName(limit, window) {
  if (window && /5h/i.test(window)) return '5h';
  if (window && /weekly/i.test(window)) return 'Weekly';
  if (/five\s*hour|5\s*h/i.test(limit)) return '5h';
  if (/weekly/i.test(limit)) return 'Weekly';
  if (/daily/i.test(limit)) return 'Daily';
  if (/monthly/i.test(limit)) return 'Monthly';
  return (limit || '').replace(/\s+Limit Remaining$/i, '').replace(/\s+Remaining$/i, '').trim() || 'Limit';
}

function formatModelLabel(group, limit) {
  const gName = (group || '').replace(/\s+models$/i, '').trim();
  let lName = (limit || '').replace(/\s+Limit Remaining$/i, '').replace(/\s+Remaining$/i, '').trim();
  if (/five\s*hour|5\s*h/i.test(lName)) lName = '5h';
  if (/weekly/i.test(lName)) lName = 'Weekly';
  if (!gName) return `**${lName || 'Limit'}**`;
  if (!lName) return `**${gName}**`;
  return `**${gName} (${lName})**`;
}

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

module.exports = { getAsciiProgressBar, getStatusBadge, formatResetTime, formatLocalTime, getShortGroupName, getGroupCode, computeDailyBudget, getShortLimitName, formatModelLabel, sortGroups };
