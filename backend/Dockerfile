FROM node:alpine AS builder
WORKDIR /backend
COPY package*.json ./
RUN npm install
COPY tsconfig.json rollup.config.mjs ./
COPY src ./src
RUN npm run build

FROM heroiclabs/nakama:3.21.1
COPY --from=builder /backend/build/*.js /nakama/data/modules/build/
COPY local.yml /nakama/data/
