FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Cloud Run source deploys are staging-safe by default. A future production
# image must opt in explicitly with --build-arg BUILD_MODE=production.
ARG BUILD_MODE=staging
RUN case "$BUILD_MODE" in production|staging) ;; *) echo "Unsupported BUILD_MODE: $BUILD_MODE" >&2; exit 1 ;; esac \
    && npm run build -- --mode "$BUILD_MODE"

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Keep crawler blocking on staging images only. Production builds must remain
# indexable when this image becomes the production deployment path.
ARG BUILD_MODE=staging
RUN case "$BUILD_MODE" in \
      staging) ;; \
      production) sed -i '/X-Robots-Tag/d' /etc/nginx/conf.d/default.conf ;; \
      *) echo "Unsupported BUILD_MODE: $BUILD_MODE" >&2; exit 1 ;; \
    esac

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
