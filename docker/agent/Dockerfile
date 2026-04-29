ARG HARNESS_IMAGE
FROM ${HARNESS_IMAGE}

ARG AGENT_RUN_SCRIPT
ARG AGENT_IPTABLES_SCRIPT
ARG META_SCENARIO
ARG META_HARNESS
ARG META_AGENT
ARG META_MODEL
ARG META_VERSION

RUN test -n "${AGENT_RUN_SCRIPT}" && test -n "${AGENT_IPTABLES_SCRIPT}"

COPY ${AGENT_RUN_SCRIPT} /opt/dec-bench/agent/run.sh
COPY ${AGENT_IPTABLES_SCRIPT} /opt/dec-bench/agent/iptables.sh
COPY scripts/llm-pricing.mjs /opt/dec-bench/scripts/llm-pricing.mjs

# cursor-langfuse hooks — fetched from source at build time.
# https://github.com/naoufalelh/cursor-langfuse
ARG CURSOR_LANGFUSE_SHA=7da6836fbf620f1c9cfc919ee1550695d8f7a8ed
ADD https://github.com/naoufalelh/cursor-langfuse/archive/${CURSOR_LANGFUSE_SHA}.tar.gz /tmp/langfuse.tar.gz
RUN mkdir -p /opt/dec-bench/agent/hooks-langfuse && \
    tar xzf /tmp/langfuse.tar.gz -C /tmp && \
    cp -r /tmp/cursor-langfuse-${CURSOR_LANGFUSE_SHA}/.cursor/* /opt/dec-bench/agent/hooks-langfuse/ && \
    rm -rf /tmp/langfuse.tar.gz /tmp/cursor-langfuse-*

RUN chmod +x /opt/dec-bench/agent/run.sh /opt/dec-bench/agent/iptables.sh

ENV EVAL_SCENARIO="${META_SCENARIO}" \
    EVAL_HARNESS="${META_HARNESS}" \
    EVAL_AGENT="${META_AGENT}" \
    MODEL="${META_MODEL}" \
    EVAL_VERSION="${META_VERSION}"
