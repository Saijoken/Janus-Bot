# Use Node.js 24 (matching system version)
FROM node:24-slim

# Install ffmpeg and git (required for @discordjs/voice and some npm packages)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user for security with home directory
RUN groupadd -r discordbot && useradd -r -g discordbot -m discordbot

# Set working directory and give ownership to user
WORKDIR /app
RUN chown discordbot:discordbot /app

# Switch to non-root user BEFORE npm install
USER discordbot

# Set npm cache to a writable location
ENV NPM_CONFIG_CACHE=/home/discordbot/.npm

# Copy package files with correct ownership
COPY --chown=discordbot:discordbot package*.json ./

# Install dependencies as non-root user
RUN npm install --only=production --legacy-peer-deps

# Copy application files with correct ownership
COPY --chown=discordbot:discordbot . .

# Set environment to production
ENV NODE_ENV=production

# Run the bot
CMD ["node", "index.js"]
