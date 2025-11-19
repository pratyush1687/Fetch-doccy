import logger from '../logger';

describe('Logger', () => {
  it('should be defined', () => {
    expect(logger).toBeDefined();
  });

  it('should have info method', () => {
    expect(typeof logger.info).toBe('function');
  });

  it('should have error method', () => {
    expect(typeof logger.error).toBe('function');
  });

  it('should have warn method', () => {
    expect(typeof logger.warn).toBe('function');
  });

  it('should have debug method', () => {
    expect(typeof logger.debug).toBe('function');
  });

  it('should log info messages without throwing', () => {
    expect(() => {
      logger.info('Test info message', { key: 'value' });
    }).not.toThrow();
  });

  it('should log error messages without throwing', () => {
    expect(() => {
      logger.error('Test error message', { error: 'test error' });
    }).not.toThrow();
  });

  it('should log warn messages without throwing', () => {
    expect(() => {
      logger.warn('Test warn message', { warning: 'test warning' });
    }).not.toThrow();
  });

  it('should log debug messages without throwing', () => {
    expect(() => {
      logger.debug('Test debug message', { debug: 'test debug' });
    }).not.toThrow();
  });

  it('should handle logging with Error objects', () => {
    const error = new Error('Test error');
    expect(() => {
      logger.error('Error occurred', { error });
    }).not.toThrow();
  });

  it('should handle logging with complex objects', () => {
    const complexObject = {
      nested: {
        deep: {
          value: 'test',
        },
      },
      array: [1, 2, 3],
    };
    expect(() => {
      logger.info('Complex object', complexObject);
    }).not.toThrow();
  });
});

