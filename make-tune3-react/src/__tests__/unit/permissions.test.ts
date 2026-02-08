import { describe, it, expect } from 'vitest';
import { canCreateProject, getProjectAllowance } from '../../utils/permissions';
import type { User } from '../../types/auth';

// Tests use partial User objects - only the fields relevant to permissions are required
type PartialUser = Parameters<typeof canCreateProject>[0];

describe('canCreateProject', () => {
    describe('tier limits', () => {
        it('should return false for free tier user with no bonus projects', () => {
            const user = {
                uid: 'user-1',
                email: 'test@example.com',
                tier: 'free',
                projectCount: 0,
                bonusProjects: 0
            } as User;

            expect(canCreateProject(user)).toBe(false);
        });

        it('should allow beta tier user to create up to 3 projects', () => {
            const user = {
                uid: 'user-1',
                email: 'test@example.com',
                tier: 'beta',
                projectCount: 0,
                bonusProjects: 0
            } as User;

            expect(canCreateProject(user)).toBe(true);

            // At 2 projects, can still create
            user.projectCount = 2;
            expect(canCreateProject(user)).toBe(true);

            // At 3 projects, cannot create more
            user.projectCount = 3;
            expect(canCreateProject(user)).toBe(false);
        });

        it('should allow premium tier user to create up to 100 projects', () => {
            const user = {
                uid: 'user-1',
                email: 'test@example.com',
                tier: 'premium',
                projectCount: 0,
                bonusProjects: 0
            } as User;

            expect(canCreateProject(user)).toBe(true);

            user.projectCount = 99;
            expect(canCreateProject(user)).toBe(true);

            user.projectCount = 100;
            expect(canCreateProject(user)).toBe(false);
        });
    });

    describe('bonus projects', () => {
        it('should add bonus projects to tier limit', () => {
            const user = {
                uid: 'user-1',
                email: 'test@example.com',
                tier: 'free',
                projectCount: 0,
                bonusProjects: 2
            } as User;

            // Free (0) + 2 bonus = 2 allowed
            expect(canCreateProject(user)).toBe(true);

            user.projectCount = 1;
            expect(canCreateProject(user)).toBe(true);

            user.projectCount = 2;
            expect(canCreateProject(user)).toBe(false);
        });

        it('should stack bonus with beta tier', () => {
            const user = {
                uid: 'user-1',
                email: 'test@example.com',
                tier: 'beta',
                projectCount: 4,
                bonusProjects: 2
            } as User;

            // Beta (3) + 2 bonus = 5 allowed, at 4 can still create
            expect(canCreateProject(user)).toBe(true);

            user.projectCount = 5;
            expect(canCreateProject(user)).toBe(false);
        });
    });

    describe('admin bypass', () => {
        it('should always return true for admin users', () => {
            const user = {
                uid: 'admin-1',
                email: 'admin@example.com',
                tier: 'free',
                projectCount: 1000,
                bonusProjects: 0,
                isAdmin: true
            } as User;

            expect(canCreateProject(user)).toBe(true);
        });
    });

    describe('edge cases', () => {
        it('should return false for null user', () => {
            expect(canCreateProject(null)).toBe(false);
        });

        it('should default to free tier when tier field is missing', () => {
            const user = {
                uid: 'user-1',
                email: 'test@example.com',
                projectCount: 0
            } as User;

            // Free tier = 0 limit
            expect(canCreateProject(user)).toBe(false);
        });

        it('should handle undefined bonusProjects as 0', () => {
            const user = {
                uid: 'user-1',
                email: 'test@example.com',
                tier: 'beta',
                projectCount: 3
            } as User;

            // Beta (3) + 0 bonus = 3, at 3 cannot create
            expect(canCreateProject(user)).toBe(false);
        });

        it('should handle undefined projectCount as 0', () => {
            const user = {
                uid: 'user-1',
                email: 'test@example.com',
                tier: 'beta'
            } as User;

            expect(canCreateProject(user)).toBe(true);
        });
    });
});

describe('getProjectAllowance', () => {
    it('should return null for null user', () => {
        expect(getProjectAllowance(null)).toBeNull();
    });

    it('should return correct allowance for free tier', () => {
        const user = {
            uid: 'user-1',
            email: 'test@example.com',
            tier: 'free',
            projectCount: 0,
            bonusProjects: 0
        } as User;

        expect(getProjectAllowance(user)).toEqual({ current: 0, limit: 0 });
    });

    it('should return correct allowance for beta tier', () => {
        const user = {
            uid: 'user-1',
            email: 'test@example.com',
            tier: 'beta',
            projectCount: 2,
            bonusProjects: 0
        } as User;

        expect(getProjectAllowance(user)).toEqual({ current: 2, limit: 3 });
    });

    it('should return correct allowance for premium tier', () => {
        const user = {
            uid: 'user-1',
            email: 'test@example.com',
            tier: 'premium',
            projectCount: 50,
            bonusProjects: 0
        } as User;

        expect(getProjectAllowance(user)).toEqual({ current: 50, limit: 100 });
    });

    it('should include bonus projects in limit', () => {
        const user = {
            uid: 'user-1',
            email: 'test@example.com',
            tier: 'beta',
            projectCount: 1,
            bonusProjects: 5
        } as User;

        // Beta (3) + 5 bonus = 8
        expect(getProjectAllowance(user)).toEqual({ current: 1, limit: 8 });
    });

    it('should return Infinity limit for admin users', () => {
        const user = {
            uid: 'admin-1',
            email: 'admin@example.com',
            tier: 'free',
            projectCount: 10,
            isAdmin: true
        } as User;

        expect(getProjectAllowance(user)).toEqual({ current: 10, limit: Infinity });
    });

    it('should default missing tier to free', () => {
        const user = {
            uid: 'user-1',
            email: 'test@example.com',
            projectCount: 0
        } as User;

        expect(getProjectAllowance(user)).toEqual({ current: 0, limit: 0 });
    });

    it('should handle missing projectCount as 0', () => {
        const user = {
            uid: 'user-1',
            email: 'test@example.com',
            tier: 'beta'
        } as User;

        expect(getProjectAllowance(user)).toEqual({ current: 0, limit: 3 });
    });

    it('should handle missing bonusProjects as 0', () => {
        const user = {
            uid: 'user-1',
            email: 'test@example.com',
            tier: 'beta',
            projectCount: 1
        } as User;

        expect(getProjectAllowance(user)).toEqual({ current: 1, limit: 3 });
    });
});
