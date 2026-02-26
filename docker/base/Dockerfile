FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    clickhouse-client \
    curl \
    default-mysql-client \
    git \
    gnupg \
    jq \
    postgresql-client \
    python3 \
    python3-pip \
    python3-venv \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir \
    clickhouse-connect \
    kafka-python \
    pandas \
    psycopg2-binary \
    sqlalchemy

RUN npm install -g @anthropic-ai/claude-code tsx

WORKDIR /opt/dec-bench/eval-core
COPY packages/eval-core/src ./src
RUN npm init -y \
    && npm install --omit=dev @clickhouse/client pg

WORKDIR /
COPY docker/base/entrypoint.sh /opt/dec-bench/entrypoint.sh
RUN chmod +x /opt/dec-bench/entrypoint.sh

ENTRYPOINT ["/opt/dec-bench/entrypoint.sh"]
