# syntax=docker/dockerfile:1
FROM node:20-alpine AS base

WORKDIR /app

# Install deps first for layer caching
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

COPY frontend/ .

EXPOSE 3000

# `dev` in local compose (hot reload via mounted volume); production build
# uses a separate multi-stage target added in Module 17 (Deployment).
CMD ["npm", "run", "dev"]
