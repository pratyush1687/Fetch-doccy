import crypto from 'crypto';

export function hashString(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function hashQuery(query: string, filters: Record<string, any>): string {
  const combined = JSON.stringify({ query, filters });
  return hashString(combined);
}

