# Стадия сборки
FROM eclipse-temurin:21-jdk-jammy as builder

WORKDIR /workspace/app

# 1. Копируем только файлы, необходимые для загрузки зависимостей
COPY mvnw .
COPY .mvn/ .mvn
COPY pom.xml .

# 2. Скачиваем зависимости (кешируемый слой)
RUN ./mvnw dependency:go-offline -B

# 3. Копируем исходный код
COPY src src

# 4. Собираем JAR (кешируется до изменения кода)
RUN ./mvnw clean package -DskipTests -Dmaven.test.skip=true

# Финальная стадия
FROM eclipse-temurin:21-jre-jammy

WORKDIR /app

# 1. Копируем собранный JAR из стадии builder
COPY --from=builder /workspace/app/target/*.jar app.jar

# 2. Оптимизация для контейнеризации
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75"
EXPOSE 8080

# 3. Запуск с параметрами для production
ENTRYPOINT ["sh", "-c", "java ${JAVA_OPTS} -jar /app/app.jar"]