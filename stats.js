// Générateur de graphiques de statistiques
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const fs = require('fs');
const path = require('path');
const { loadImage } = require('canvas');

class StatsGenerator {
    constructor() {
        // Configuration du canvas (taille de l'image)
        this.width = 1000;
        this.height = 400;
        
        // Plugin personnalisé pour dessiner l'icône et le total
        const customLegendPlugin = {
            id: 'customLegend',
            afterDraw: (chart) => {
                const ctx = chart.ctx;
                const chartArea = chart.chartArea;
                
                // Dessiner l'icône (sans texte)
                if (chart.options.plugins.customIcon) {
                    const icon = chart.options.plugins.customIcon;
                    
                    // Calculer les dimensions en préservant le ratio original
                    const originalWidth = icon.width;
                    const originalHeight = icon.height;
                    const targetHeight = 35; // Hauteur souhaitée
                    const ratio = originalWidth / originalHeight;
                    const iconWidth = targetHeight * ratio;
                    const iconHeight = targetHeight;
                    const iconX = 5; // Position X alignée avec les chiffres de l'axe Y
                    const iconY = 10; // Position Y (quelques pixels plus haut)
                    
                    // Dessiner l'image avec ses proportions originales
                    ctx.save();
                    ctx.drawImage(icon, iconX, iconY, iconWidth, iconHeight);
                    ctx.restore();
                }
                
                // Dessiner le total en gris à droite
                if (chart.options.plugins.customTotal) {
                    ctx.fillStyle = '#b0b0b0';
                    ctx.font = '18px Arial';
                    ctx.textAlign = 'right';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(chart.options.plugins.customTotal, chart.width - 20, 35);
                }
            }
        };
        
        // Créer le service de rendu
        this.canvasRenderService = new ChartJSNodeCanvas({
            width: this.width,
            height: this.height,
            backgroundColour: '#36393f' // Couleur de fond Discord
        });
        
        // Enregistrer le plugin personnalisé
        this.customPlugin = customLegendPlugin;
    }

    // Générer un graphique d'activité (comme Statbot)
    async generateActivityChart(stats, iconPath = 'Messages.png') {
        // Préparer les données avec détection automatique du format (heure ou jour)
        const isHourlyData = stats.length > 0 && stats[0].hour !== undefined;
        
        const labels = stats.map(s => {
            if (isHourlyData) {
                // Format heure par heure
                const date = new Date(s.hour);
                return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            } else {
                // Format jour par jour
                const date = new Date(s.date);
                return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
            }
        });
        
        const messageData = stats.map(s => parseInt(s.message_count));
        
        // Calculer le total
        const totalMessages = messageData.reduce((sum, count) => sum + count, 0);
        
        // Charger l'icône si elle existe
        let iconImage = null;
        if (iconPath && fs.existsSync(iconPath)) {
            try {
                iconImage = await loadImage(iconPath);
            } catch (error) {
                console.warn('⚠️ Impossible de charger l\'icône:', error.message);
            }
        }

        // Configuration du graphique
        const configuration = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Messages',
                        data: messageData,
                        borderColor: 'rgb(99, 255, 132)', // Vert comme dans l'image
                        backgroundColor: 'rgba(99, 255, 132, 0.3)',
                        borderWidth: 3,
                        tension: 0.4, // Courbe lisse
                        fill: true, // Remplissage sous la courbe
                        pointRadius: 3, // Points visibles pour petites valeurs
                        pointBackgroundColor: 'rgb(99, 255, 132)',
                        pointBorderColor: 'rgb(99, 255, 132)',
                        pointHoverRadius: 6, // Points au survol
                        pointHoverBackgroundColor: 'rgb(99, 255, 132)',
                    }
                ]
            },
            plugins: [this.customPlugin],
            options: {
                layout: {
                    padding: {
                        top: 50, // Espace pour le titre personnalisé
                        left: 10,
                        right: 10,
                        bottom: 10
                    }
                },
                responsive: false,
                maintainAspectRatio: true,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: false
                    },
                    customTotal: totalMessages.toLocaleString('fr-FR'),
                    customIcon: iconImage
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)',
                            drawBorder: false,
                            lineWidth: 1
                        },
                        ticks: {
                            color: '#8e9297',
                            font: {
                                size: 11
                            },
                            maxRotation: 0,
                            minRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 15
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        beginAtZero: true,
                        min: 0,
                        suggestedMax: Math.max(...messageData) < 5 ? 5 : (Math.max(...messageData) < 10 ? 10 : undefined), // Force un minimum pour la visibilité
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)',
                            drawBorder: false,
                            lineWidth: 1
                        },
                        ticks: {
                            color: '#8e9297',
                            font: {
                                size: 11
                            },
                            stepSize: Math.max(...messageData) < 5 ? 1 : undefined, // Pas de 1 pour très petites valeurs
                            precision: 0 // Toujours afficher des nombres entiers
                        }
                    }
                }
            }
        };

        // Générer l'image
        const imageBuffer = await this.canvasRenderService.renderToBuffer(configuration);
        return imageBuffer;
    }

    // Générer un graphique pour les personnages les plus utilisés
    async generateCharacterChart(topCharacters) {
        const labels = topCharacters.map(c => c.character_name || 'Inconnu');
        const data = topCharacters.map(c => parseInt(c.message_count));

        // Générer des couleurs dynamiques
        const colors = this.generateColors(topCharacters.length);

        const configuration = {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: false,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true,
                        position: 'right',
                        labels: {
                            color: '#ffffff',
                            font: {
                                size: 12,
                                family: 'Arial'
                            },
                            padding: 15
                        }
                    },
                    title: {
                        display: true,
                        text: 'Top Personnages',
                        color: '#ffffff',
                        font: {
                            size: 16
                        }
                    }
                }
            }
        };

        const imageBuffer = await this.canvasRenderService.renderToBuffer(configuration);
        return imageBuffer;
    }

    // Générer des couleurs pour les graphiques
    generateColors(count) {
        const baseColors = [
            '#729bb6', // Couleur principale
            '#63ff84',
            '#ff6384',
            '#36a2eb',
            '#ffce56',
            '#4bc0c0',
            '#9966ff',
            '#ff9f40'
        ];

        const background = [];
        const border = [];

        for (let i = 0; i < count; i++) {
            const color = baseColors[i % baseColors.length];
            background.push(color + '80'); // Ajouter transparence
            border.push(color);
        }

        return { background, border };
    }

    // Générer un graphique simple (barres)
    async generateSimpleBarChart(labels, data, title) {
        const configuration = {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: title,
                    data: data,
                    backgroundColor: 'rgba(114, 155, 182, 0.6)',
                    borderColor: 'rgba(114, 155, 182, 1)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: false,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: title,
                        color: '#ffffff',
                        font: {
                            size: 16
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#b9bbbe',
                            font: {
                                size: 11
                            }
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#b9bbbe',
                            font: {
                                size: 11
                            }
                        }
                    }
                }
            }
        };

        const imageBuffer = await this.canvasRenderService.renderToBuffer(configuration);
        return imageBuffer;
    }
}

module.exports = StatsGenerator;
