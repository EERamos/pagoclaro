# PagoClaro: one container, Node 22. The demo runs with recorded readings unless ANTHROPIC_API_KEY
# is set; writes need PAGOCLARO_ACCESS_CODE.
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY package.json package-lock.json .npmrc ./
# tsx runs the TypeScript sources directly, and it is a dev dependency: include them.
RUN npm ci --ignore-scripts --include=dev
COPY tsconfig.json ./
COPY src ./src
COPY runner ./runner
COPY web ./web
COPY fixtures ./fixtures
COPY evals ./evals
COPY scripts ./scripts
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Every boot starts from the demo, dated in the last day, built from the recorded readings with no
# model call; PIN-0415, AUR-2026-0923 and TRP-221 stay pending so visitors can act on them.
CMD ["sh", "-c", "npx tsx scripts/seed-demo.ts --readers=replay --no-approvals --start=now --out=data && npx tsx src/server.ts"]
