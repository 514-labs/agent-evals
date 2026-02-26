ARG BASE_IMAGE=ghcr.io/514-labs/dec-bench:base
FROM ${BASE_IMAGE}

ARG SCENARIO_DIR

RUN test -n "${SCENARIO_DIR}"

COPY ${SCENARIO_DIR}/ /scenario/
COPY ${SCENARIO_DIR}/supervisord.conf /etc/supervisord.conf
