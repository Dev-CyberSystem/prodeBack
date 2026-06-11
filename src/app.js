require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const matchRoutes = require('./routes/matches');
const predictionRoutes = require('./routes/predictions');
const leaderboardRoutes = require('./routes/leaderboard');
const standingsRoutes = require('./routes/standings');
const syncRoutes = require('./routes/sync');
const userRoutes = require('./routes/users');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/standings', standingsRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/users', userRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'Arriba Argentina!' }));

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB conectado');
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
  })
  .catch((err) => {
    console.error('Error conectando a MongoDB:', err.message);
    process.exit(1);
  });

module.exports = app;
