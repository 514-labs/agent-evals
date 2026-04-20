ARG SCENARIO_IMAGE
FROM ${SCENARIO_IMAGE}

ARG HARNESS_SCRIPT
ARG HARNESS_ID

RUN test -n "${HARNESS_SCRIPT}"

COPY ${HARNESS_SCRIPT} /tmp/harness.sh
RUN chmod +x /tmp/harness.sh && /tmp/harness.sh

# Run scenario-specific harness install if the scenario defines one.
# The scenario layer has already copied scenarios/<id>/ to /scenario/, so
# /scenario/harnesses/<harness-id>/install.sh is available here.
RUN if [ -n "${HARNESS_ID}" ] && [ -f "/scenario/harnesses/${HARNESS_ID}/install.sh" ]; then \
      echo "Running scenario-specific harness install for ${HARNESS_ID}" && \
      chmod +x "/scenario/harnesses/${HARNESS_ID}/install.sh" && \
      "/scenario/harnesses/${HARNESS_ID}/install.sh"; \
    fi
