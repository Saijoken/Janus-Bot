# Use Node.js 24 (matching system version)
FROM node:24-slim

# Install ffmpeg and git (required for @discordjs/voice and some npm packages)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user for security
RUN groupadd -r discordbot && useradd -r -g discordbot discordbot

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
# Use npm install instead of npm ci to avoid lock file issues
RUN npm install --only=production --legacy-peer-deps

# Copy application files
COPY . .

# Change ownership to non-root user
RUN chown -R discordbot:discordbot /app

# Switch to non-root user
USER discordbot

# Set environment to production
ENV NODE_ENV=production

# Run the bot
CMD ["node", "index.js"]
