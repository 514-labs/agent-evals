FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# Minimal base: bash, python3, curl for install, ca-certs, jq for quick inspection.
# No ~/.claude/ config, no plugins, no memory.
RUN apt-get update && apt-get install -y --no-install-recommends \
        bash \
        ca-certificates \
        curl \
        python3 \
        jq \
        findutils \
    && rm -rf /var/lib/apt/lists/*

# Non-root user is required for claude --dangerously-skip-permissions
RUN useradd -m -s /bin/bash runner

USER runner
WORKDIR /home/runner

# Install Claude CLI as the runner user (lands in ~/.local/bin, no /root pollution)
RUN curl -fsSL https://claude.ai/install.sh | bash
ENV PATH="/home/runner/.local/bin:${PATH}"

# Sanity: confirm claude is installed at build time
RUN claude --version

USER root
WORKDIR /app
COPY variants /app/variants
COPY tasks /app/tasks
COPY runner.container.sh /app/runner.container.sh
COPY launch_all.container.sh /app/launch_all.container.sh
RUN chmod +x /app/runner.container.sh /app/launch_all.container.sh /app/variants/*/bin/moose \
 && mkdir -p /app/runs \
 && chown -R runner:runner /app

USER runner
VOLUME ["/app/runs"]

CMD ["bash", "/app/launch_all.container.sh"]
