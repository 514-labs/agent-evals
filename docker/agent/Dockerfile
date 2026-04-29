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
COPY docker/.tmp/agent-hooks/ /opt/dec-bench/agent/hooks-langfuse/
RUN chmod +x /opt/dec-bench/agent/run.sh /opt/dec-bench/agent/iptables.sh

ENV EVAL_SCENARIO="${META_SCENARIO}" \
    EVAL_HARNESS="${META_HARNESS}" \
    EVAL_AGENT="${META_AGENT}" \
    MODEL="${META_MODEL}" \
    EVAL_VERSION="${META_VERSION}"
