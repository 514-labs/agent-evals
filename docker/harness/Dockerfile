ARG SCENARIO_IMAGE
FROM ${SCENARIO_IMAGE}

ARG HARNESS_SCRIPT
ARG HARNESS_ID
# Default the overrides source to the committed empty dir so the COPY below
# always has something to copy from, preserving Docker build cache when no
# --override is passed.
ARG OVERRIDES_DIR=docker/harness/empty-overrides

RUN test -n "${HARNESS_SCRIPT}"

# Ship every tool module into the image so both install.sh (called during
# harness script composition) and override.sh (called by apply-overrides)
# resolve at the same path.
COPY tools/ /opt/dec-bench/tools/
RUN find /opt/dec-bench/tools -type f -name '*.sh' -exec chmod +x {} +

COPY ${HARNESS_SCRIPT} /tmp/harness.sh
RUN chmod +x /tmp/harness.sh && /tmp/harness.sh

COPY docker/harness/apply-overrides.sh /tmp/apply-overrides.sh
COPY ${OVERRIDES_DIR}/ /tmp/overrides/
RUN chmod +x /tmp/apply-overrides.sh && /tmp/apply-overrides.sh

# Run scenario-specific harness install if the scenario defines one.
# The scenario layer has already copied scenarios/<id>/ to /scenario/, so
# /scenario/harnesses/<harness-id>/install.sh is available here.
RUN if [ -n "${HARNESS_ID}" ] && [ -f "/scenario/harnesses/${HARNESS_ID}/install.sh" ]; then \
      echo "Running scenario-specific harness install for ${HARNESS_ID}" && \
      chmod +x "/scenario/harnesses/${HARNESS_ID}/install.sh" && \
      "/scenario/harnesses/${HARNESS_ID}/install.sh"; \
    fi
