import { readFileSync } from 'node:fs';
import { loadConfig, paths } from './config';
import { buildReaders, createPagoClaro } from './factory';
import { buildHttp } from './http';
import { JsonStore } from './store/store';
import { JsonlTelemetry } from './telemetry';
import { seedWorld, type World } from './world';

async function main(): Promise<void> {
  const config = loadConfig();
  const p = paths(config);
  const store = new JsonStore(p.state);
  seedWorld(store, JSON.parse(readFileSync(config.worldFile, 'utf8')) as World, new Date().toISOString());
  const readers = buildReaders(config, p.spend);
  const telemetry = new JsonlTelemetry(p.telemetry);
  const { agent } = createPagoClaro({ store, primary: readers.primary, check: readers.check, telemetry });
  const app = await buildHttp({
    agent,
    accessCode: config.accessCode,
    spend: () => ({ usd: readers.spend.totalUsd, cap: readers.spend.capUsd }),
    telemetry,
    mode: readers.mode,
  });
  await app.listen({ port: config.port, host: config.host });
  const keyText = config.hasApiKey ? 'con API key' : 'sin API key';
  console.log(
    [
      `PagoClaro escuchando en http://${config.host}:${config.port}`,
      `  Lectores: ${readers.mode} (${config.primaryModel} + ${config.checkModel}), ${keyText}, tope ${config.spendCapUsd} USD, gastado ${readers.spend.totalUsd.toFixed(4)} USD`,
      `  Escrituras: ${config.accessCode ? 'con código de acceso' : 'deshabilitadas (define PAGOCLARO_ACCESS_CODE)'}`,
      `  Datos: ${p.state}`,
    ].join('\n'),
  );
  const shutdown = () => app.close().then(() => process.exit(0), () => process.exit(1));
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch((e: unknown) => {
  console.error('No se pudo iniciar PagoClaro:', e instanceof Error ? e.message : e);
  process.exit(1);
});
