// Chargement des variables d'environnement
require('dotenv').config();

// Import de Discord.js et axios pour les requêtes HTTP
const { Client, GatewayIntentBits, Events, SlashCommandBuilder, REST, Routes, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
const express = require('express');

// Configuration du serveur Express pour Railway
const app = express();
const PORT = process.env.PORT || 3000;

// Route de santé pour Railway
app.get('/', (req, res) => {
    res.json({
        status: 'Bot Discord actif',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        guilds: client.guilds ? client.guilds.cache.size : 0
    });
});

// Route de santé
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Démarrer le serveur Express
app.listen(PORT, () => {
    console.log(`🌐 Serveur web démarré sur le port ${PORT}`);
});

// Création du client Discord avec les intentions de base
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Événement déclenché quand le bot est prêt
client.once(Events.ClientReady, async (readyClient) => {
    console.log(`✅ Bot connecté en tant que ${readyClient.user.tag}`);
    console.log(`🤖 Bot actif sur ${readyClient.guilds.cache.size} serveur(s)`);
    
    // Définir le statut du bot
    client.user.setActivity('les logs du serveur \u{1F6E1}\uFE0F', { type: 3 }); // 3 = WATCHING (emoji bouclier)
    console.log('\u{1F6E1}\uFE0F Statut défini : "Regarde les logs du serveur"');
});

// Gestion des erreurs
client.on(Events.Error, (error) => {
    console.error('❌ Erreur Discord:', error);
});

// Gestion de la déconnexion
client.on(Events.Disconnect, () => {
    console.log('⚠️ Bot déconnecté');
});

// Gestion des erreurs non capturées
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promesse rejetée non gérée:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Exception non capturée:', error);
    process.exit(1);
});

// Vérification de la présence du token
if (!process.env.DISCORD_TOKEN) {
    console.error('❌ ERREUR: Variable d\'environnement DISCORD_TOKEN manquante');
    console.error('📝 Assurez-vous d\'avoir configuré la variable DISCORD_TOKEN sur Railway');
    process.exit(1);
}

// Connexion du bot avec le token
client.login(process.env.DISCORD_TOKEN)
    .then(() => {
        console.log('🚀 Tentative de connexion...');
    })
    .catch((error) => {
        console.error('❌ Erreur lors de la connexion:', error);
        console.error('🔍 Vérifiez que votre token Discord est valide');
        process.exit(1);
    });

// Gestion de l'arrêt propre du bot
process.on('SIGINT', () => {
    console.log('\n⏹️ Arrêt du bot...');
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n⏹️ Arrêt du bot...');
    client.destroy();
    process.exit(0);
});
