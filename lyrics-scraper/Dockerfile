# Lightweight Puppeteer container for lyrics scraping
FROM ghcr.io/puppeteer/puppeteer:latest

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install --only=production

# Copy application
COPY . .

# Expose port
EXPOSE 3500

# Run as non-root user (puppeteer image already has pptruser)
USER pptruser

CMD ["node", "server.js"]
