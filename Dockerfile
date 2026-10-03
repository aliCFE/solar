FROM node:20-bookworm

WORKDIR /app

ENV DATABASE_URL=file:/app/data/prod.db

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV DATABASE_URL=file:/app/data/prod.db

EXPOSE 3000

CMD ["sh", "-c", "mkdir -p /app/data && npx prisma db push --skip-generate && npm start"]
