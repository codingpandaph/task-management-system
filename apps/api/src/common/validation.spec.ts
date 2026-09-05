import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { IsString } from 'class-validator';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createValidationPipe } from './validation';

class ExampleDto {
  @IsString()
  value!: string;
}

test('request validation transforms valid payloads into DTO instances', async () => {
  const result: unknown = await createValidationPipe().transform(
    { value: 'valid' },
    { type: 'body', metatype: ExampleDto },
  );
  assert.ok(result instanceof ExampleDto);
  assert.equal(result.value, 'valid');
});

test('request validation rejects invalid and undeclared properties', async () => {
  for (const payload of [{ value: 123 }, { value: 'valid', extra: true }, {}]) {
    await assert.rejects(
      createValidationPipe().transform(payload, { type: 'body', metatype: ExampleDto }),
      BadRequestException,
    );
  }
});
