# Use the official Node.js LTS image
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build time (if needed)
ENV VITE_SUPABASE_URL=""
ENV VITE_SUPABASE_PUBLISHABLE_KEY=""

# Build the application
RUN npm run build

# Production image, copy all the files and run nginx
FROM nginx:alpine AS production
WORKDIR /usr/share/nginx/html

# Remove default nginx static assets
RUN rm -rf ./*

# Copy built assets from builder
COPY --from=builder /app/dist .

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

# Development image (optional)
FROM base AS development
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV VITE_SUPABASE_URL=""
ENV VITE_SUPABASE_PUBLISHABLE_KEY=""

EXPOSE 8080
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
