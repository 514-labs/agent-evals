FROM debian:trixie-slim

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

RUN curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/pgdg.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/pgdg.gpg] http://apt.postgresql.org/pub/repos/apt trixie-pgdg main" \
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

RUN curl -1sLf 'https://dl.redpanda.com/nzc4ZYQK3WRGd9sy/redpanda/cfg/setup/bash.deb.sh' | bash \
    && apt-get install -y --no-install-recommends redpanda \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /var/lib/redpanda/data /etc/redpanda
COPY docker/base/redpanda.yaml /etc/redpanda/redpanda.yaml
ENV PATH="/opt/redpanda/bin:${PATH}"

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

RUN npm install -g @anthropic-ai/claude-code @openai/codex tsx
RUN curl -fsSL https://cursor.com/install | bash \
    && ln -sf /root/.local/bin/agent /usr/local/bin/agent \
    && ln -sf /root/.local/bin/cursor-agent /usr/local/bin/cursor-agent

WORKDIR /opt/dec-bench/eval-core
COPY packages/eval-core/package.json ./package.json
COPY packages/eval-core/src ./src
# Strip monorepo-only `workspace:*` refs (the @dec-bench/scenarios import is
# type-only in every consuming file, and devDependencies aren't needed at
# runtime — tsx is already installed globally in this image) so npm install
# succeeds outside the workspace context. Then install the real runtime
# deps against the real package.json so its `name: "@dec-bench/eval-core"`
# and `main: "./src/index.ts"` fields make the package resolvable by name.
RUN node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json'));delete p.devDependencies;delete p.dependencies['@dec-bench/scenarios'];fs.writeFileSync('package.json',JSON.stringify(p,null,2));" \
    && npm install --omit=dev --no-audit --no-fund
# Symlink into / so Node's walk-up resolver finds @dec-bench/eval-core from
# scenario-side .ts files loaded via dynamic import (scenarios and _shared
# live outside any node_modules tree).
RUN mkdir -p /node_modules/@dec-bench \
    && ln -s /opt/dec-bench/eval-core /node_modules/@dec-bench/eval-core

WORKDIR /
COPY docker/base/lib.sh /opt/dec-bench/lib.sh
COPY docker/base/entrypoint.sh /opt/dec-bench/entrypoint.sh
RUN chmod +x /opt/dec-bench/entrypoint.sh

ENTRYPOINT ["/opt/dec-bench/entrypoint.sh"]
