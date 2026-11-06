# EC2 배포 (micro 한 대)

사이트와 실시간 서버를 Docker 이미지 하나로 묶고, 앞에 Caddy를 둬서 80/443 포트로 엽니다. 웹소켓(`/ws`)도 Caddy가 그대로 전달합니다.

```
브라우저 ──http(s)──▶ Caddy :80/:443 ──▶ app :8787 (사이트 + /ws 실시간 서버)
```

서버는 메모리에서만 동작하는 단일 인스턴스입니다. 다시 시작하면 방과 진행 중인 게임이 사라집니다(씨앗 기록은 각자 브라우저에 있어서 남습니다).

## 1. EC2 만들기 (AWS 콘솔)

| 항목 | 값 |
|---|---|
| AMI | Ubuntu Server 24.04 LTS (x86_64) |
| 인스턴스 유형 | `t3.micro` (프리 티어 대상이면 `t2.micro`/`t3.micro`) |
| 키 페어 | 새로 만들어 `.pem` 내려받기 |
| 스토리지 | 기본 8GB면 충분, 여유 있게 16GB 권장 |
| 보안 그룹 인바운드 | SSH 22(**내 IP만**), HTTP 80(0.0.0.0/0), HTTPS 443(0.0.0.0/0) |

**탄력적 IP**를 하나 할당해 인스턴스에 연결해 두면, 인스턴스를 껐다 켜도 주소가 바뀌지 않습니다(연결 안 한 탄력적 IP는 요금이 나갑니다).

## 2. 서버 준비 (처음 한 번)

```bash
chmod 400 ringout.pem
ssh -i ringout.pem ubuntu@<퍼블릭 IP>

git clone https://github.com/LEEJaeHyeok97/metaverse-ringout.git
cd metaverse-ringout
./deploy/setup.sh      # 스왑 2GB, Docker, Compose 설치
exit                   # docker 그룹 적용을 위해 다시 접속
```

저장소가 비공개라면 `git clone` 때 GitHub 개인 액세스 토큰(읽기 권한)을 비밀번호 자리에 넣습니다.

## 3. 설정과 실행

```bash
ssh -i ringout.pem ubuntu@<퍼블릭 IP>
cd metaverse-ringout/deploy
cp .env.example .env
nano .env
```

- IP로만 열 때: `SITE_ADDRESS=:80`, `ALLOWED_ORIGINS=http://<퍼블릭 IP>`
- 도메인을 연결했을 때(A 레코드 → 탄력적 IP): `SITE_ADDRESS=ringout.example.com`, `ALLOWED_ORIGINS=https://ringout.example.com` — Caddy가 HTTPS 인증서를 자동으로 받습니다.

`ALLOWED_ORIGINS`는 브라우저 주소창의 주소와 **정확히** 같아야 합니다(끝에 `/` 없이). 다르면 화면은 뜨지만 "서버와 끊겼어요"가 계속 보입니다.

```bash
./deploy.sh            # 처음 빌드는 micro에서 5~10분 걸린다
```

브라우저에서 `http://<퍼블릭 IP>`(또는 도메인)로 접속합니다.

## 4. 업데이트

로컬에서 `main`에 푸시한 뒤 EC2에서:

```bash
cd metaverse-ringout/deploy && ./deploy.sh
```

새 이미지로 바뀌는 동안 접속자는 잠깐 끊겼다가 자동으로 다시 붙습니다(진행 중인 게임은 사라집니다).

## 자주 쓰는 명령

```bash
cd metaverse-ringout/deploy
docker compose ps               # 상태
docker compose logs -f app      # 서버 로그
docker compose logs -f caddy    # 인증서, 접속 로그
docker compose restart app      # 재시작
docker compose down             # 끄기
```

## 문제 해결

- **사이트는 뜨는데 "서버와 끊겼어요"**: `.env`의 `ALLOWED_ORIGINS`가 주소창과 다릅니다(http/https, 포트, 끝의 `/` 확인). 고친 뒤 `docker compose up -d`.
- **빌드 중 멈추거나 `Killed`**: 메모리 부족입니다. `free -h`로 스왑 2GB가 잡혔는지 확인하고 `./setup.sh`를 다시 실행합니다.
- **HTTPS 인증서가 안 나옴**: 도메인 A 레코드가 이 IP를 가리키는지, 보안 그룹에 80/443이 열려 있는지 확인합니다.
- **알람 음원**: `src/assets/sounds/alarm.mp3`는 이미지 안에 들어가므로, 파일을 넣고 커밋한 뒤 다시 배포합니다.

## 비용

`t3.micro`는 프리 티어 대상 계정이면 무료 한도 안에서, 아니면 서울 리전 기준 시간당 약 0.013달러(월 1만 원대)입니다. 쓰지 않을 때는 인스턴스를 **중지**하고, 다 썼으면 **종료**와 함께 탄력적 IP **해제**까지 해야 요금이 멈춥니다.
