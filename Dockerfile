# PagoClaro: one container, Node 22. The demo runs with recorded readings unless ANTHROPIC_API_KEY
# is set; writes need PAGOCLARO_ACCESS_CODE.
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY package.json package-lock.json .npmrc ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src ./src
COPY runner ./runner
COPY web ./web
COPY fixtures ./fixtures
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npx", "tsx", "src/server.ts"]
