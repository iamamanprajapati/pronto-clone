import Redis from 'ioredis';
import { config } from './config';

export const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
/** Separate connection for BullMQ (it requires maxRetriesPerRequest: null too). */
export const redisSub = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

export const geoKey = (zoneId: string) => `zone:${zoneId}:geo`;
export const liveKey = (workerId: string) => `worker:${workerId}:live`;
export const offerLockKey = (workerId: string) => `worker:${workerId}:offerlock`;
