FROM node:alpine AS builder
WORKDIR /backend
COPY package*.json ./
RUN npm install
COPY tsconfig.json rollup.config.mjs ./
COPY src ./src
RUN npm run build

FROM heroiclabs/nakama:3.21.1
COPY --from=builder /backend/build/*.js /nakama/data/modules/build/
COPY local.yml.example /nakama/data/local.yml

# Override the base image entrypoint to evaluate environment variables properly
ENTRYPOINT ["/bin/sh", "-ecx", "/nakama/nakama migrate up --database.address $DB_URL && exec /nakama/nakama --config /nakama/data/local.yml --database.address $DB_URL --socket.port $PORT --console.password $NAKAMA_PASSWORD"]
