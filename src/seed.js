require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Match = require('./models/Match');

// d(y,m,d,h,min) → UTC Date. Times given in US local (~EDT=UTC-4 / CDT=UTC-5).
// We store everything as UTC. Times are approximate (±1h) for prediction locking purposes.
const d = (y, mo, da, h, mi = 0) => new Date(Date.UTC(y, mo - 1, da, h, mi));

// ---------- GRUPO STAGE (bracketIds 1-72) ----------
const groupMatches = [
  // ── GRUPO A: México, Corea del Sur, Sudáfrica, Rep. Checa ──
  { bracketId:1,  group:'A', homeTeam:'México',         homeFlag:'🇲🇽', awayTeam:'Sudáfrica',     awayFlag:'🇿🇦', matchDate:d(2026,6,11,19,0),  stage:'Fase de Grupos' },
  { bracketId:2,  group:'A', homeTeam:'Corea del Sur',  homeFlag:'🇰🇷', awayTeam:'Rep. Checa',    awayFlag:'🇨🇿', matchDate:d(2026,6,12, 1,0),  stage:'Fase de Grupos' },
  { bracketId:3,  group:'A', homeTeam:'Rep. Checa',     homeFlag:'🇨🇿', awayTeam:'Sudáfrica',     awayFlag:'🇿🇦', matchDate:d(2026,6,18,15,0),  stage:'Fase de Grupos' },
  { bracketId:4,  group:'A', homeTeam:'México',         homeFlag:'🇲🇽', awayTeam:'Corea del Sur', awayFlag:'🇰🇷', matchDate:d(2026,6,19, 0,0),  stage:'Fase de Grupos' },
  { bracketId:5,  group:'A', homeTeam:'Sudáfrica',      homeFlag:'🇿🇦', awayTeam:'Corea del Sur', awayFlag:'🇰🇷', matchDate:d(2026,6,25, 0,0),  stage:'Fase de Grupos' },
  { bracketId:6,  group:'A', homeTeam:'Rep. Checa',     homeFlag:'🇨🇿', awayTeam:'México',        awayFlag:'🇲🇽', matchDate:d(2026,6,25, 0,0),  stage:'Fase de Grupos' },

  // ── GRUPO B: Canadá, Suiza, Qatar, Bosnia ──
  { bracketId:7,  group:'B', homeTeam:'Canadá',         homeFlag:'🇨🇦', awayTeam:'Bosnia',        awayFlag:'🇧🇦', matchDate:d(2026,6,12,18,0),  stage:'Fase de Grupos' },
  { bracketId:8,  group:'B', homeTeam:'Qatar',          homeFlag:'🇶🇦', awayTeam:'Suiza',         awayFlag:'🇨🇭', matchDate:d(2026,6,13,18,0),  stage:'Fase de Grupos' },
  { bracketId:9,  group:'B', homeTeam:'Suiza',          homeFlag:'🇨🇭', awayTeam:'Bosnia',        awayFlag:'🇧🇦', matchDate:d(2026,6,18,18,0),  stage:'Fase de Grupos' },
  { bracketId:10, group:'B', homeTeam:'Canadá',         homeFlag:'🇨🇦', awayTeam:'Qatar',         awayFlag:'🇶🇦', matchDate:d(2026,6,18,21,0),  stage:'Fase de Grupos' },
  { bracketId:11, group:'B', homeTeam:'Suiza',          homeFlag:'🇨🇭', awayTeam:'Canadá',        awayFlag:'🇨🇦', matchDate:d(2026,6,24,18,0),  stage:'Fase de Grupos' },
  { bracketId:12, group:'B', homeTeam:'Bosnia',         homeFlag:'🇧🇦', awayTeam:'Qatar',         awayFlag:'🇶🇦', matchDate:d(2026,6,24,18,0),  stage:'Fase de Grupos' },

  // ── GRUPO C: Brasil, Marruecos, Escocia, Haití ──
  { bracketId:13, group:'C', homeTeam:'Brasil',         homeFlag:'🇧🇷', awayTeam:'Marruecos',     awayFlag:'🇲🇦', matchDate:d(2026,6,13,21,0),  stage:'Fase de Grupos' },
  { bracketId:14, group:'C', homeTeam:'Haití',          homeFlag:'🇭🇹', awayTeam:'Escocia',       awayFlag:'🏴󠁧󠁢󠁳󠁣󠁴󠁿', matchDate:d(2026,6,14, 0,0),  stage:'Fase de Grupos' },
  { bracketId:15, group:'C', homeTeam:'Escocia',        homeFlag:'🏴󠁧󠁢󠁳󠁣󠁴󠁿', awayTeam:'Marruecos',    awayFlag:'🇲🇦', matchDate:d(2026,6,19,21,0),  stage:'Fase de Grupos' },
  { bracketId:16, group:'C', homeTeam:'Brasil',         homeFlag:'🇧🇷', awayTeam:'Haití',         awayFlag:'🇭🇹', matchDate:d(2026,6,19,23,30), stage:'Fase de Grupos' },
  { bracketId:17, group:'C', homeTeam:'Marruecos',      homeFlag:'🇲🇦', awayTeam:'Haití',         awayFlag:'🇭🇹', matchDate:d(2026,6,24,21,0),  stage:'Fase de Grupos' },
  { bracketId:18, group:'C', homeTeam:'Escocia',        homeFlag:'🏴󠁧󠁢󠁳󠁣󠁴󠁿', awayTeam:'Brasil',       awayFlag:'🇧🇷', matchDate:d(2026,6,24,21,0),  stage:'Fase de Grupos' },

  // ── GRUPO D: EE.UU., Australia, Paraguay, Turquía ──
  { bracketId:19, group:'D', homeTeam:'EE.UU.',         homeFlag:'🇺🇸', awayTeam:'Paraguay',      awayFlag:'🇵🇾', matchDate:d(2026,6,13, 0,0),  stage:'Fase de Grupos' },
  { bracketId:20, group:'D', homeTeam:'Australia',      homeFlag:'🇦🇺', awayTeam:'Turquía',       awayFlag:'🇹🇷', matchDate:d(2026,6,14, 3,0),  stage:'Fase de Grupos' },
  { bracketId:21, group:'D', homeTeam:'EE.UU.',         homeFlag:'🇺🇸', awayTeam:'Australia',     awayFlag:'🇦🇺', matchDate:d(2026,6,19,18,0),  stage:'Fase de Grupos' },
  { bracketId:22, group:'D', homeTeam:'Turquía',        homeFlag:'🇹🇷', awayTeam:'Paraguay',      awayFlag:'🇵🇾', matchDate:d(2026,6,20, 2,0),  stage:'Fase de Grupos' },
  { bracketId:23, group:'D', homeTeam:'Turquía',        homeFlag:'🇹🇷', awayTeam:'EE.UU.',        awayFlag:'🇺🇸', matchDate:d(2026,6,26, 1,0),  stage:'Fase de Grupos' },
  { bracketId:24, group:'D', homeTeam:'Paraguay',       homeFlag:'🇵🇾', awayTeam:'Australia',     awayFlag:'🇦🇺', matchDate:d(2026,6,26, 1,0),  stage:'Fase de Grupos' },

  // ── GRUPO E: Alemania, Ecuador, Costa de Marfil, Curazao ──
  { bracketId:25, group:'E', homeTeam:'Alemania',       homeFlag:'🇩🇪', awayTeam:'Curazao',       awayFlag:'🇨🇼', matchDate:d(2026,6,14,16,0),  stage:'Fase de Grupos' },
  { bracketId:26, group:'E', homeTeam:'Costa de Marfil',homeFlag:'🇨🇮', awayTeam:'Ecuador',       awayFlag:'🇪🇨', matchDate:d(2026,6,14,22,0),  stage:'Fase de Grupos' },
  { bracketId:27, group:'E', homeTeam:'Alemania',       homeFlag:'🇩🇪', awayTeam:'Costa de Marfil',awayFlag:'🇨🇮',matchDate:d(2026,6,20,19,0),  stage:'Fase de Grupos' },
  { bracketId:28, group:'E', homeTeam:'Ecuador',        homeFlag:'🇪🇨', awayTeam:'Curazao',       awayFlag:'🇨🇼', matchDate:d(2026,6,20,23,0),  stage:'Fase de Grupos' },
  { bracketId:29, group:'E', homeTeam:'Curazao',        homeFlag:'🇨🇼', awayTeam:'Costa de Marfil',awayFlag:'🇨🇮',matchDate:d(2026,6,25,19,0),  stage:'Fase de Grupos' },
  { bracketId:30, group:'E', homeTeam:'Ecuador',        homeFlag:'🇪🇨', awayTeam:'Alemania',      awayFlag:'🇩🇪', matchDate:d(2026,6,25,19,0),  stage:'Fase de Grupos' },

  // ── GRUPO F: Países Bajos, Japón, Túnez, Suecia ──
  { bracketId:31, group:'F', homeTeam:'Países Bajos',   homeFlag:'🇳🇱', awayTeam:'Japón',         awayFlag:'🇯🇵', matchDate:d(2026,6,14,19,0),  stage:'Fase de Grupos' },
  { bracketId:32, group:'F', homeTeam:'Suecia',         homeFlag:'🇸🇪', awayTeam:'Túnez',         awayFlag:'🇹🇳', matchDate:d(2026,6,15, 1,0),  stage:'Fase de Grupos' },
  { bracketId:33, group:'F', homeTeam:'Países Bajos',   homeFlag:'🇳🇱', awayTeam:'Suecia',        awayFlag:'🇸🇪', matchDate:d(2026,6,20,16,0),  stage:'Fase de Grupos' },
  { bracketId:34, group:'F', homeTeam:'Túnez',          homeFlag:'🇹🇳', awayTeam:'Japón',         awayFlag:'🇯🇵', matchDate:d(2026,6,21, 3,0),  stage:'Fase de Grupos' },
  { bracketId:35, group:'F', homeTeam:'Túnez',          homeFlag:'🇹🇳', awayTeam:'Países Bajos',  awayFlag:'🇳🇱', matchDate:d(2026,6,25,22,0),  stage:'Fase de Grupos' },
  { bracketId:36, group:'F', homeTeam:'Japón',          homeFlag:'🇯🇵', awayTeam:'Suecia',        awayFlag:'🇸🇪', matchDate:d(2026,6,25,22,0),  stage:'Fase de Grupos' },

  // ── GRUPO G: Bélgica, Irán, Egipto, Nueva Zelanda ──
  { bracketId:37, group:'G', homeTeam:'Bélgica',        homeFlag:'🇧🇪', awayTeam:'Egipto',        awayFlag:'🇪🇬', matchDate:d(2026,6,15,18,0),  stage:'Fase de Grupos' },
  { bracketId:38, group:'G', homeTeam:'Irán',           homeFlag:'🇮🇷', awayTeam:'Nueva Zelanda', awayFlag:'🇳🇿', matchDate:d(2026,6,16, 0,0),  stage:'Fase de Grupos' },
  { bracketId:39, group:'G', homeTeam:'Bélgica',        homeFlag:'🇧🇪', awayTeam:'Irán',          awayFlag:'🇮🇷', matchDate:d(2026,6,21,18,0),  stage:'Fase de Grupos' },
  { bracketId:40, group:'G', homeTeam:'Nueva Zelanda',  homeFlag:'🇳🇿', awayTeam:'Egipto',        awayFlag:'🇪🇬', matchDate:d(2026,6,22, 0,0),  stage:'Fase de Grupos' },
  { bracketId:41, group:'G', homeTeam:'Nueva Zelanda',  homeFlag:'🇳🇿', awayTeam:'Bélgica',       awayFlag:'🇧🇪', matchDate:d(2026,6,27, 2,0),  stage:'Fase de Grupos' },
  { bracketId:42, group:'G', homeTeam:'Egipto',         homeFlag:'🇪🇬', awayTeam:'Irán',          awayFlag:'🇮🇷', matchDate:d(2026,6,27, 2,0),  stage:'Fase de Grupos' },

  // ── GRUPO H: España, Uruguay, Arabia Saudita, Cabo Verde ──
  { bracketId:43, group:'H', homeTeam:'España',         homeFlag:'🇪🇸', awayTeam:'Cabo Verde',    awayFlag:'🇨🇻', matchDate:d(2026,6,15,15,0),  stage:'Fase de Grupos' },
  { bracketId:44, group:'H', homeTeam:'Arabia Saudita', homeFlag:'🇸🇦', awayTeam:'Uruguay',       awayFlag:'🇺🇾', matchDate:d(2026,6,15,21,0),  stage:'Fase de Grupos' },
  { bracketId:45, group:'H', homeTeam:'España',         homeFlag:'🇪🇸', awayTeam:'Arabia Saudita',awayFlag:'🇸🇦', matchDate:d(2026,6,21,15,0),  stage:'Fase de Grupos' },
  { bracketId:46, group:'H', homeTeam:'Uruguay',        homeFlag:'🇺🇾', awayTeam:'Cabo Verde',    awayFlag:'🇨🇻', matchDate:d(2026,6,21,21,0),  stage:'Fase de Grupos' },
  { bracketId:47, group:'H', homeTeam:'Cabo Verde',     homeFlag:'🇨🇻', awayTeam:'Arabia Saudita',awayFlag:'🇸🇦', matchDate:d(2026,6,26,23,0),  stage:'Fase de Grupos' },
  { bracketId:48, group:'H', homeTeam:'Uruguay',        homeFlag:'🇺🇾', awayTeam:'España',        awayFlag:'🇪🇸', matchDate:d(2026,6,26,23,0),  stage:'Fase de Grupos' },

  // ── GRUPO I: Francia, Senegal, Noruega, Iraq ──
  { bracketId:49, group:'I', homeTeam:'Francia',        homeFlag:'🇫🇷', awayTeam:'Senegal',       awayFlag:'🇸🇳', matchDate:d(2026,6,16,18,0),  stage:'Fase de Grupos' },
  { bracketId:50, group:'I', homeTeam:'Iraq',           homeFlag:'🇮🇶', awayTeam:'Noruega',       awayFlag:'🇳🇴', matchDate:d(2026,6,16,21,0),  stage:'Fase de Grupos' },
  { bracketId:51, group:'I', homeTeam:'Francia',        homeFlag:'🇫🇷', awayTeam:'Iraq',          awayFlag:'🇮🇶', matchDate:d(2026,6,22,20,0),  stage:'Fase de Grupos' },
  { bracketId:52, group:'I', homeTeam:'Noruega',        homeFlag:'🇳🇴', awayTeam:'Senegal',       awayFlag:'🇸🇳', matchDate:d(2026,6,22,23,0),  stage:'Fase de Grupos' },
  { bracketId:53, group:'I', homeTeam:'Noruega',        homeFlag:'🇳🇴', awayTeam:'Francia',       awayFlag:'🇫🇷', matchDate:d(2026,6,26,18,0),  stage:'Fase de Grupos' },
  { bracketId:54, group:'I', homeTeam:'Senegal',        homeFlag:'🇸🇳', awayTeam:'Iraq',          awayFlag:'🇮🇶', matchDate:d(2026,6,26,18,0),  stage:'Fase de Grupos' },

  // ── GRUPO J: Argentina, Austria, Argelia, Jordania ──
  { bracketId:55, group:'J', homeTeam:'Argentina',      homeFlag:'🇦🇷', awayTeam:'Argelia',       awayFlag:'🇩🇿', matchDate:d(2026,6,17, 1,0),  stage:'Fase de Grupos' },
  { bracketId:56, group:'J', homeTeam:'Austria',        homeFlag:'🇦🇹', awayTeam:'Jordania',      awayFlag:'🇯🇴', matchDate:d(2026,6,17, 3,0),  stage:'Fase de Grupos' },
  { bracketId:57, group:'J', homeTeam:'Argentina',      homeFlag:'🇦🇷', awayTeam:'Austria',       awayFlag:'🇦🇹', matchDate:d(2026,6,22,17,0),  stage:'Fase de Grupos' },
  { bracketId:58, group:'J', homeTeam:'Jordania',       homeFlag:'🇯🇴', awayTeam:'Argelia',       awayFlag:'🇩🇿', matchDate:d(2026,6,23, 1,0),  stage:'Fase de Grupos' },
  { bracketId:59, group:'J', homeTeam:'Argelia',        homeFlag:'🇩🇿', awayTeam:'Austria',       awayFlag:'🇦🇹', matchDate:d(2026,6,28, 0,0),  stage:'Fase de Grupos' },
  { bracketId:60, group:'J', homeTeam:'Jordania',       homeFlag:'🇯🇴', awayTeam:'Argentina',     awayFlag:'🇦🇷', matchDate:d(2026,6,28, 2,0),  stage:'Fase de Grupos' },

  // ── GRUPO K: Portugal, Colombia, Uzbekistán, Rep. Dem. Congo ──
  { bracketId:61, group:'K', homeTeam:'Portugal',       homeFlag:'🇵🇹', awayTeam:'Rep. D. Congo', awayFlag:'🇨🇩', matchDate:d(2026,6,17,16,0),  stage:'Fase de Grupos' },
  { bracketId:62, group:'K', homeTeam:'Uzbekistán',     homeFlag:'🇺🇿', awayTeam:'Colombia',      awayFlag:'🇨🇴', matchDate:d(2026,6,18, 1,0),  stage:'Fase de Grupos' },
  { bracketId:63, group:'K', homeTeam:'Portugal',       homeFlag:'🇵🇹', awayTeam:'Uzbekistán',    awayFlag:'🇺🇿', matchDate:d(2026,6,23,16,0),  stage:'Fase de Grupos' },
  { bracketId:64, group:'K', homeTeam:'Colombia',       homeFlag:'🇨🇴', awayTeam:'Rep. D. Congo', awayFlag:'🇨🇩', matchDate:d(2026,6,24, 1,0),  stage:'Fase de Grupos' },
  { bracketId:65, group:'K', homeTeam:'Colombia',       homeFlag:'🇨🇴', awayTeam:'Portugal',      awayFlag:'🇵🇹', matchDate:d(2026,6,27,22,30), stage:'Fase de Grupos' },
  { bracketId:66, group:'K', homeTeam:'Rep. D. Congo',  homeFlag:'🇨🇩', awayTeam:'Uzbekistán',    awayFlag:'🇺🇿', matchDate:d(2026,6,27,22,30), stage:'Fase de Grupos' },

  // ── GRUPO L: Inglaterra, Croacia, Panamá, Ghana ──
  { bracketId:67, group:'L', homeTeam:'Inglaterra',     homeFlag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', awayTeam:'Croacia',      awayFlag:'🇭🇷', matchDate:d(2026,6,17,19,0),  stage:'Fase de Grupos' },
  { bracketId:68, group:'L', homeTeam:'Ghana',          homeFlag:'🇬🇭', awayTeam:'Panamá',        awayFlag:'🇵🇦', matchDate:d(2026,6,17,22,0),  stage:'Fase de Grupos' },
  { bracketId:69, group:'L', homeTeam:'Inglaterra',     homeFlag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', awayTeam:'Ghana',         awayFlag:'🇬🇭', matchDate:d(2026,6,23,19,0),  stage:'Fase de Grupos' },
  { bracketId:70, group:'L', homeTeam:'Panamá',         homeFlag:'🇵🇦', awayTeam:'Croacia',       awayFlag:'🇭🇷', matchDate:d(2026,6,23,22,0),  stage:'Fase de Grupos' },
  { bracketId:71, group:'L', homeTeam:'Panamá',         homeFlag:'🇵🇦', awayTeam:'Inglaterra',    awayFlag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', matchDate:d(2026,6,27,20,0),  stage:'Fase de Grupos' },
  { bracketId:72, group:'L', homeTeam:'Croacia',        homeFlag:'🇭🇷', awayTeam:'Ghana',         awayFlag:'🇬🇭', matchDate:d(2026,6,27,20,0),  stage:'Fase de Grupos' },
];

// ---------- RONDA DE 32 (bracketIds 73-88) ----------
// homeSlot / awaySlot: "1A"=1°Grupo A, "2A"=2°GrupoA, "B3"=mejor 3° (eligible por bracketId)
const r32 = [
  { bracketId:73, stage:'Ronda de 32', homeSlot:'2A', awaySlot:'2B', matchDate:d(2026,6,28,18,0) },
  { bracketId:74, stage:'Ronda de 32', homeSlot:'1E', awaySlot:'B3', matchDate:d(2026,6,28,22,0) },  // B3 eligible: A,B,C,D,F
  { bracketId:75, stage:'Ronda de 32', homeSlot:'1F', awaySlot:'2C', matchDate:d(2026,6,29,18,0) },
  { bracketId:76, stage:'Ronda de 32', homeSlot:'1C', awaySlot:'2F', matchDate:d(2026,6,29,22,0) },
  { bracketId:77, stage:'Ronda de 32', homeSlot:'1I', awaySlot:'B3', matchDate:d(2026,6,30,18,0) },  // B3 eligible: C,D,F,G,H
  { bracketId:78, stage:'Ronda de 32', homeSlot:'2E', awaySlot:'2I', matchDate:d(2026,6,30,22,0) },
  { bracketId:79, stage:'Ronda de 32', homeSlot:'1A', awaySlot:'B3', matchDate:d(2026,7, 1,18,0) },  // B3 eligible: C,E,F,H,I
  { bracketId:80, stage:'Ronda de 32', homeSlot:'1L', awaySlot:'B3', matchDate:d(2026,7, 1,22,0) },  // B3 eligible: E,H,I,J,K
  { bracketId:81, stage:'Ronda de 32', homeSlot:'1D', awaySlot:'B3', matchDate:d(2026,7, 2,18,0) },  // B3 eligible: B,E,F,I,J
  { bracketId:82, stage:'Ronda de 32', homeSlot:'1G', awaySlot:'B3', matchDate:d(2026,7, 2,22,0) },  // B3 eligible: A,E,H,I,J
  { bracketId:83, stage:'Ronda de 32', homeSlot:'2K', awaySlot:'2L', matchDate:d(2026,7, 3,18,0) },
  { bracketId:84, stage:'Ronda de 32', homeSlot:'1H', awaySlot:'2J', matchDate:d(2026,7, 3,22,0) },
  { bracketId:85, stage:'Ronda de 32', homeSlot:'1B', awaySlot:'B3', matchDate:d(2026,7, 4,18,0) },  // B3 eligible: E,F,G,I,J
  { bracketId:86, stage:'Ronda de 32', homeSlot:'1J', awaySlot:'2H', matchDate:d(2026,7, 4,22,0) },  // ← ARGENTINA si gana grupo
  { bracketId:87, stage:'Ronda de 32', homeSlot:'1K', awaySlot:'B3', matchDate:d(2026,7, 5,18,0) },  // B3 eligible: D,E,I,J,L
  { bracketId:88, stage:'Ronda de 32', homeSlot:'2D', awaySlot:'2G', matchDate:d(2026,7, 5,22,0) },
];

// ---------- OCTAVOS (bracketIds 89-96) ----------
const r16 = [
  { bracketId:89, stage:'Octavos de Final', homeSlot:'W74', awaySlot:'W77', matchDate:d(2026,7, 6,18,0) },
  { bracketId:90, stage:'Octavos de Final', homeSlot:'W73', awaySlot:'W75', matchDate:d(2026,7, 6,22,0) },
  { bracketId:91, stage:'Octavos de Final', homeSlot:'W76', awaySlot:'W78', matchDate:d(2026,7, 7,18,0) },
  { bracketId:92, stage:'Octavos de Final', homeSlot:'W79', awaySlot:'W80', matchDate:d(2026,7, 7,22,0) },
  { bracketId:93, stage:'Octavos de Final', homeSlot:'W83', awaySlot:'W84', matchDate:d(2026,7, 8,18,0) },
  { bracketId:94, stage:'Octavos de Final', homeSlot:'W81', awaySlot:'W82', matchDate:d(2026,7, 8,22,0) },
  { bracketId:95, stage:'Octavos de Final', homeSlot:'W86', awaySlot:'W88', matchDate:d(2026,7, 9,18,0) },  // ← Argentina
  { bracketId:96, stage:'Octavos de Final', homeSlot:'W85', awaySlot:'W87', matchDate:d(2026,7, 9,22,0) },
];

// ---------- CUARTOS (bracketIds 97-100) ----------
const qf = [
  { bracketId:97,  stage:'Cuartos de Final', homeSlot:'W89', awaySlot:'W90', matchDate:d(2026,7,11,18,0) },
  { bracketId:98,  stage:'Cuartos de Final', homeSlot:'W93', awaySlot:'W94', matchDate:d(2026,7,11,22,0) },
  { bracketId:99,  stage:'Cuartos de Final', homeSlot:'W91', awaySlot:'W92', matchDate:d(2026,7,12,18,0) },
  { bracketId:100, stage:'Cuartos de Final', homeSlot:'W95', awaySlot:'W96', matchDate:d(2026,7,12,22,0) }, // ← Argentina
];

// ---------- SEMIS (bracketIds 101-102) ----------
const sf = [
  { bracketId:101, stage:'Semifinal', homeSlot:'W97',  awaySlot:'W98',  matchDate:d(2026,7,15,21,0) },
  { bracketId:102, stage:'Semifinal', homeSlot:'W99',  awaySlot:'W100', matchDate:d(2026,7,16,21,0) }, // ← Argentina
];

// ---------- 3° PUESTO Y FINAL ----------
const finale = [
  { bracketId:103, stage:'Tercer Puesto', homeSlot:'L101', awaySlot:'L102', matchDate:d(2026,7,18,21,0) },
  { bracketId:104, stage:'Final',         homeSlot:'W101', awaySlot:'W102', matchDate:d(2026,7,19,21,0) },
];

// Convertir knockout matches a documentos MongoDB
function makeKnockout(arr) {
  return arr.map(m => ({
    ...m,
    homeTeam: 'TBD',
    awayTeam: 'TBD',
    homeFlag: '🏳️',
    awayFlag: '🏳️',
    group: '',
  }));
}

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB conectado');

  // Insertar todos los partidos
  const allMatches = [
    ...groupMatches,
    ...makeKnockout(r32),
    ...makeKnockout(r16),
    ...makeKnockout(qf),
    ...makeKnockout(sf),
    ...makeKnockout(finale),
  ];

  if (process.argv.includes('--matches-only')) {
    const result = await Match.bulkWrite(
      allMatches.map((match) => ({
        updateOne: {
          filter: { bracketId: match.bracketId },
          update: { $set: match },
          upsert: true,
        },
      }))
    );

    console.log(`Partidos sincronizados: ${allMatches.length}`);
    console.log(`Insertados: ${result.upsertedCount}, actualizados: ${result.modifiedCount}`);
    process.exit(0);
  }

  await User.deleteMany({});
  await Match.deleteMany({});

  // Admin user
  const hashedPass = await bcrypt.hash('admin123', 12);
  await User.create({ name: 'Admin', email: 'admin@prode.com', password: hashedPass, role: 'admin' });

  await Match.insertMany(allMatches);

  console.log(`✅ Seed completado: ${allMatches.length} partidos insertados`);
  console.log('👤 Admin: admin@prode.com / admin123');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
