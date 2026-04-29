ARG BASE_IMAGE=ghcr.io/514-labs/dec-bench:base
FROM ${BASE_IMAGE}

ARG SCENARIO_DIR

RUN test -n "${SCENARIO_DIR}"

COPY ${SCENARIO_DIR}/ /scenario/
COPY scenarios/_shared/ /_shared/
COPY ${SCENARIO_DIR}/supervisord.conf /etc/supervisord.conf
# 514-1419: Sandbox the assertion files from the agent. Assertions are not
# baked into the image; the CLI docker-cp's them into /scenario/assertions/
# only after the agent phase exits, so the agent cannot read the gating
# logic during its run.
RUN rm -rf /scenario/assertions
# Overlay the dec-bench scripts so fixes land without rebuilding the base image.
# Same paths as in the base image, so these COPY layers win.
COPY docker/base/lib.sh /opt/dec-bench/lib.sh
COPY docker/base/entrypoint.sh /opt/dec-bench/entrypoint.sh
COPY docker/base/run-agent.sh /opt/dec-bench/run-agent.sh
COPY docker/base/run-evaluator.sh /opt/dec-bench/run-evaluator.sh
RUN chmod +x /opt/dec-bench/entrypoint.sh /opt/dec-bench/run-agent.sh /opt/dec-bench/run-evaluator.sh
