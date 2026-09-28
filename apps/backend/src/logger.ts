import { Logger } from 'tslog';
import { env } from './config.js';

const logLevelMap: Record<string, number> = {
  silly: 0,
  trace: 1,
  debug: 2,
  info: 3,
  warn: 4,
  error: 5,
  fatal: 6,
};

const getMinLevel = (): number => {
  // If in test mode without explicit DEBUG, suppress info/debug noise
  if (env.OC_RR_NODE_ENV === 'test' && !process.env.DEBUG) {
    return 4; // WARN
  }
  return logLevelMap[env.OC_RR_LOG_LEVEL] ?? 2;
};

export const logger = new Logger({
  name: 'backend',
  minLevel: getMinLevel(),
  pretty: {
    template: '{{yyyy}}-{{mm}}-{{dd}} {{hh}}:{{MM}}:{{ss}}.{{ms}}\t{{logLevelName}}\t[{{name}}]\t',
  },
});

export const authLogger = logger.getSubLogger({ name: 'auth' });
export const oidcLogger = logger.getSubLogger({ name: 'oidc' });
export const valkeyLogger = logger.getSubLogger({ name: 'valkey' });
export const sessionLogger = logger.getSubLogger({ name: 'session' });
export const mapLogger = logger.getSubLogger({ name: 'map' });
