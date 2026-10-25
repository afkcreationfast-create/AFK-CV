const cron = require('node-cron');
const { Pool } = require('pg');
const Groq = require('groq-sdk');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const apiKeys = [
  process.env.GROQ_API_KEY_PRIMARY,
  process.env.GROQ_API_KEY_SECONDARY
].filter(Boolean);

async function fetchWithFallback(promptSystem, promptUser) {
  let lastError = null;

  for (let i = 0; i < apiKeys.length; i++) {
    try {
      const groq = new Groq({ apiKey: apiKeys[i] });
      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: promptSystem },
          { role: 'user', content: promptUser }
        ],
        model: 'llama3-8b-8192',
        response_format: { type: 'json_object' }
      });
      return JSON.parse(completion.choices[0].message.content);
    } catch (err) {
      console.warn(`[AUTOBOT] Clé API #${i + 1} indisponible. Tentative suivante...`);
      lastError = err;
    }
  }
  throw new Error(`Toutes les clés d'API ont échoué : ${lastError?.message}`);
}

async function generateBatchResources() {
  console.log('[AUTOBOT] Début du lot quotidien de 10 ressources...');
  const categories = ['moderne', 'classique', 'etudiant', 'creatif', 'minimaliste'];

  for (let i = 1; i <= 10; i++) {
    try {
      const category = categories[i % categories.length];
      const promptSystem = `Tu es l'IA autonome de AFK Création & Marketing. Génère un modèle ou conseil professionnel complet au format JSON avec les clés : "title", "category", "description", "content_body", "tags".`;
      const promptUser = `Génère une ressource unique N°${i} pour la catégorie "${category}" (Modèle de CV, lettre de motivation ou conseils d'entretien). Détaillé et prêt à l'emploi.`;

      const data = await fetchWithFallback(promptSystem, promptUser);

      const query = `
        INSERT INTO resources (title, category, description, content_body, tags, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
      `;
      
      await pool.query(query, [
        data.title,
        data.category || category,
        data.description,
        data.content_body,
        JSON.stringify(data.tags || ['AFK', 'Pro'])
      ]);

      console.log(`[AUTOBOT] (${i}/10) Créé avec succès : "${data.title}"`);
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error(`[AUTOBOT] Erreur item #${i} :`, error.message);
    }
  }
  console.log('[AUTOBOT] Lot quotidien terminé !');
}

function startAutobot() {
  cron.schedule('0 2 * * *', () => {
    generateBatchResources();
  });
  console.log('[AUTOBOT] Planificateur autonome démarré.');
}

module.exports = { startAutobot, generateBatchResources };