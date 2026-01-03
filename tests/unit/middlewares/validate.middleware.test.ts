import { validate } from '../../../src/middlewares/validate';
import { z } from 'zod';
import { ApiRequest } from '../../../src/types/api.types';
import { ValidationError } from '../../../src/utils/error';

const schema = z
  .object({ name: z.string().min(2), age: z.number().int().positive() })
  .strict();

const run = async (reqBody: any) => {
  const req = { body: reqBody } as ApiRequest;
  const res: any = {};
  let error: any;
  await validate(schema)(req, res, (err?: any) => {
    if (err) error = err;
  });
  return { req, error };
};

describe('validate middleware', () => {
  it('passes and replaces body on success', async () => {
    const { req, error } = await run({ name: 'Ab', age: 21 });
    expect(error).toBeUndefined();
    expect(req.body).toEqual({ name: 'Ab', age: 21 });
  });
  it('fails with ValidationError on bad body', async () => {
    const { error } = await run({ name: 'A', age: -1 });
    expect(error).toBeInstanceOf(ValidationError);
  });
});
