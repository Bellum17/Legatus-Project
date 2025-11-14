// Générateur de graphiques de statistiques
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

class StatsGenerator {
    constructor() {
        // Configuration du canvas (taille de l'image)
        this.width = 1000;
        this.height = 400;
        
        // Créer le service de rendu
        this.canvasRenderService = new ChartJSNodeCanvas({
            width: this.width,
            height: this.height,
            backgroundColour: '#36393f' // Couleur de fond Discord
        });
    }

    // Générer un graphique d'activité (comme Statbot)
    async generateActivityChart(stats) {
        // Préparer les données
        const labels = stats.map(s => {
            const date = new Date(s.date);
            return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        });
        
        const messageData = stats.map(s => parseInt(s.message_count));
        const userData = stats.map(s => parseInt(s.unique_users));

        // Configuration du graphique
        const configuration = {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        type: 'bar',
                        label: 'Messages',
                        data: messageData,
                        backgroundColor: 'rgba(114, 155, 182, 0.6)', // Couleur #729bb6 avec transparence
                        borderColor: 'rgba(114, 155, 182, 1)',
                        borderWidth: 1,
                        yAxisID: 'y',
                    },
                    {
                        type: 'line',
                        label: 'Contributeurs',
                        data: userData,
                        borderColor: 'rgb(99, 255, 132)',
                        backgroundColor: 'rgba(99, 255, 132, 0.2)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        yAxisID: 'y1',
                    }
                ]
            },
            options: {
                responsive: false,
                maintainAspectRatio: true,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#ffffff',
                            font: {
                                size: 14,
                                family: 'Arial'
                            }
                        }
                    },
                    title: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#b9bbbe',
                            font: {
                                size: 11
                            },
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#b9bbbe',
                            font: {
                                size: 11
                            }
                        },
                        title: {
                            display: true,
                            text: 'Messages',
                            color: '#b9bbbe'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: {
                            drawOnChartArea: false,
                        },
                        ticks: {
                            color: '#b9bbbe',
                            font: {
                                size: 11
                            }
                        },
                        title: {
                            display: true,
                            text: 'Contributeurs',
                            color: '#b9bbbe'
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
