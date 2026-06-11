const Match = require('../models/Match');

// Eligible groups for each best-3rd slot (keyed by R32 bracketId)
const BEST3RD_ELIGIBLE = {
  74: ['A','B','C','D','F'],
  77: ['C','D','F','G','H'],
  79: ['C','E','F','H','I'],
  80: ['E','H','I','J','K'],
  81: ['B','E','F','I','J'],
  82: ['A','E','H','I','J'],
  85: ['E','F','G','I','J'],
  87: ['D','E','I','J','L'],
};

async function getGroupTeams(group) {
  const matches = await Match.find({ group, stage: 'Fase de Grupos' });
  const seen = {};
  matches.forEach(m => {
    if (!seen[m.homeTeam]) seen[m.homeTeam] = m.homeFlag;
    if (!seen[m.awayTeam]) seen[m.awayTeam] = m.awayFlag;
  });
  return Object.entries(seen).map(([name, flag]) => ({ name, flag }));
}

async function getGroupStandings(group) {
  const teams = await getGroupTeams(group);
  const matches = await Match.find({ group, stage: 'Fase de Grupos', isFinished: true });

  const stats = {};
  teams.forEach(t => {
    stats[t.name] = { team: t.name, flag: t.flag, pts: 0, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0 };
  });

  matches.forEach(m => {
    const h = stats[m.homeTeam];
    const a = stats[m.awayTeam];
    if (!h || !a) return;
    h.P++; a.P++;
    h.GF += m.homeScore; h.GA += m.awayScore;
    a.GF += m.awayScore; a.GA += m.homeScore;
    h.GD = h.GF - h.GA;
    a.GD = a.GF - a.GA;
    if (m.homeScore > m.awayScore) {
      h.W++; h.pts += 3; a.L++;
    } else if (m.homeScore < m.awayScore) {
      a.W++; a.pts += 3; h.L++;
    } else {
      h.D++; h.pts++; a.D++; a.pts++;
    }
  });

  return Object.values(stats).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.GD !== a.GD) return b.GD - a.GD;
    return b.GF - a.GF;
  });
}

async function isGroupComplete(group) {
  const total = await Match.countDocuments({ group, stage: 'Fase de Grupos' });
  const finished = await Match.countDocuments({ group, stage: 'Fase de Grupos', isFinished: true });
  return total === 6 && finished === 6;
}

async function resolveSlot(slot) {
  if (!slot) return null;

  // "1A", "2B", "3C"
  if (/^[123][A-L]$/.test(slot)) {
    const pos = parseInt(slot[0]) - 1;
    const group = slot[1];
    const complete = await isGroupComplete(group);
    if (!complete) return null;
    const standings = await getGroupStandings(group);
    if (standings[pos]) return { team: standings[pos].team, flag: standings[pos].flag };
    return null;
  }

  // "W73" winner of match bracketId 73
  if (slot.startsWith('W')) {
    const bid = parseInt(slot.slice(1));
    const m = await Match.findOne({ bracketId: bid, isFinished: true });
    if (!m) return null;
    if (m.homeScore > m.awayScore) return { team: m.homeTeam, flag: m.homeFlag };
    if (m.awayScore > m.homeScore) return { team: m.awayTeam, flag: m.awayFlag };
    return { team: m.homeTeam, flag: m.homeFlag }; // tie edge case
  }

  // "L101" loser of match bracketId 101
  if (slot.startsWith('L')) {
    const bid = parseInt(slot.slice(1));
    const m = await Match.findOne({ bracketId: bid, isFinished: true });
    if (!m) return null;
    if (m.homeScore > m.awayScore) return { team: m.awayTeam, flag: m.awayFlag };
    if (m.awayScore > m.homeScore) return { team: m.homeTeam, flag: m.homeFlag };
    return { team: m.awayTeam, flag: m.awayFlag };
  }

  return null;
}

async function assignBest3rd() {
  const groups = ['A','B','C','D','E','F','G','H','I','J','K','L'];
  const thirds = [];

  for (const g of groups) {
    const complete = await isGroupComplete(g);
    if (!complete) continue;
    const standings = await getGroupStandings(g);
    if (standings.length >= 3) thirds.push({ ...standings[2], group: g });
  }

  if (thirds.length < 12) return {};

  thirds.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.GD !== a.GD) return b.GD - a.GD;
    return b.GF - a.GF;
  });

  const qualifying = thirds.slice(0, 8);
  const qualifyingGroups = new Set(qualifying.map(t => t.group));

  // Sort slots by how many eligible qualifying groups they have (most constrained first)
  const slotIds = Object.keys(BEST3RD_ELIGIBLE).map(Number);
  slotIds.sort((a, b) => {
    const aCount = BEST3RD_ELIGIBLE[a].filter(g => qualifyingGroups.has(g)).length;
    const bCount = BEST3RD_ELIGIBLE[b].filter(g => qualifyingGroups.has(g)).length;
    return aCount - bCount;
  });

  const usedGroups = new Set();
  const result = {};

  for (const matchId of slotIds) {
    const eligible = BEST3RD_ELIGIBLE[matchId].filter(g => qualifyingGroups.has(g) && !usedGroups.has(g));
    const best = qualifying.find(t => eligible.includes(t.group));
    if (best) {
      result[matchId] = { team: best.team, flag: best.flag };
      usedGroups.add(best.group);
    }
  }

  return result;
}

async function updateBracket() {
  const best3rd = await assignBest3rd();
  const knockoutMatches = await Match.find({ bracketId: { $gte: 73 } });

  for (const match of knockoutMatches) {
    let changed = false;

    const tryUpdate = async (slotField, teamField, flagField) => {
      const slot = match[slotField];
      if (!slot) return;

      let resolved = null;
      if (slot === 'B3') {
        resolved = best3rd[match.bracketId] || null;
      } else {
        resolved = await resolveSlot(slot);
      }

      if (resolved && match[teamField] !== resolved.team) {
        match[teamField] = resolved.team;
        match[flagField] = resolved.flag;
        changed = true;
      }
    };

    await tryUpdate('homeSlot', 'homeTeam', 'homeFlag');
    await tryUpdate('awaySlot', 'awayTeam', 'awayFlag');

    if (changed) await match.save();
  }
}

module.exports = { updateBracket, getGroupStandings, isGroupComplete };
