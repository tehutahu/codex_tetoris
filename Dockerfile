FROM node:18-alpine

WORKDIR /app

# Copy package files for all workspaces
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies for all workspaces
RUN npm install

# Copy client source and build
COPY client/ ./client/
RUN npm run build

# Copy server files
COPY server.js ./
COPY vite.config.js ./

# Expose port and start server
EXPOSE 3000
CMD ["npm", "start"]
