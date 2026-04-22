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

# Render sets the PORT env variable and needs the DB_URL for migrations
CMD /nakama/nakama migrate up --database.address $DB_URL && /nakama/nakama --config /nakama/data/local.yml --database.address $DB_URL --socket.port $PORT --console.password $NAKAMA_PASSWORD
