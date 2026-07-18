# Stage 1: Build Next.js application
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build application
RUN npm run build

# Stage 2: Final runner
FROM node:18-alpine

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.mjs ./

EXPOSE 3000

CMD ["npm", "run", "start"]
