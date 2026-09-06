export interface Environment {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  APP_ORIGIN: string;
  BCRYPT_ROUNDS: number;
  LOGIN_IDENTITY_LIMIT: number;
  LOGIN_IP_LIMIT: number;
}

export function validateEnvironment(config: Record<string, unknown>): Environment {
  const nodeEnv = config.NODE_ENV ?? 'development';
  if (nodeEnv !== 'development' && nodeEnv !== 'test' && nodeEnv !== 'production') {
    throw new Error('NODE_ENV must be development, test, or production.');
  }

  const rawPort = config.PORT ?? 3001;
  const port = typeof rawPort === 'string' && /^\d+$/.test(rawPort) ? Number(rawPort) : rawPort;
  if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  const database = String(config.DATABASE_URL ?? '');
  const secret = String(config.JWT_ACCESS_SECRET ?? '');
  const origin = String(config.APP_ORIGIN ?? 'http://localhost:3000');
  const rounds = Number(config.BCRYPT_ROUNDS ?? 12);
  const identityLimit = Number(config.LOGIN_IDENTITY_LIMIT ?? 5);
  const ipLimit = Number(config.LOGIN_IP_LIMIT ?? 20);
  if (!database.startsWith('postgresql://') && !database.startsWith('postgres://'))
    throw new Error('DATABASE_URL is required');
  if (secret.length < 32) throw new Error('JWT_ACCESS_SECRET must contain at least 32 characters');
  if (!Number.isInteger(rounds) || rounds < 10 || rounds > 15)
    throw new Error('BCRYPT_ROUNDS must be between 10 and 15');
  if (!Number.isInteger(identityLimit) || identityLimit < 1)
    throw new Error('LOGIN_IDENTITY_LIMIT must be a positive integer');
  if (!Number.isInteger(ipLimit) || ipLimit < 1) throw new Error('LOGIN_IP_LIMIT must be a positive integer');
  const url = new URL(origin);
  if (url.origin !== origin || (nodeEnv === 'production' && url.protocol !== 'https:'))
    throw new Error('Invalid APP_ORIGIN');
  return {
    NODE_ENV: nodeEnv,
    PORT: port,
    DATABASE_URL: database,
    JWT_ACCESS_SECRET: secret,
    APP_ORIGIN: origin,
    BCRYPT_ROUNDS: rounds,
    LOGIN_IDENTITY_LIMIT: identityLimit,
    LOGIN_IP_LIMIT: ipLimit,
  };
}
