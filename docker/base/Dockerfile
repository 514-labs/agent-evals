FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    default-mysql-client \
    git \
    gnupg \
    jq \
    python3 \
    python3-pip \
    python3-venv \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

RUN curl -1sLf 'https://dl.redpanda.com/nzc4ZYQK3WRGd9sy/redpanda/cfg/setup/bash.deb.sh' | bash \
    && apt-get install -y --no-install-recommends redpanda \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/pgdg.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/pgdg.gpg] http://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
       > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends postgresql-16 postgresql-client-16 \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://packages.clickhouse.com/rpm/lts/repodata/repomd.xml.key | gpg --dearmor -o /usr/share/keyrings/clickhouse.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/clickhouse.gpg] https://packages.clickhouse.com/deb stable main" \
       > /etc/apt/sources.list.d/clickhouse.list \
    && apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends clickhouse-server clickhouse-client \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /var/lib/postgresql/data && chown -R postgres:postgres /var/lib/postgresql \
    && su - postgres -c "/usr/lib/postgresql/16/bin/initdb -D /var/lib/postgresql/data"

RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir --break-system-packages \
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
