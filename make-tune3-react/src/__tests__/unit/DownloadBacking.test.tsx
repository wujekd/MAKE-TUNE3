import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DownloadBacking } from '../../components/DownloadBacking';

const hoistedMocks = vi.hoisted(() => ({
  markBackingDownloaded: vi.fn(),
  getBlobMock: vi.fn(),
  refMock: vi.fn()
}));

vi.mock('../../services', () => ({
  UserService: {
    markBackingDownloaded: hoistedMocks.markBackingDownloaded
  }
}));

vi.mock('firebase/storage', () => ({
  ref: (_storage: unknown, path: string) => {
    hoistedMocks.refMock(path);
    return { path };
  },
  getBlob: hoistedMocks.getBlobMock
}));

const { markBackingDownloaded, getBlobMock, refMock } = hoistedMocks;

const originalCreateObjectURL = global.URL.createObjectURL;
const originalRevokeObjectURL = global.URL.revokeObjectURL;
const originalAnchorClick = HTMLAnchorElement.prototype.click;

describe('DownloadBacking', () => {
  beforeEach(() => {
    markBackingDownloaded.mockReset();
    getBlobMock.mockReset();
    refMock.mockReset();

    getBlobMock.mockResolvedValue(new Blob(['test'], { type: 'audio/mpeg' }));
    markBackingDownloaded.mockResolvedValue(undefined);

    (global.URL as any).createObjectURL = vi.fn(() => 'blob:test');
    (global.URL as any).revokeObjectURL = vi.fn();
    HTMLAnchorElement.prototype.click = vi.fn();
  });

  afterEach(() => {
    (global.URL as any).createObjectURL = originalCreateObjectURL;
    (global.URL as any).revokeObjectURL = originalRevokeObjectURL;
    HTMLAnchorElement.prototype.click = originalAnchorClick;
  });

  it('downloads the backing track via Firebase storage and records the download', async () => {
    render(
      <DownloadBacking
        userId="user-1"
        collaborationId="collab-1"
        backingPath="collabs/collab-1/backing.mp3"
      />
    );

    const button = screen.getByRole('button', { name: /download/i });
    expect(button).toBeEnabled();

    fireEvent.click(button);

    await waitFor(() => {
      expect(getBlobMock).toHaveBeenCalledTimes(1);
      expect(refMock).toHaveBeenCalledWith('collabs/collab-1/backing.mp3');
      expect(markBackingDownloaded).toHaveBeenCalledWith(
        'user-1',
        'collab-1',
        'collabs/collab-1/backing.mp3'
      );
    });
  });
});
