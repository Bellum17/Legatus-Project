# Utiliser Node.js LTS
FROM node:20-alpine

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances en production
RUN npm ci --omit=dev

# Copier le reste des fichiers
COPY . .

# Exposer le port
EXPOSE 3000

# Commande de démarrage
CMD ["node", "bot.js"]
