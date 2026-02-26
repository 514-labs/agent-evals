ARG SCENARIO_IMAGE
FROM ${SCENARIO_IMAGE}

ARG HARNESS_SCRIPT

RUN test -n "${HARNESS_SCRIPT}"

COPY ${HARNESS_SCRIPT} /tmp/harness.sh
RUN chmod +x /tmp/harness.sh && /tmp/harness.sh
