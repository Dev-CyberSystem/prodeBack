const axios = require('axios');
const Match = require('../models/Match');
const Prediction = require('../models/Prediction');
const User = require('../models/User');
const { updateBracket } = require('./bracketService');

const API_BASE = 'https://api.football-data.org/v4';
const COMPETITION = 'WC';

// Mapeo de nombres en inglés (football-data.org) → español (seed)
const TEAM_NAME_MAP = {
  // América del Norte / Centroamérica
  'United States': 'EE.UU.',
  'USA': 'EE.UU.',
  'Mexico': 'México',
  'Canada': 'Canadá',
  'Honduras': 'Honduras',
  'Costa Rica': 'Costa Rica',
  'Panama': 'Panamá',
  'Jamaica': 'Jamaica',
  // América del Sur
  'Argentina': 'Argentina',
  'Brazil': 'Brasil',
  'Uruguay': 'Uruguay',
  'Colombia': 'Colombia',
  'Chile': 'Chile',
  'Ecuador': 'Ecuador',
  'Peru': 'Perú',
  'Bolivia': 'Bolivia',
  'Paraguay': 'Paraguay',
  'Venezuela': 'Venezuela',
  // Europa
  'Germany': 'Alemania',
  'Spain': 'España',
  'France': 'Francia',
  'England': 'Inglaterra',
  'Portugal': 'Portugal',
  'Netherlands': 'Países Bajos',
  'Belgium': 'Bélgica',
  'Italy': 'Italia',
  'Switzerland': 'Suiza',
  'Croatia': 'Croacia',
  'Serbia': 'Serbia',
  'Poland': 'Polonia',
  'Denmark': 'Dinamarca',
  'Austria': 'Austria',
  'Sweden': 'Suecia',
  'Norway': 'Noruega',
  'Czech Republic': 'República Checa',
  'Czechia': 'República Checa',
  'Slovakia': 'Eslovaquia',
  'Hungary': 'Hungría',
  'Romania': 'Rumania',
  'Turkey': 'Turquía',
  'Greece': 'Grecia',
  'Ukraine': 'Ucrania',
  'Scotland': 'Escocia',
  'Wales': 'Gales',
  'Albania': 'Albania',
  'Slovenia': 'Eslovenia',
  'Kosovo': 'Kosovo',
  'Georgia': 'Georgia',
  // Africa
  'Morocco': 'Marruecos',
  'Senegal': 'Senegal',
  'Nigeria': 'Nigeria',
  'Cameroon': 'Camerún',
  'Ghana': 'Ghana',
  'Egypt': 'Egipto',
  'Tunisia': 'Túnez',
  'Algeria': 'Argelia',
  'Mali': 'Mali',
  'Ivory Coast': 'Costa de Marfil',
  "Côte d'Ivoire": 'Costa de Marfil',
  'South Africa': 'Sudáfrica',
  'Congo DR': 'R.D. Congo',
  'Congo': 'Congo',
  'Zambia': 'Zambia',
  'Tanzania': 'Tanzania',
  'Zimbabwe': 'Zimbabue',
  'Uganda': 'Uganda',
  'Angola': 'Angola',
  'Guinea': 'Guinea',
  'Cape Verde': 'Cabo Verde',
  'Burkina Faso': 'Burkina Faso',
  'Benin': 'Benín',
  'Comoros': 'Comoras',
  // Asia
  'Japan': 'Japón',
  'South Korea': 'Corea del Sur',
  'Korea Republic': 'Corea del Sur',
  'Iran': 'Irán',
  'Saudi Arabia': 'Arabia Saudita',
  'Australia': 'Australia',
  'Qatar': 'Catar',
  'China': 'China',
  'Iraq': 'Irak',
  'Jordan': 'Jordania',
  'Uzbekistan': 'Uzbekistán',
  'Oman': 'Omán',
  'Bahrain': 'Baréin',
  'UAE': 'Emiratos Árabes',
  'United Arab Emirates': 'Emiratos Árabes',
  'Palestine': 'Palestina',
  'Indonesia': 'Indonesia',
  'Thailand': 'Tailandia',
  'Vietnam': 'Vietnam',
  'Philippines': 'Filipinas',
  'New Zealand': 'Nueva Zelanda',
};

function normalize(name) {
  return (TEAM_NAME_MAP[name] || name).toLowerCase().trim();
}

// Aplica el resultado a un partido y recalcula puntos (igual que PUT /:id/score)
async function applyScore(match, homeScore, awayScore) {
  await Match.findByIdAndUpdate(match._id, {
    homeScore,
    awayScore,
    isFinished: true,
  });

  const actualResult = homeScore > awayScore ? 'home' : homeScore < awayScore ? 'away' : 'draw';
  const predictions = await Prediction.find({ match: match._id });

  for (const prediction of predictions) {
    const predResult =
      prediction.homeScore > prediction.awayScore ? 'home' :
      prediction.homeScore < prediction.awayScore ? 'away' : 'draw';

    let pts = 0;
    if (predResult === actualResult) {
      pts += 3;
      if (prediction.homeScore === homeScore && prediction.awayScore === awayScore) pts += 2;
    }
    prediction.points = pts;
    prediction.isCalculated = true;
    await prediction.save();
  }

  const userIds = [...new Set(predictions.map((p) => p.user.toString()))];
  for (const userId of userIds) {
    const allPred = await Prediction.find({ user: userId, isCalculated: true });
    const total = allPred.reduce((s, p) => s + p.points, 0);
    await User.findByIdAndUpdate(userId, { points: total });
  }
}

async function syncResults() {
  const apiKey = process.env.FOOTBALLDATA_API_KEY;
  if (!apiKey) throw new Error('FOOTBALLDATA_API_KEY no configurada en .env');

  const { data } = await axios.get(
    `${API_BASE}/competitions/${COMPETITION}/matches?status=FINISHED`,
    { headers: { 'X-Auth-Token': apiKey } }
  );

  const apiMatches = data.matches || [];
  const dbMatches = await Match.find({ isFinished: false, homeTeam: { $ne: 'TBD' } });

  let updated = 0;
  let skipped = 0;
  const errors = [];

  for (const apiMatch of apiMatches) {
    const home = normalize(apiMatch.homeTeam?.name || '');
    const away = normalize(apiMatch.awayTeam?.name || '');
    const homeScore = apiMatch.score?.fullTime?.home;
    const awayScore = apiMatch.score?.fullTime?.away;

    if (homeScore === null || homeScore === undefined || awayScore === null || awayScore === undefined) {
      skipped++;
      continue;
    }

    // Busca en DB por nombres normalizados
    const dbMatch = dbMatches.find((m) => {
      const dbHome = normalize(m.homeTeam);
      const dbAway = normalize(m.awayTeam);
      return dbHome === home && dbAway === away;
    });

    if (!dbMatch) {
      // Intenta buscar también con los nombres invertidos (por si el fixture tiene los equipos al revés)
      skipped++;
      errors.push(`Sin coincidencia: "${apiMatch.homeTeam?.name}" vs "${apiMatch.awayTeam?.name}"`);
      continue;
    }

    try {
      await applyScore(dbMatch, homeScore, awayScore);
      updated++;
    } catch (err) {
      errors.push(`Error en ${dbMatch.homeTeam} vs ${dbMatch.awayTeam}: ${err.message}`);
    }
  }

  if (updated > 0) updateBracket().catch(console.error);

  return { updated, skipped, total: apiMatches.length, errors };
}

module.exports = { syncResults };
