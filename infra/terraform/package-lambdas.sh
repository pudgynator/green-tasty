#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP="$ROOT/backend/restaurant-backend-app/dnapp/lambdas"
BUILD="$(cd "$(dirname "$0")" && pwd)/build"

if [[ -n "${DOTNET_ROOT:-}" && -x "${DOTNET_ROOT}/dotnet" ]]; then
  DOTNET="${DOTNET_ROOT}/dotnet"
elif [[ -x "${HOME}/.dotnet/dotnet" ]]; then
  DOTNET="${HOME}/.dotnet/dotnet"
  export DOTNET_ROOT="${HOME}/.dotnet"
  export PATH="${HOME}/.dotnet:${PATH}"
else
  DOTNET="$(command -v dotnet)"
fi

package() {
  local project_dir="$1"
  local project_file="$2"
  local name="$3"
  local publish_dir="$BUILD/${name}-publish"

  rm -rf "$publish_dir"
  mkdir -p "$publish_dir"

  "$DOTNET" publish "$project_dir/$project_file" \
    -c Release \
    -r linux-x64 \
    --self-contained false \
    -o "$publish_dir"

  rm -f "$BUILD/${name}.zip"
  (cd "$publish_dir" && zip -qr "$BUILD/${name}.zip" .)
  echo "packaged $BUILD/${name}.zip"
}

mkdir -p "$BUILD"
package "$APP/api-handler" "APIHandler.csproj" "api-handler"
package "$APP/report-sender" "ReportSender.csproj" "report-sender"
package "$APP/reports-handler" "ReportsHandler.csproj" "reports-handler"
