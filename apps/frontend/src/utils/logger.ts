import { Logger } from 'tslog';

export const logger = new Logger({
  name: 'frontend',
  minLevel: 2, // debug
  pretty: {
    template: '{{yyyy}}-{{mm}}-{{dd}} {{hh}}:{{MM}}:{{ss}}.{{ms}}\t{{logLevelName}}\t[{{name}}]\t',
  },
});

export const adminLogger = logger.getSubLogger({ name: 'admin' });
export const authLogger = logger.getSubLogger({ name: 'auth' });
