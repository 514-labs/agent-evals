ARG HARNESS_IMAGE
FROM ${HARNESS_IMAGE}

ARG AGENT_RUN_SCRIPT
ARG AGENT_IPTABLES_SCRIPT

RUN test -n "${AGENT_RUN_SCRIPT}" && test -n "${AGENT_IPTABLES_SCRIPT}"

COPY ${AGENT_RUN_SCRIPT} /opt/dec-bench/agent/run.sh
COPY ${AGENT_IPTABLES_SCRIPT} /opt/dec-bench/agent/iptables.sh
RUN chmod +x /opt/dec-bench/agent/run.sh /opt/dec-bench/agent/iptables.sh
