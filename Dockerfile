FROM node:18-alpine

WORKDIR /app

# Copy package files only (package-lock.json is excluded by .dockerignore)
COPY package.json ./
COPY client/package.json ./client/

# Install all dependencies: root + workspaces
RUN npm install
RUN npm install --workspaces

# Copy client source and build
COPY client/ ./client/
RUN npm run build

# Copy server files
COPY server.js ./
COPY vite.config.js ./

# Expose port and start server
EXPOSE 3000
CMD ["npm", "start"]
