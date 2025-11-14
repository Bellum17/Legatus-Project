// Chargement des variables d'environnement
require('dotenv').config();

// Import de Discord.js et axios pour les requêtes HTTP
const { Client, GatewayIntentBits, Events, SlashCommandBuilder, REST, Routes, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType, AttachmentBuilder } = require('discord.js');
const axios = require('axios');
const express = require('express');
const { createCanvas, registerFont } = require('canvas');
const { Pool } = require('pg');

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

// Configuration PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Fonction pour initialiser la base de données
async function initDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS captcha_config (
                guild_id VARCHAR(20) PRIMARY KEY,
                channel_id VARCHAR(20) NOT NULL,
                captcha_role_id VARCHAR(20) NOT NULL,
                verified_role_id VARCHAR(20) NOT NULL,
                enabled BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS failed_attempts (
                user_id VARCHAR(20) PRIMARY KEY,
                attempts INTEGER DEFAULT 0,
                last_attempt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS active_captchas (
                user_id VARCHAR(20) PRIMARY KEY,
                guild_id VARCHAR(20) NOT NULL,
                captcha_text VARCHAR(10) NOT NULL,
                attempts INTEGER DEFAULT 0,
                message_id VARCHAR(20),
                channel_id VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log('✅ Base de données PostgreSQL initialisée');
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation de la base de données:', error);
    }
}

// Stockage temporaire en cache (pour performance)
const captchaConfig = new Map();
const failedAttempts = new Map();
const activeCaptchas = new Map();

// Création du client Discord avec les intentions de base
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Fonction pour générer un captcha
function generateCaptcha() {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let text = '';
    for (let i = 0; i < 6; i++) {
        text += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return text;
}

// Fonction pour créer l'image du captcha
function createCaptchaImage(text) {
    const canvas = createCanvas(400, 150);
    const ctx = canvas.getContext('2d');

    // Fond gris
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 400, 150);

    // Ajouter du bruit de fond
    for (let i = 0; i < 150; i++) {
        ctx.fillStyle = `rgba(${Math.random() * 100 + 100}, ${Math.random() * 100 + 100}, ${Math.random() * 100 + 100}, 0.3)`;
        ctx.fillRect(Math.random() * 400, Math.random() * 150, 3, 3);
    }

    // Configuration du texte - Utiliser plusieurs polices en fallback
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Dessiner chaque caractère avec rotation et position aléatoire
    const spacing = 60;
    const startX = 70;
    
    for (let i = 0; i < text.length; i++) {
        ctx.save();
        
        // Position avec variation aléatoire
        const x = startX + (i * spacing);
        const y = 75 + (Math.random() - 0.5) * 15;
        
        // Rotation aléatoire
        ctx.translate(x, y);
        ctx.rotate((Math.random() - 0.5) * 0.3);
        
        // Taille de police variable avec plusieurs polices en fallback
        const fontSize = 55 + Math.random() * 10;
        // Essayer plusieurs polices courantes qui devraient être disponibles
        ctx.font = `bold ${fontSize}px "DejaVu Sans", "Arial", "Helvetica", "sans-serif"`;
        
        // Dessiner le caractère avec contour pour plus de visibilité
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.strokeText(text[i], 0, 0);
        ctx.fillText(text[i], 0, 0);
        
        ctx.restore();
    }

    // Ajouter des lignes de bruit
    for (let i = 0; i < 6; i++) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${Math.random() * 0.4 + 0.1})`;
        ctx.lineWidth = 2 + Math.random() * 2;
        ctx.beginPath();
        ctx.moveTo(Math.random() * 400, Math.random() * 150);
        ctx.bezierCurveTo(
            Math.random() * 400, Math.random() * 150,
            Math.random() * 400, Math.random() * 150,
            Math.random() * 400, Math.random() * 150
        );
        ctx.stroke();
    }

    return canvas.toBuffer();
}

// Événement déclenché quand le bot est prêt
client.once(Events.ClientReady, async (readyClient) => {
    console.log(`✅ Bot connecté en tant que ${readyClient.user.tag}`);
    console.log(`🤖 Bot actif sur ${readyClient.guilds.cache.size} serveur(s)`);
    
    // Définir le statut du bot
    client.user.setActivity('les logs du serveur \u{1F6E1}\uFE0F', { type: 3 }); // 3 = WATCHING (emoji bouclier)
    console.log('\u{1F6E1}\uFE0F Statut défini : "Regarde les logs du serveur"');

    // Initialiser la base de données
    await initDatabase();
    
    // Charger les configurations depuis la base de données
    try {
        const result = await pool.query('SELECT * FROM captcha_config WHERE enabled = true');
        for (const row of result.rows) {
            captchaConfig.set(row.guild_id, {
                channelId: row.channel_id,
                captchaRoleId: row.captcha_role_id,
                verifiedRoleId: row.verified_role_id,
                enabled: row.enabled
            });
        }
        console.log(`📊 ${result.rows.length} configuration(s) de captcha chargée(s)`);
    } catch (error) {
        console.error('❌ Erreur lors du chargement des configurations:', error);
    }

    // Enregistrer les commandes slash
    const commands = [
        new SlashCommandBuilder()
            .setName('captcha')
            .setDescription('Gérer le système de captcha')
            .addSubcommand(subcommand =>
                subcommand
                    .setName('activer')
                    .setDescription('Activer le système de captcha')
                    .addChannelOption(option =>
                        option
                            .setName('salon')
                            .setDescription('Le salon où envoyer le captcha')
                            .setRequired(true)
                            .addChannelTypes(ChannelType.GuildText))
                    .addRoleOption(option =>
                        option
                            .setName('role_captcha')
                            .setDescription('Le rôle de captcha (donné aux nouveaux membres)')
                            .setRequired(true))
                    .addRoleOption(option =>
                        option
                            .setName('role_vérifié')
                            .setDescription('Le rôle à donner après validation du captcha')
                            .setRequired(true)))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('désactiver')
                    .setDescription('Désactiver le système de captcha'))
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    ].map(command => command.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log('🔄 Enregistrement des commandes slash...');
        await rest.put(
            Routes.applicationCommands(readyClient.user.id),
            { body: commands }
        );
        console.log('✅ Commandes slash enregistrées avec succès');
    } catch (error) {
        console.error('❌ Erreur lors de l\'enregistrement des commandes:', error);
    }
});

// Gestion des interactions (commandes slash)
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'captcha') {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'activer') {
            const channel = interaction.options.getChannel('salon');
            const captchaRole = interaction.options.getRole('role_captcha');
            const verifiedRole = interaction.options.getRole('role_vérifié');

            // Sauvegarder dans PostgreSQL
            try {
                await pool.query(`
                    INSERT INTO captcha_config (guild_id, channel_id, captcha_role_id, verified_role_id, enabled)
                    VALUES ($1, $2, $3, $4, true)
                    ON CONFLICT (guild_id)
                    DO UPDATE SET 
                        channel_id = $2,
                        captcha_role_id = $3,
                        verified_role_id = $4,
                        enabled = true
                `, [interaction.guildId, channel.id, captchaRole.id, verifiedRole.id]);
                
                console.log('💾 Configuration sauvegardée dans PostgreSQL');
            } catch (error) {
                console.error('❌ Erreur lors de la sauvegarde dans PostgreSQL:', error);
            }

            // Mettre à jour le cache
            captchaConfig.set(interaction.guildId, {
                channelId: channel.id,
                captchaRoleId: captchaRole.id,
                verifiedRoleId: verifiedRole.id,
                enabled: true
            });

            await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ Captcha activé')
                    .setDescription(`Le système de captcha a été activé !\n\n**Salon :** ${channel}\n**Rôle captcha :** ${captchaRole}\n**Rôle vérifié :** ${verifiedRole}`)
                    .setTimestamp()],
                ephemeral: true
            });

            console.log(`🛡️ Captcha activé sur ${interaction.guild.name} - Salon: ${channel.name} - Rôle captcha: ${captchaRole.name} - Rôle vérifié: ${verifiedRole.name}`);

        } else if (subcommand === 'désactiver') {
            // Désactiver dans PostgreSQL
            try {
                await pool.query(`
                    UPDATE captcha_config
                    SET enabled = false
                    WHERE guild_id = $1
                `, [interaction.guildId]);
                
                console.log('💾 Configuration désactivée dans PostgreSQL');
            } catch (error) {
                console.error('❌ Erreur lors de la désactivation dans PostgreSQL:', error);
            }

            // Supprimer du cache
            captchaConfig.delete(interaction.guildId);

            await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ Captcha désactivé')
                    .setDescription('Le système de captcha a été désactivé.')
                    .setTimestamp()],
                ephemeral: true
            });

            console.log(`🛡️ Captcha désactivé sur ${interaction.guild.name}`);
        }
    }
});

// Gestion des nouveaux membres
client.on(Events.GuildMemberAdd, async (member) => {
    const config = captchaConfig.get(member.guild.id);
    if (!config || !config.enabled) return;

    const userId = member.user.id;
    
    // Vérifier si l'utilisateur a déjà échoué 3 fois dans la base de données
    let attempts = 0;
    try {
        const result = await pool.query('SELECT attempts FROM failed_attempts WHERE user_id = $1', [userId]);
        if (result.rows.length > 0) {
            attempts = result.rows[0].attempts;
            failedAttempts.set(userId, attempts); // Mettre à jour le cache
        }
    } catch (error) {
        console.error('❌ Erreur lors de la récupération des tentatives:', error);
    }
    
    if (attempts >= 3) {
        try {
            await member.ban({ reason: 'Échec du captcha 3 fois' });
            console.log(`🚫 ${member.user.tag} banni définitivement après 3 échecs`);
            return;
        } catch (error) {
            console.error('❌ Erreur lors du bannissement:', error);
        }
    }

    const channel = member.guild.channels.cache.get(config.channelId);
    if (!channel) return;

    // Attribuer le rôle de captcha au membre
    try {
        const captchaRole = member.guild.roles.cache.get(config.captchaRoleId);
        if (captchaRole) {
            await member.roles.add(captchaRole);
            console.log(`🔐 Rôle de captcha attribué à ${member.user.tag}`);
        }
    } catch (error) {
        console.error('❌ Erreur lors de l\'attribution du rôle de captcha:', error);
    }

    // Générer le captcha
    const captchaText = generateCaptcha();
    const captchaImage = createCaptchaImage(captchaText);
    
    // Stocker le captcha dans le cache
    activeCaptchas.set(userId, {
        text: captchaText,
        guildId: member.guild.id,
        attempts: 0,
        messageId: null,
        channelId: null
    });

    try {
        const attachment = new AttachmentBuilder(captchaImage, { name: 'captcha.png' });
        
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🛡️ Vérification de sécurité')
            .setDescription(`Bienvenue ${member} !\n\nPour accéder au serveur, veuillez résoudre le captcha ci-dessous.\n\n**Instructions :**\n• Regardez l'image et entrez le code visible\n• Vous avez 3 tentatives\n• Le code contient 6 caractères\n• Tapez simplement le code dans ce salon`)
            .setImage('attachment://captcha.png')
            .setFooter({ text: `Tentative ${attempts + 1}/3 avant bannissement` })
            .setTimestamp();

        const captchaMessage = await channel.send({
            content: `${member}`,
            embeds: [embed],
            files: [attachment]
        });

        // Mettre à jour le captcha avec les IDs
        const captchaData = activeCaptchas.get(userId);
        captchaData.messageId = captchaMessage.id;
        captchaData.channelId = channel.id;

        // Sauvegarder le captcha actif dans PostgreSQL
        try {
            await pool.query(`
                INSERT INTO active_captchas (user_id, guild_id, captcha_text, attempts, message_id, channel_id)
                VALUES ($1, $2, $3, 0, $4, $5)
                ON CONFLICT (user_id)
                DO UPDATE SET 
                    guild_id = $2,
                    captcha_text = $3,
                    attempts = 0,
                    message_id = $4,
                    channel_id = $5,
                    created_at = CURRENT_TIMESTAMP
            `, [userId, member.guild.id, captchaText, captchaMessage.id, channel.id]);
        } catch (error) {
            console.error('❌ Erreur lors de la sauvegarde du captcha:', error);
        }

        console.log(`🛡️ Captcha envoyé à ${member.user.tag} sur ${member.guild.name}`);

    } catch (error) {
        console.error('❌ Erreur lors de l\'envoi du captcha:', error);
    }
});

// Gestion des membres qui quittent
client.on(Events.GuildMemberRemove, async (member) => {
    const userId = member.user.id;
    const captchaData = activeCaptchas.get(userId);
    
    if (captchaData) {
        // Supprimer le message de captcha
        try {
            const channel = member.guild.channels.cache.get(captchaData.channelId);
            if (channel && captchaData.messageId) {
                const message = await channel.messages.fetch(captchaData.messageId);
                if (message) {
                    await message.delete();
                    console.log(`🗑️ Message de captcha supprimé pour ${member.user.tag}`);
                }
            }
        } catch (error) {
            console.error('❌ Erreur lors de la suppression du message de captcha:', error);
        }
        
        // Retirer le captcha actif
        activeCaptchas.delete(userId);
        console.log(`🚪 ${member.user.tag} a quitté le serveur, captcha nettoyé`);
    }
});

// Gestion des messages pour le captcha
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    
    const captchaData = activeCaptchas.get(message.author.id);
    if (!captchaData) return;

    const config = captchaConfig.get(captchaData.guildId);
    if (!config || message.channel.id !== config.channelId) return;

    const userAnswer = message.content.toUpperCase().trim();
    
    try {
        await message.delete();
    } catch (error) {
        console.error('❌ Erreur lors de la suppression du message:', error);
    }

    if (userAnswer === captchaData.text) {
        // Bonne réponse - Supprimer le message de captcha original
        try {
            if (captchaData.messageId) {
                const captchaMessage = await message.channel.messages.fetch(captchaData.messageId);
                if (captchaMessage) {
                    await captchaMessage.delete();
                }
            }
        } catch (error) {
            console.error('❌ Erreur lors de la suppression du message de captcha:', error);
        }
        
        // Supprimer du cache et de la base de données
        activeCaptchas.delete(message.author.id);
        
        try {
            await pool.query('DELETE FROM active_captchas WHERE user_id = $1', [message.author.id]);
        } catch (error) {
            console.error('❌ Erreur lors de la suppression du captcha de la BDD:', error);
        }
        
        try {
            const member = message.guild.members.cache.get(message.author.id);
            const captchaRole = message.guild.roles.cache.get(config.captchaRoleId);
            const verifiedRole = message.guild.roles.cache.get(config.verifiedRoleId);
            
            if (member) {
                // Retirer le rôle de captcha
                if (captchaRole) {
                    await member.roles.remove(captchaRole);
                }
                
                // Ajouter le rôle vérifié
                if (verifiedRole) {
                    await member.roles.add(verifiedRole);
                }
                
                const successEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ Captcha validé !')
                    .setDescription(`${message.author}, vous avez été vérifié avec succès !\nVous avez maintenant accès au serveur.`)
                    .setTimestamp();

                const successMessage = await message.channel.send({ embeds: [successEmbed] });
                
                // Supprimer le message de succès après 10 secondes
                setTimeout(async () => {
                    try {
                        await successMessage.delete();
                    } catch (err) {
                        console.error('❌ Erreur lors de la suppression du message de succès:', err);
                    }
                }, 10000);
                
                console.log(`✅ ${message.author.tag} a réussi le captcha sur ${message.guild.name}`);
            }
        } catch (error) {
            console.error('❌ Erreur lors de l\'attribution des rôles:', error);
        }
    } else {
        // Mauvaise réponse
        captchaData.attempts++;
        
        if (captchaData.attempts >= 3) {
            // Kick après 3 tentatives
            activeCaptchas.delete(message.author.id);
            
            // Supprimer de la base de données
            try {
                await pool.query('DELETE FROM active_captchas WHERE user_id = $1', [message.author.id]);
            } catch (error) {
                console.error('❌ Erreur lors de la suppression du captcha de la BDD:', error);
            }
            
            const totalAttempts = (failedAttempts.get(message.author.id) || 0) + 1;
            failedAttempts.set(message.author.id, totalAttempts);
            
            // Sauvegarder les tentatives échouées dans PostgreSQL
            try {
                await pool.query(`
                    INSERT INTO failed_attempts (user_id, attempts, last_attempt)
                    VALUES ($1, $2, CURRENT_TIMESTAMP)
                    ON CONFLICT (user_id)
                    DO UPDATE SET 
                        attempts = $2,
                        last_attempt = CURRENT_TIMESTAMP
                `, [message.author.id, totalAttempts]);
                
                console.log(`💾 Tentatives échouées sauvegardées: ${totalAttempts}/3`);
            } catch (error) {
                console.error('❌ Erreur lors de la sauvegarde des tentatives:', error);
            }
            
            try {
                const member = message.guild.members.cache.get(message.author.id);
                
                const failEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ Échec du captcha')
                    .setDescription(`${message.author}, vous avez épuisé vos 3 tentatives.\nVous allez être expulsé du serveur.\n\n${totalAttempts >= 3 ? '**Attention :** Si vous revenez, vous serez banni définitivement.' : `**Tentatives totales :** ${totalAttempts}/3`}`)
                    .setTimestamp();

                await message.channel.send({ embeds: [failEmbed] });
                
                if (member) {
                    await member.kick('Échec du captcha après 3 tentatives');
                    console.log(`🚫 ${message.author.tag} expulsé après 3 tentatives ratées (Total: ${totalAttempts}/3)`);
                }
            } catch (error) {
                console.error('❌ Erreur lors de l\'expulsion:', error);
            }
        } else {
            // Nouvelle tentative - Supprimer l'ancien message de captcha
            try {
                if (captchaData.messageId) {
                    const oldMessage = await message.channel.messages.fetch(captchaData.messageId);
                    if (oldMessage) {
                        await oldMessage.delete();
                    }
                }
            } catch (error) {
                console.error('❌ Erreur lors de la suppression de l\'ancien captcha:', error);
            }
            
            const captchaText = generateCaptcha();
            const captchaImage = createCaptchaImage(captchaText);
            captchaData.text = captchaText;
            
            const attachment = new AttachmentBuilder(captchaImage, { name: 'captcha.png' });
            
            const retryEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('❌ Code incorrect')
                .setDescription(`${message.author}, le code est incorrect.\n\nVeuillez réessayer avec le nouveau captcha ci-dessous.\n\n**Tentatives restantes :** ${3 - captchaData.attempts}`)
                .setImage('attachment://captcha.png')
                .setTimestamp();

            const newCaptchaMessage = await message.channel.send({
                content: `${message.author}`,
                embeds: [retryEmbed],
                files: [attachment]
            });
            
            // Mettre à jour l'ID du nouveau message
            captchaData.messageId = newCaptchaMessage.id;
            
            // Mettre à jour dans PostgreSQL
            try {
                await pool.query(`
                    UPDATE active_captchas
                    SET captcha_text = $1, attempts = $2, message_id = $3
                    WHERE user_id = $4
                `, [captchaText, captchaData.attempts, newCaptchaMessage.id, message.author.id]);
            } catch (error) {
                console.error('❌ Erreur lors de la mise à jour du captcha dans la BDD:', error);
            }
            
            console.log(`⚠️ ${message.author.tag} a raté une tentative (${captchaData.attempts}/3)`);
        }
    }
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
