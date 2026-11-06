#!/usr/bin/env bash
# 새 EC2(Ubuntu 22.04/24.04 또는 Amazon Linux 2023)에서 한 번만 실행한다.
# Docker, Compose, git을 설치하고 micro 인스턴스용 스왑 2GB를 잡는다.
set -euo pipefail

if [ ! -f /swapfile ]; then
  echo "▶ 스왑 2GB 만드는 중 (micro는 빌드 중 메모리가 모자랄 수 있다)"
  sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

if ! command -v docker >/dev/null; then
  echo "▶ Docker 설치 중"
  if command -v apt-get >/dev/null; then
    sudo apt-get update -y
    sudo apt-get install -y ca-certificates curl git
    curl -fsSL https://get.docker.com | sudo sh
  else
    sudo dnf install -y docker git
    sudo mkdir -p /usr/local/lib/docker/cli-plugins
    sudo curl -fsSL "https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-$(uname -m)" -o /usr/local/lib/docker/cli-plugins/docker-compose
    sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
    sudo systemctl enable --now docker
  fi
  sudo usermod -aG docker "$USER"
fi

echo "✅ 준비 완료. 'docker' 그룹 적용을 위해 한 번 로그아웃했다가 다시 접속하세요."
