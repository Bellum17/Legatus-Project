// Chargement des variables d'environnement
require('dotenv').config();

// Import de Discord.js et axios pour les requêtes HTTP
const { Client, GatewayIntentBits, Events, SlashCommandBuilder, REST, Routes, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType, AttachmentBuilder } = require('discord.js');
const axios = require('axios');
const express = require('express');
const { createCanvas } = require('canvas');

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

// Stockage des configurations de captcha par serveur
const captchaConfig = new Map();
// Stockage des tentatives échouées par utilisateur
const failedAttempts = new Map();
// Stockage des captchas en cours
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
    const canvas = createCanvas(300, 100);
    const ctx = canvas.getContext('2d');

    // Fond gris
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 300, 100);

    // Ajouter du bruit
    for (let i = 0; i < 100; i++) {
        ctx.fillStyle = `rgba(${Math.random() * 100 + 100}, ${Math.random() * 100 + 100}, ${Math.random() * 100 + 100}, 0.3)`;
        ctx.fillRect(Math.random() * 300, Math.random() * 100, 2, 2);
    }

    // Dessiner le texte
    ctx.font = 'bold 48px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Ajouter une légère rotation et distorsion pour chaque lettre
    const startX = 50;
    for (let i = 0; i < text.length; i++) {
        ctx.save();
        const x = startX + (i * 40);
        const y = 50 + (Math.random() - 0.5) * 10;
        ctx.translate(x, y);
        ctx.rotate((Math.random() - 0.5) * 0.4);
        ctx.fillText(text[i], 0, 0);
        ctx.restore();
    }

    // Ajouter des lignes de bruit
    for (let i = 0; i < 5; i++) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${Math.random() * 0.3 + 0.1})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(Math.random() * 300, Math.random() * 100);
        ctx.lineTo(Math.random() * 300, Math.random() * 100);
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
                            .setName('role')
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
            const role = interaction.options.getRole('role');

            captchaConfig.set(interaction.guildId, {
                channelId: channel.id,
                roleId: role.id,
                enabled: true
            });

            await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ Captcha activé')
                    .setDescription(`Le système de captcha a été activé !\n\n**Salon :** ${channel}\n**Rôle :** ${role}`)
                    .setTimestamp()],
                ephemeral: true
            });

            console.log(`🛡️ Captcha activé sur ${interaction.guild.name} - Salon: ${channel.name} - Rôle: ${role.name}`);

        } else if (subcommand === 'désactiver') {
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
    
    // Vérifier si l'utilisateur a déjà échoué 3 fois
    const attempts = failedAttempts.get(userId) || 0;
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

    // Générer le captcha
    const captchaText = generateCaptcha();
    const captchaImage = createCaptchaImage(captchaText);
    
    // Stocker le captcha
    activeCaptchas.set(userId, {
        text: captchaText,
        guildId: member.guild.id,
        attempts: 0
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

        await channel.send({
            content: `${member}`,
            embeds: [embed],
            files: [attachment]
        });

        console.log(`🛡️ Captcha envoyé à ${member.user.tag} sur ${member.guild.name}`);

    } catch (error) {
        console.error('❌ Erreur lors de l\'envoi du captcha:', error);
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
        // Bonne réponse
        activeCaptchas.delete(message.author.id);
        
        try {
            const member = message.guild.members.cache.get(message.author.id);
            const role = message.guild.roles.cache.get(config.roleId);
            
            if (member && role) {
                await member.roles.add(role);
                
                const successEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ Captcha validé !')
                    .setDescription(`${message.author}, vous avez été vérifié avec succès !\nVous avez maintenant accès au serveur.`)
                    .setTimestamp();

                await message.channel.send({ embeds: [successEmbed] });
                
                console.log(`✅ ${message.author.tag} a réussi le captcha sur ${message.guild.name}`);
            }
        } catch (error) {
            console.error('❌ Erreur lors de l\'attribution du rôle:', error);
        }
    } else {
        // Mauvaise réponse
        captchaData.attempts++;
        
        if (captchaData.attempts >= 3) {
            // Kick après 3 tentatives
            activeCaptchas.delete(message.author.id);
            const totalAttempts = (failedAttempts.get(message.author.id) || 0) + 1;
            failedAttempts.set(message.author.id, totalAttempts);
            
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
            // Nouvelle tentative
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

            await message.channel.send({
                embeds: [retryEmbed],
                files: [attachment]
            });
            
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
