FROM node:20-slim

WORKDIR /app

COPY package*.json ./
# Копируем lock-файл отдельно
COPY package-lock.json* ./

# npm ci быстрее и надёжнее
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

COPY . .

CMD ["npm", "run", "dev"]