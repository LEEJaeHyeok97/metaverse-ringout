# 웹사이트와 실시간 서버를 이미지 하나로 묶는다.
# 디스크가 작은 EC2(8GB)에서도 빌드되도록 npm 설치는 한 번만 하고, 빌드 뒤 개발용 패키지와 npm 캐시를 지운다.
FROM node:22-slim AS site
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force
COPY . .
RUN npm run build && npm prune --omit=dev && npm cache clean --force

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY --from=site /app/node_modules ./node_modules
# 서버가 코스 규칙과 메시지 형식을 src에서 함께 쓴다.
COPY server ./server
COPY src ./src
COPY --from=site /app/dist ./dist
# 함께 정원을 저장하는 곳. compose가 볼륨을 붙여 재배포해도 남는다.
RUN mkdir -p /app/data && chown node:node /app/data
USER node

ENV PORT=8787
ENV SITE_DIR=/app/dist
ENV GARDEN_FILE=/app/data/garden.json
EXPOSE 8787

HEALTHCHECK --interval=5s --timeout=5s --start-period=5s --retries=6 \
  CMD node -e "fetch('http://localhost:8787/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.ts"]
