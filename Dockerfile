FROM node:20-alpine

# Install build deps for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY src/ ./src/

# Data dir for SQLite
RUN mkdir -p /app/data

EXPOSE 8080

CMD ["node", "src/server.js"]
