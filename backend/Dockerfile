FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN apk add --no-cache libc6-compat openssl
RUN npm install

COPY tsconfig.json ./
COPY src ./src

RUN npm run build
RUN npx prisma generate

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN apk add --no-cache libc6-compat openssl
RUN npm install --omit=dev
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/uploads

EXPOSE 3001

COPY prod.db ./prod.db
CMD ["sh", "-c", "if [ ! -f ./prisma/prod.db ]; then cp ./prod.db ./prisma/prod.db && echo '✅ Initialized new DB'; fi && npx prisma db push --accept-data-loss && if [ ! -f ./prisma/is_seeded ]; then node dist/seed.js && touch ./prisma/is_seeded && echo '🌱 Database Seeded'; else echo '⚡ Skipping Seed'; fi && npm start"]
