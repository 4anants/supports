FROM node:20-alpine

WORKDIR /app

# 1. Copy Package Files
COPY package*.json ./
COPY prisma ./prisma/

# 2. Install Dependencies (Prod only)
RUN apk add --no-cache libc6-compat openssl
RUN npm install --omit=dev

# 3. Copy Pre-built App
COPY dist ./dist

# 4. Generate Prisma Client (Layout for Linux)
RUN npx prisma generate

# 5. Create Uploads Directory
RUN mkdir -p /app/uploads

EXPOSE 3001

# 6. Startup Command
COPY prod.db ./prod.db
CMD ["sh", "-c", "if [ ! -f ./prisma/prod.db ]; then cp ./prod.db ./prisma/prod.db && echo '✅ Initialized new DB'; fi && npx prisma db push --accept-data-loss && if [ ! -f ./prisma/is_seeded ]; then node dist/seed.js && touch ./prisma/is_seeded && echo '🌱 Database Seeded'; else echo '⚡ Skipping Seed'; fi && npm start"]
