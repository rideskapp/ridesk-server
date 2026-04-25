type LogLevel = 'info' | 'warn' | 'error' | 'debug';

type LogData = Record<string, unknown>;

const formatLog = (level: LogLevel, message: string, data?: LogData): string => {
  const timestamp = new Date().toISOString();
  const logEntry: Record<string, unknown> = {
    timestamp,
    level,
    message,
    ...data,
  };
  try {
    return JSON.stringify(logEntry);
  } catch (err) {
    return JSON.stringify({
      timestamp,
      level,
      message,
      error: 'Failed to serialize log data',
    });
  }
};

export const logger = {
  info: (message: string, data?: LogData) => {
    console.log(formatLog('info', message, data));
  },
  
  warn: (message: string, data?: LogData) => {
    console.warn(formatLog('warn', message, data));
  },
  
  error: (message: string, data?: LogData) => {
    const enhancedData = data && 'stack' in data && data['stack'] 
      ? { ...data, stack: data['stack'] }
      : data;
    console.error(formatLog('error', message, enhancedData));
  },
  
  debug: (message: string, data?: LogData) => {
    if (process.env['NODE_ENV'] === 'development') {
      console.debug(formatLog('debug', message, data));
    }
  },
};

