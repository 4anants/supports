FROM node:20-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache libc6-compat openssl

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including dev for building)
RUN npm install

# Copy source
COPY tsconfig.json ./
COPY src ./src

# Generate Prisma Client
RUN npx prisma generate

# Try to build and show errors if it fails
RUN npx tsc || (echo "=== TYPESCRIPT ERROR ===" && cat tsconfig.json && ls -la src/ && exit 1)

# Create uploads directory
RUN mkdir -p /app/uploads

EXPOSE 3001

# Startup
COPY prod.db ./prod.db
CMD ["sh", "-c", "if [ ! -f ./prisma/prod.db ]; then cp ./prod.db ./prisma/prod.db && echo '✅ Initialized new DB'; fi && npx prisma db push --accept-data-loss && if [ ! -f ./prisma/is_seeded ]; then node dist/seed.js && touch ./prisma/is_seeded && echo '🌱 Database Seeded'; else echo '⚡ Skipping Seed'; fi && npm start"]
