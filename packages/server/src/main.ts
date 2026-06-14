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
    theme='{"colors":{"primary":{"main":"#2563eb"}}}'
    hide-download-button></redoc>
  <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
</body></html>`;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'POST', 'DELETE', 'PATCH'],
  });
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new GlobalExceptionFilter());

  // OpenAPI 3.1
  const document = SwaggerModule.createDocument(app, new DocumentBuilder()
    .setTitle('ts-mobiledevice API')
    .setDescription('REST + WebSocket API for iOS device management')
    .setVersion('0.7.0')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-api-key' }, 'x-api-key')
    .addServer(`http://localhost:${process.env.PORT ?? 3000}`, 'Local')
    .build());

  const http = app.getHttpAdapter().getInstance();
  http.get('/api/openapi.json', (_: any, res: any) => res.json(document));
  http.get('/docs', (_: any, res: any) => res.type('html').send(REDOC_HTML));

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Server : http://localhost:${port}/api`);
  console.log(`Docs   : http://localhost:${port}/docs`);
  console.log(`Health : http://localhost:${port}/api/health`);
  console.log(`Auth   : ${process.env.API_KEY ? 'API_KEY enabled' : 'open (set API_KEY env to enable)'}`);
}
bootstrap();
