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

echo "▶ 서버가 뜨기를 기다리는 중 (micro는 몇 초 걸린다)"
for _ in $(seq 1 30); do
  if docker compose exec -T app node -e "fetch('http://localhost:8787/health').then(r=>r.text()).then(t=>{console.log('✅ health:',t)}).catch(()=>process.exit(1))" 2>/dev/null; then
    docker compose ps
    exit 0
  fi
  sleep 2
done
echo "❌ 60초 안에 서버가 뜨지 않았어요. 로그를 확인해 주세요:"
docker compose ps
docker compose logs app --tail 30
exit 1
