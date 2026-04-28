ARG BASE_IMAGE=ghcr.io/514-labs/dec-bench:base
FROM ${BASE_IMAGE}

ARG SCENARIO_DIR

RUN test -n "${SCENARIO_DIR}"

COPY ${SCENARIO_DIR}/ /scenario/
COPY scenarios/_shared/ /_shared/
COPY ${SCENARIO_DIR}/supervisord.conf /etc/supervisord.conf
# Overlay the entrypoint so fixes land without rebuilding the base image.
# Base image's version is /opt/dec-bench/entrypoint.sh; same path here wins.
COPY docker/base/entrypoint.sh /opt/dec-bench/entrypoint.sh
RUN chmod +x /opt/dec-bench/entrypoint.sh
