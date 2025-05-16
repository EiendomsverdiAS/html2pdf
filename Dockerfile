# Filename: Dockerfile
FROM ghcr.io/puppeteer/puppeteer:24.6.0

USER root

RUN apt-get update && apt-get install -y ghostscript=10.0.0~dfsg-11+* && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy resources
COPY package.json ./package.json
COPY ./src ./src
COPY .puppeteerrc.cjs ./.puppeteerrc.cjs

# Install NPM dependencies for function
RUN npm install

# Verify Puppeteer and Ghostscript installation
RUN node -e "console.log('Puppeteer version:', require('puppeteer/package.json').version)" && \
    ghostscript --version

ENV NODE_ENV production
ENV NODE_OPTIONS --max-old-space-size=12288

RUN chown pptruser:pptruser ./package.json
RUN chown pptruser:pptruser ./src/server.js
RUN chown pptruser:pptruser ./.puppeteerrc.cjs

# Expose app
EXPOSE 8000

USER pptruser

# Run app
CMD ["npm", "start"]