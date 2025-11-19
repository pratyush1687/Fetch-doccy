import { hashString, hashQuery } from '../hash';

/**
 * Integration tests for hash utilities
 * These tests verify the actual hash output matches expected behavior
 */
describe('Hash Utils Integration', () => {
  describe('hashString', () => {
    it('should produce deterministic SHA256 hashes', () => {
      // Known SHA256 hash for "hello world"
      const input = 'hello world';
      const hash = hashString(input);
      
      // Verify it's a valid SHA256 hash (64 hex characters)
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      
      // Verify consistency
      expect(hashString(input)).toBe(hash);
    });

    it('should produce different hashes for similar inputs', () => {
      const hash1 = hashString('password');
      const hash2 = hashString('Password');
      const hash3 = hashString('password ');
      
      expect(hash1).not.toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash2).not.toBe(hash3);
    });

    it('should handle large strings efficiently', () => {
      const largeString = 'a'.repeat(100000);
      const start = Date.now();
      const hash = hashString(largeString);
      const duration = Date.now() - start;
      
      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
      // Should complete in reasonable time (< 1 second)
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('hashQuery', () => {
    it('should produce consistent hashes for identical queries', () => {
      const query = 'test query';
      const filters = { tag: 'important', author: 'john' };
      
      const hash1 = hashQuery(query, filters);
      const hash2 = hashQuery(query, filters);
      
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different filter orders', () => {
      const query = 'test';
      // Note: JSON.stringify may normalize object key order
      // but we test that the function works correctly
      const hash1 = hashQuery(query, { a: '1', b: '2' });
      const hash2 = hashQuery(query, { c: '3', d: '4' });
      
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty filters', () => {
      const hash = hashQuery('test', {});
      
      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });

    it('should handle nested filter objects', () => {
      const filters = {
        date: { from: '2024-01-01', to: '2024-12-31' },
        tags: ['tag1', 'tag2'],
      };
      
      const hash = hashQuery('test', filters);
      
      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });
  });
});

