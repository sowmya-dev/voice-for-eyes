# Build the web app (bundled OpenCV, OCR models, fonts), then serve it with nginx on port 3000.
FROM node:22-alpine AS build
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
# The OCR models get their own layer, so editing the app does not download them again.
COPY web/models.js ./
RUN node models.js
COPY docs/design/voai/tokens.css /src/docs/design/voai/tokens.css
COPY web/ ./
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/web/dist/ /usr/share/nginx/html/
EXPOSE 3000
