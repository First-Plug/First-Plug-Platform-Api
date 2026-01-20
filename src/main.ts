import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { ZodValidationPipe } from '@anatine/zod-nestjs';
import { json, raw, urlencoded } from 'express';

const URL_PREVIEW = 'https://first-plug-testing';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(json({ limit: '50mb' }));

  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = [config.get('server.frontendUrl')];

      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        origin.startsWith(URL_PREVIEW)
      ) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.use(raw({ limit: '50mb' }));

  app.use(urlencoded({ limit: '50mb', extended: true }));

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: false,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalPipes(new ZodValidationPipe());

  await app.listen(config.get('server.port')!);
}
bootstrap();
