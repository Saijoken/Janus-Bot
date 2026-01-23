# Use Node.js LTS version
FROM node:20-slim

# Install ffmpeg (required for @discordjs/voice)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user for security
RUN groupadd -r discordbot && useradd -r -g discordbot discordbot

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

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
