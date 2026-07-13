# syntax=docker/dockerfile:1
FROM node:20-alpine AS base

WORKDIR /app

# Install deps first for layer caching
COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Build the production Next.js app
RUN npm run build

EXPOSE 3000

ENV NODE_ENV=production

# Start the production server
CMD ["npm", "start"]
