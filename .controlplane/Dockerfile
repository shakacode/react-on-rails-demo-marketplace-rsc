# syntax=docker/dockerfile:1
FROM ruby:3.3.0-slim AS base

ENV NODE_VERSION=20.19.5
ENV PNPM_VERSION=9.15.2

# Install system dependencies
RUN apt-get update && apt-get install -y \
      build-essential \
      curl \
      git \
      openssh-client \
      libpq-dev \
      postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm and yarn (yarn is needed to "prepare" git-hosted packages
# whose own scripts shell out to yarn — e.g. react-on-rails-rsc)
RUN npm install -g pnpm@$PNPM_VERSION yarn

# Install bundler
RUN gem install bundler

# ============================================================
# Build stage - install deps and compile assets
# ============================================================
FROM base AS build

WORKDIR /app

# Install Ruby gems (production only)
COPY Gemfile Gemfile.lock ./
RUN bundle config set without 'development test' && \
    bundle install --jobs=4 --retry=3

# Install Node packages
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# Copy app source
COPY . .

# Build production assets
ARG REACT_ON_RAILS_PRO_LICENSE
ARG SECRET_KEY_BASE=dummy_secret_for_asset_compilation
ARG RSC_CACHE_ENABLED=false

RUN RAILS_ENV=production \
    NODE_ENV=production \
    SECRET_KEY_BASE=$SECRET_KEY_BASE \
    REACT_ON_RAILS_PRO_LICENSE=$REACT_ON_RAILS_PRO_LICENSE \
    RSC_CACHE_ENABLED=$RSC_CACHE_ENABLED \
    bundle exec rake react_on_rails:generate_packs

RUN RAILS_ENV=production \
    NODE_ENV=production \
    SECRET_KEY_BASE=$SECRET_KEY_BASE \
    REACT_ON_RAILS_PRO_LICENSE=$REACT_ON_RAILS_PRO_LICENSE \
    RSC_CACHE_ENABLED=$RSC_CACHE_ENABLED \
    bin/shakapacker

# ============================================================
# Production stage - minimal runtime image
# ============================================================
FROM base AS production

WORKDIR /app

# Copy Ruby gems
COPY --from=build /usr/local/bundle /usr/local/bundle

# Copy node_modules
COPY --from=build /app/node_modules ./node_modules

# Copy app source
COPY . .

# Copy compiled assets and server bundle
COPY --from=build /app/public/packs ./public/packs
COPY --from=build /app/ssr-generated ./ssr-generated

# Copy entrypoint
COPY .controlplane/entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

ENV RAILS_ENV=production \
    NODE_ENV=production \
    RAILS_SERVE_STATIC_FILES=true \
    RAILS_LOG_TO_STDOUT=true \
    PORT=3000

EXPOSE 3000

ENTRYPOINT ["/app/entrypoint.sh"]

CMD ["bash", "-c", "node node-renderer.js & RENDERER_PID=$! ; bundle exec rails server -b 0.0.0.0 -p $PORT & RAILS_PID=$! ; wait -n ; exit 1"]
