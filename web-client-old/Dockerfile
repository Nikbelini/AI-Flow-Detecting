FROM node:20-alpine

WORKDIR /app

# Копируем зависимости отдельно для кеширования
COPY package*.json ./
RUN npm install

# Копируем исходный код
COPY . .

# Запускаем dev-сервер Vite
CMD ["npm", "run", "dev"]