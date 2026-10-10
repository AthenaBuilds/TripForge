import { describe, expect, it, vi } from 'vitest';
import { draftKey, loadDraft, removeDraft, saveDraft, type Draft } from './draftStorage';

const draft: Draft = {
  version: 1,
  destination: 'Goa',
  startDate: '2026-12-20',
  endDate: '2026-12-24',
  items: [{ clientId: 'c1', title: 'Beach', date: '2026-12-21', startTime: null }],
  updatedAt: '2026-10-10T00:00:00.000Z',
};

describe('draftStorage', () => {
  it('round-trips a draft under a per-user key', () => {
    saveDraft('u1', draft);
    expect(localStorage.getItem('tripforge:draft:u1')).not.toBeNull();
    expect(loadDraft('u1')).toEqual(draft);
    expect(loadDraft('u2')).toBeNull();
    removeDraft('u1');
    expect(loadDraft('u1')).toBeNull();
  });

  it.each([
    ['invalid JSON', '{nope'],
    ['an unknown version', JSON.stringify({ ...draft, version: 2 })],
    ['a bad date', JSON.stringify({ ...draft, startDate: '2026-02-30' })],
  ])('discards %s', (_label, raw) => {
    localStorage.setItem(draftKey('u1'), raw);
    expect(loadDraft('u1')).toBeNull();
    expect(localStorage.getItem(draftKey('u1'))).toBeNull();
  });

  it('works without storage (e.g. private mode)', () => {
    const fail = () => {
      throw new DOMException('denied', 'SecurityError');
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(fail);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(fail);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(fail);
    expect(() => saveDraft('u1', draft)).not.toThrow();
    expect(loadDraft('u1')).toBeNull();
    expect(() => removeDraft('u1')).not.toThrow();
    vi.restoreAllMocks();
  });
});
