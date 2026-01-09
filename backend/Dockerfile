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

CMD ["sh", "-c", "touch ./prod.db && npx prisma db push && npx tsx src/seed.ts && npm start"]
