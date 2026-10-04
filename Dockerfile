FROM node:20-alpine

WORKDIR /app

# Copy package files for reproducible workspace installs
COPY package.json package-lock.json ./
COPY client/package.json ./client/

# Install root and workspace dependencies from the lockfile
RUN npm ci

# Copy client source and build
COPY client/ ./client/
RUN npm run build

# Copy server files
COPY server.js ./

# Expose port and start server
EXPOSE 3000
CMD ["npm", "start"]
