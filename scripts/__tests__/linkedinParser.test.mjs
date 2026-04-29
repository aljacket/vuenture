import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  parseLinkedInDetailPage,
  looksGated,
  parseLinkedInSalary,
} from '../linkedinParser.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name) =>
  readFileSync(resolve(__dirname, '..', '__fixtures__', 'linkedin', name), 'utf8');

describe('parseLinkedInDetailPage', () => {
  it('extracts the body from a normal job page', () => {
    const html = fixture('with-description.html');
    const body = parseLinkedInDetailPage(html);
    expect(body.length).toBeGreaterThan(500);
    expect(body).toContain('Senior Vue.js Frontend Developer');
    expect(body).toContain('Composition API');
    // HTML tags must be stripped
    expect(body).not.toContain('<p>');
    expect(body).not.toContain('<ul>');
  });

  it('returns empty string on a gated page', () => {
    const html = fixture('gated.html');
    expect(parseLinkedInDetailPage(html)).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(parseLinkedInDetailPage('')).toBe('');
    expect(parseLinkedInDetailPage(null)).toBe('');
    expect(parseLinkedInDetailPage(undefined)).toBe('');
  });
});

describe('looksGated', () => {
  it('flags a sign-in stub page', () => {
    expect(looksGated(fixture('gated.html'))).toBe(true);
  });

  it('does not flag a real job page', () => {
    expect(looksGated(fixture('with-description.html'))).toBe(false);
  });

  it('returns false for non-string input', () => {
    expect(looksGated(null)).toBe(false);
    expect(looksGated(undefined)).toBe(false);
    expect(looksGated(123)).toBe(false);
  });
});

describe('parseLinkedInSalary', () => {
  it('parses a EU "60,000 - 85,000 EUR" range', () => {
    const out = parseLinkedInSalary(fixture('with-description.html'));
    expect(out).toBeDefined();
    expect(out.min).toBe(60000);
    expect(out.max).toBe(85000);
  });

  it('parses a "$80K - $120K/yr" range', () => {
    const html = '<span>$80K - $120K/yr</span>';
    const out = parseLinkedInSalary(html);
    expect(out).toBeDefined();
    expect(out.min).toBe(80000);
    expect(out.max).toBe(120000);
  });

  it('returns undefined when no salary appears', () => {
    expect(parseLinkedInSalary('<p>No money here, just vibes</p>')).toBeUndefined();
  });

  it('returns undefined for empty or non-string input', () => {
    expect(parseLinkedInSalary('')).toBeUndefined();
    expect(parseLinkedInSalary(null)).toBeUndefined();
  });
});
