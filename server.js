require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const { startAutobot, generateBatchResources } = require('./cron');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(express.static('public'));
app.use(express.json());

// Initialisation de la table PostgreSQL
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS resources (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        description TEXT,
        content_body TEXT NOT NULL,
        tags JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[BDD] Table "resources" prête.');
  } catch (err) {
    console.error('[BDD] Erreur d\'initialisation :', err.message);
  }
}

// Route API : Récupérer toutes les ressources accumulées
app.get('/api/resources', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM resources ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route d'administration pour déclencher manuellement la génération
app.post('/api/admin/generate', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: 'Accès non autorisé' });
  }
  
  // Lancement en arrière-plan
  generateBatchResources();
  res.json({ message: 'Génération de 10 ressources lancée en arrière-plan.' });
});

app.listen(PORT, async () => {
  await initDB();
  startAutobot();
  console.log(`[AFK CV] Serveur actif sur le port ${PORT}`);
});