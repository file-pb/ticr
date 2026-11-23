# Statický web. Žádný Node v běhu, žádná databáze, žádný stav na disku.
# Kontext buildu musí být kořen repozitáře — obraz potřebuje i deploy/nginx/.
# (Při nasazení `filip` to byla první ze tří vad, které našel až ostrý běh.)

FROM node:22.11.0-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
RUN npm run build

FROM nginx:1.27.3-alpine
# Bod 7 kontraktu: obraz v sobě nese commit, ze kterého je. Bez toho ani
# /health, ani HTTP 200 nedokazují, že neběží verze z minula.
ARG VERZE=neznama
ENV VERZE=${VERZE}
ENV PORT=8080

COPY deploy/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
RUN printf '%s\n' "$VERZE" > /usr/share/nginx/html/verze.txt

EXPOSE 8080
