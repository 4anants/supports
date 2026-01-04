# Stage 1: Build the React Frontend
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Production Server
FROM node:18-alpine
WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm install --production

# Copy built frontend assets
COPY --from=builder /app/dist ./dist

# Copy backend server file
COPY --from=builder /app/server.js ./

# Expose the application port
EXPOSE 5050

# Start the unified server
CMD ["node", "server.js"]
