import request from 'supertest';
import { prisma } from '../src/index';
import app from '../src/index';

describe('Auth routes', () => {
  it('returns 401 for invalid credentials', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'unknown@test', password: 'bad' });
    expect(res.status).toBe(401);
  });
});