import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/global-exception.filter';

const REDOC_HTML = `<!DOCTYPE html><html><head>
  <title>ts-mobiledevice API</title>
  <meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>body{margin:0;padding:0}</style>
</head><body>
  <redoc spec-url="/api/openapi.json"
    theme='{"colors":{"primary":{"main":"#2563eb"}},"typography":{"fontFamily":"system-ui,sans-serif"}}'
    hide-download-button></redoc>
  <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
</body></html>`;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new GlobalExceptionFilter());

  // OpenAPI 3.1 document
  const document = SwaggerModule.createDocument(app, new DocumentBuilder()
    .setTitle('ts-mobiledevice API')
    .setDescription('REST + WebSocket API for iOS device management')
    .setVersion('0.6.0')
    .addServer('http://localhost:3000', 'Local')
    .build());

  const http = app.getHttpAdapter().getInstance();
  http.get('/api/openapi.json', (_: any, res: any) => res.json(document));
  http.get('/docs', (_: any, res: any) => res.type('html').send(REDOC_HTML));

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Server : http://localhost:${port}/api`);
  console.log(`Docs   : http://localhost:${port}/docs   (Redocly)`);
  console.log(`Spec   : http://localhost:${port}/api/openapi.json`);
  console.log(`Health : http://localhost:${port}/api/health`);
}
bootstrap();
