import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const sourceRoot = join(process.cwd(), 'src');
const sourceDirs = ['App.tsx', 'components', 'hooks', 'views'].map(entry => join(sourceRoot, entry));

const collectSourceFiles = (path: string): string[] => {
  const stat = statSync(path);
  if (stat.isFile()) {
    return /\.(tsx|ts)$/.test(path) ? [path] : [];
  }

  return readdirSync(path).flatMap(entry => collectSourceFiles(join(path, entry)));
};

const broadSubscriptionPatterns = [
  /useAppStore\(\s*(?:state|s)\s*=>\s*(?:state|s)\.(?:auth|collaboration|playback)\s*\)/,
  /useUIStore\(\s*\)/,
  /useAudioStore\(\s*\)/,
  /usePlaybackStore\(\s*\)/,
];

describe('Zustand subscriptions', () => {
  it('keeps React component and hook subscriptions focused on fields/actions', () => {
    const offenders = sourceDirs
      .flatMap(collectSourceFiles)
      .flatMap(file => {
        const source = readFileSync(file, 'utf8');
        return broadSubscriptionPatterns
          .filter(pattern => pattern.test(source))
          .map(pattern => `${relative(sourceRoot, file)} matched ${pattern}`);
      });

    expect(offenders).toEqual([]);
  });
});
