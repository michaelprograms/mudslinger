import { describe, it, expect } from 'vitest';
import { migrateScopeToFolder } from './base';

describe('migrateScopeToFolder', () => {
    it("maps 'global' scope to ungrouped", () => {
        const items = [{ scope: 'global' } as any];
        const changed = migrateScopeToFolder(items);
        expect(changed).toBe(true);
        expect(items[0].folder).toBeUndefined();
        expect('scope' in items[0]).toBe(false);
    });

    it('maps a character scope to a folder of the same name', () => {
        const items = [{ scope: 'bob' } as any];
        migrateScopeToFolder(items);
        expect(items[0].folder).toBe('bob');
        expect('scope' in items[0]).toBe(false);
    });

    it('leaves already-migrated items untouched and returns false', () => {
        const items = [{ folder: 'combat' } as any];
        expect(migrateScopeToFolder(items)).toBe(false);
        expect(items[0].folder).toBe('combat');
    });
});
