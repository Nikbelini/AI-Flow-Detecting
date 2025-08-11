# Стадия сборки
FROM maven:3.8.8-eclipse-temurin-21 AS builder

WORKDIR /app

# 1. Копируем только POM файл сначала (для кеширования зависимостей)
COPY pom.xml .
# 2. Скачиваем все зависимости (отдельный кешируемый слой)
RUN mvn dependency:go-offline -B

# 3. Копируем исходный код
COPY src ./src

# 4. Собираем приложение (без тестов)
RUN mvn clean package -DskipTests -Dmaven.test.skip=true

# Финальная стадия
FROM eclipse-temurin:21-jre-jammy

WORKDIR /app

# Копируем собранный JAR
COPY --from=builder /app/target/*.jar app.jar

# Оптимизация для контейнеров
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75"
EXPOSE 8080

# Запуск приложения
ENTRYPOINT ["sh", "-c", "java ${JAVA_OPTS} -jar app.jar"]