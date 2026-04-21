#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: docker/build.sh --scenario <id> --harness <id> --agent <id> --model <model> --version <version>
                       [--base-image <image>] [--override <tool-name>]...

--override passes the NAME of a tool whose source has been staged under
docker/.tmp/overrides/<NAME> (by the CLI). Repeatable.
EOF
}

SCENARIO=""
HARNESS=""
AGENT=""
MODEL=""
VERSION=""
BASE_IMAGE="ghcr.io/514-labs/dec-bench:base"
OVERRIDES=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --scenario) SCENARIO="$2"; shift 2 ;;
    --harness) HARNESS="$2"; shift 2 ;;
    --agent) AGENT="$2"; shift 2 ;;
    --model) MODEL="$2"; shift 2 ;;
    --version) VERSION="$2"; shift 2 ;;
    --base-image) BASE_IMAGE="$2"; shift 2 ;;
    --override) OVERRIDES+=("$2"); shift 2 ;;
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

TOOLS_DIR="${ROOT_DIR}/tools"

python3 - "${HARNESS_JSON}" "${HARNESS_SCRIPT}" "${TOOLS_DIR}" <<'PY'
import json, os, stat, sys
from pathlib import Path

src = Path(sys.argv[1])
dest = Path(sys.argv[2])
tools_root = Path(sys.argv[3])
data = json.loads(src.read_text())

lines = ["#!/usr/bin/env bash", "set -euo pipefail"]

tool_installs = data.get("toolInstalls") or []
for tool in tool_installs:
    name = tool["name"]
    version = tool["version"]
    install = tools_root / name / "install.sh"
    if not install.is_file():
        print(f"Missing install script for tool '{name}': {install}", file=sys.stderr)
        sys.exit(1)
    # Shell-quote the version to be safe.
    lines.append(f'bash /opt/dec-bench/tools/{name}/install.sh {json.dumps(version)}')

post = (data.get("postInstallScript") or "").strip()
if post:
    lines.append(post)

# Back-compat: harnesses that haven't migrated still use a single installScript.
if not tool_installs and not post:
    legacy = (data.get("installScript") or "").strip()
    if legacy:
        lines.append(legacy)

dest.write_text("\n".join(lines) + "\n")
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

OVERRIDES_STAGE_REL="docker/.tmp/overrides"
OVERRIDES_BUILD_ARG=()
if (( ${#OVERRIDES[@]} > 0 )); then
  stage_dir="${ROOT_DIR}/${OVERRIDES_STAGE_REL}"
  if [[ ! -d "${stage_dir}" ]]; then
    echo "Overrides staging dir not found: ${stage_dir}" >&2
    echo "The CLI should have staged sources there before invoking build.sh." >&2
    exit 1
  fi
  for name in "${OVERRIDES[@]}"; do
    staged="${stage_dir}/${name}"
    if [[ ! -e "${staged}" ]]; then
      echo "Overrides: no staged source at ${staged} for '${name}'" >&2
      exit 1
    fi
  done
  OVERRIDES_BUILD_ARG=(--build-arg "OVERRIDES_DIR=${OVERRIDES_STAGE_REL}")
  echo "Applying overrides: ${OVERRIDES[*]}"
fi

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
  ${OVERRIDES_BUILD_ARG[@]+"${OVERRIDES_BUILD_ARG[@]}"} \
  -t "${HARNESS_TAG}" \
  .
docker build \
  -f docker/agent/Dockerfile \
  --build-arg HARNESS_IMAGE="${HARNESS_TAG}" \
  --build-arg AGENT_RUN_SCRIPT="${AGENT_RUN_SCRIPT}" \
  --build-arg AGENT_IPTABLES_SCRIPT="${AGENT_IPTABLES_SCRIPT}" \
  --build-arg META_SCENARIO="${SCENARIO}" \
  --build-arg META_HARNESS="${HARNESS}" \
  --build-arg META_AGENT="${AGENT}" \
  --build-arg META_MODEL="${MODEL}" \
  --build-arg META_VERSION="${VERSION}" \
  -t "${FINAL_TAG}" \
  .

echo "Built image: ${FINAL_TAG}"
