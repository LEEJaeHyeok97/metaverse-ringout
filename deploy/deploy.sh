#!/usr/bin/env bash
# EC2에서 최신 코드를 받아 다시 빌드하고 띄운다. 처음 배포와 업데이트 모두 이걸로 한다.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "❌ deploy/.env가 없어요. 'cp .env.example .env' 후 값을 채워 주세요."
  exit 1
fi

git -C .. pull --ff-only
docker compose up -d --build
docker image prune -f >/dev/null

echo "▶ 상태 확인"
sleep 3
docker compose ps
docker compose exec -T app node -e "fetch('http://localhost:8787/health').then(r=>r.text()).then(t=>console.log('health:',t))"
