#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: docker/build.sh --scenario <id> --harness <id> --agent <id> --model <model> --version <version>
EOF
}

SCENARIO=""
HARNESS=""
AGENT=""
MODEL=""
VERSION=""
BASE_IMAGE="ghcr.io/514-labs/dec-bench:base"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --scenario) SCENARIO="$2"; shift 2 ;;
    --harness) HARNESS="$2"; shift 2 ;;
    --agent) AGENT="$2"; shift 2 ;;
    --model) MODEL="$2"; shift 2 ;;
    --version) VERSION="$2"; shift 2 ;;
    --base-image) BASE_IMAGE="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; usage; exit 1 ;;
  esac
done

if [[ -z "${SCENARIO}" || -z "${HARNESS}" || -z "${AGENT}" || -z "${MODEL}" || -z "${VERSION}" ]]; then
  usage
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCENARIO_DIR="scenarios/${SCENARIO}"
HARNESS_JSON="${ROOT_DIR}/apps/web/data/harnesses/${HARNESS}.json"
AGENT_RUN_SCRIPT="docker/agents/${AGENT}/run.sh"
AGENT_IPTABLES_SCRIPT="docker/agents/${AGENT}/iptables.sh"

if [[ ! -d "${ROOT_DIR}/${SCENARIO_DIR}" ]]; then
  echo "Scenario directory does not exist: ${ROOT_DIR}/${SCENARIO_DIR}" >&2
  exit 1
fi
if [[ ! -f "${HARNESS_JSON}" ]]; then
  echo "Harness JSON does not exist: ${HARNESS_JSON}" >&2
  exit 1
fi
if [[ ! -f "${ROOT_DIR}/${AGENT_RUN_SCRIPT}" ]]; then
  echo "Agent run script does not exist: ${ROOT_DIR}/${AGENT_RUN_SCRIPT}" >&2
  exit 1
fi
if [[ ! -f "${ROOT_DIR}/${AGENT_IPTABLES_SCRIPT}" ]]; then
  AGENT_IPTABLES_SCRIPT="docker/agents/noop-iptables.sh"
fi

TMP_DIR="${ROOT_DIR}/docker/.tmp"
mkdir -p "${TMP_DIR}"
HARNESS_SCRIPT_REL="docker/.tmp/harness-${HARNESS}.sh"
HARNESS_SCRIPT="${ROOT_DIR}/${HARNESS_SCRIPT_REL}"

python3 - <<PY
import json
from pathlib import Path

src = Path("${HARNESS_JSON}")
dest = Path("${HARNESS_SCRIPT}")
data = json.loads(src.read_text())
installs = data.get("installs", [])
lines = ["#!/usr/bin/env bash", "set -euo pipefail"]
if installs:
    lines.append("pip3 install --no-cache-dir " + " ".join(installs))
dest.write_text("\\n".join(lines) + "\\n")
dest.chmod(0o755)
PY

NOOP_IPTABLES="${ROOT_DIR}/docker/agents/noop-iptables.sh"
if [[ ! -f "${NOOP_IPTABLES}" ]]; then
  cat > "${NOOP_IPTABLES}" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
exit 0
EOF
  chmod +x "${NOOP_IPTABLES}"
fi

FINAL_TAG="${SCENARIO}.${HARNESS}.${AGENT}.${MODEL}.${VERSION}"
SCENARIO_TAG="dec-bench-scenario:${SCENARIO}"
HARNESS_TAG="dec-bench-harness:${SCENARIO}-${HARNESS}"

cd "${ROOT_DIR}"

docker build -f docker/base/Dockerfile -t "${BASE_IMAGE}" .
docker build \
  -f docker/scenario/Dockerfile \
  --build-arg BASE_IMAGE="${BASE_IMAGE}" \
  --build-arg SCENARIO_DIR="${SCENARIO_DIR}" \
  -t "${SCENARIO_TAG}" \
  .
docker build \
  -f docker/harness/Dockerfile \
  --build-arg SCENARIO_IMAGE="${SCENARIO_TAG}" \
  --build-arg HARNESS_SCRIPT="${HARNESS_SCRIPT_REL}" \
  -t "${HARNESS_TAG}" \
  .
docker build \
  -f docker/agent/Dockerfile \
  --build-arg HARNESS_IMAGE="${HARNESS_TAG}" \
  --build-arg AGENT_RUN_SCRIPT="${AGENT_RUN_SCRIPT}" \
  --build-arg AGENT_IPTABLES_SCRIPT="${AGENT_IPTABLES_SCRIPT}" \
  -t "${FINAL_TAG}" \
  .

echo "Built image: ${FINAL_TAG}"
