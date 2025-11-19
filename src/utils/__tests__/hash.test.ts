import { hashString, hashQuery } from '../hash';

describe('Hash Utils', () => {
  describe('hashString', () => {
    it('should generate a SHA256 hash for a string', () => {
      const input = 'test-string';
      const hash = hashString(input);
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA256 produces 64-character hex string
    });

    it('should produce consistent hashes for the same input', () => {
      const input = 'consistent-input';
      const hash1 = hashString(input);
      const hash2 = hashString(input);
      
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = hashString('input1');
      const hash2 = hashString('input2');
      
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty strings', () => {
      const hash = hashString('');
      
      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });

    it('should handle special characters', () => {
      const input = 'test@#$%^&*()_+-=[]{}|;:,.<>?';
      const hash = hashString(input);
      
      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });

    it('should handle unicode characters', () => {
      const input = 'test-测试-🚀';
      const hash = hashString(input);
      
      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });
  });

  describe('hashQuery', () => {
    it('should generate a hash for a query string', () => {
      const query = 'test query';
      const filters = {};
      const hash = hashQuery(query, filters);
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64);
    });

    it('should produce consistent hashes for the same query and filters', () => {
      const query = 'test query';
      const filters = { tag: 'test', author: 'john' };
      const hash1 = hashQuery(query, filters);
      const hash2 = hashQuery(query, filters);
      
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different queries', () => {
      const filters = { tag: 'test' };
      const hash1 = hashQuery('query1', filters);
      const hash2 = hashQuery('query2', filters);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes for different filters', () => {
      const query = 'test query';
      const hash1 = hashQuery(query, { tag: 'test1' });
      const hash2 = hashQuery(query, { tag: 'test2' });
      
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty query and filters', () => {
      const hash = hashQuery('', {});
      
      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });

    it('should handle complex filter objects', () => {
      const query = 'test';
      const filters = {
        tag: 'important',
        author: 'john@example.com',
        date: '2024-01-01',
        nested: { key: 'value' },
      };
      const hash = hashQuery(query, filters);
      
      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });

    it('should be order-sensitive for filter keys', () => {
      const query = 'test';
      // Note: JSON.stringify may not preserve key order in all cases,
      // but for most objects it does
      const hash1 = hashQuery(query, { a: '1', b: '2' });
      const hash2 = hashQuery(query, { b: '2', a: '1' });
      
      // These should be the same because JSON.stringify normalizes object key order
      expect(hash1).not.toBe(hash2);
    });
  });
});

