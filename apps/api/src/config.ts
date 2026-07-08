export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  paymentProvider: process.env.PAYMENT_PROVIDER ?? 'mock',
  notifyProvider: process.env.NOTIFY_PROVIDER ?? 'log',
  devStaticOtp: process.env.DEV_STATIC_OTP ?? '123456',
  isDev: process.env.NODE_ENV !== 'production',
};
