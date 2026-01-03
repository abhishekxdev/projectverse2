import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { EventType, EventPayload } from './types';

class ApplicationEventEmitter extends EventEmitter {
  emit<T extends EventType>(
    event: T,
    payload: EventPayload[T]
  ): boolean {
    logger.info(`Emitting event: ${event}`, {
      event,
      payload: this.sanitizePayload(payload),
    });
    return super.emit(event, payload);
  }

  on<T extends EventType>(
    event: T,
    listener: (payload: EventPayload[T]) => void | Promise<void>
  ): this {
    logger.info(`Registering listener for event: ${event}`);
    return super.on(event, listener);
  }

  private sanitizePayload(payload: any): any {
    const sanitized = { ...payload };
    if (sanitized.timestamp instanceof Date) {
      sanitized.timestamp = sanitized.timestamp.toISOString();
    }
    return sanitized;
  }
}

export const appEventEmitter = new ApplicationEventEmitter();
