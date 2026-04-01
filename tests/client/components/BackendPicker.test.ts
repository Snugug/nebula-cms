import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import BackendPicker from '../../../src/client/components/BackendPicker.svelte';

/**
 * Tests for the BackendPicker component.
 * Mocks state.svelte to control the backend type and permission state
 * without triggering Svelte 5 rune initialization in jsdom.
 */

// vi.hoisted ensures these declarations are available when vi.mock factories run,
// since vi.mock calls are hoisted to the top of the file by Vitest.
const {
  mockBackendType,
  mockPermissionState,
  mockError,
  mockPickDirectory,
  mockRequestPermission,
  mockConnectGitHub,
} = vi.hoisted(() => ({
  mockBackendType: vi.fn(() => null as string | null),
  mockPermissionState: vi.fn(() => 'denied' as string),
  mockError: vi.fn(() => null as string | null),
  mockPickDirectory: vi.fn(),
  mockRequestPermission: vi.fn(),
  mockConnectGitHub: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../src/client/js/state/state.svelte', () => ({
  backend: {
    get type() {
      return mockBackendType();
    },
    get ready() {
      return false;
    },
    get permission() {
      return mockPermissionState();
    },
  },
  content: {
    get list() {
      return [];
    },
    get loading() {
      return false;
    },
    get error() {
      return mockError();
    },
  },
  pickDirectory: mockPickDirectory,
  requestPermission: mockRequestPermission,
  connectGitHub: mockConnectGitHub,
}));

// Prevent accumulated renders from bleeding between tests
afterEach(() => cleanup());

describe('BackendPicker', () => {
  //////////////////////////////
  // Normal (non-reauth) state
  //////////////////////////////

  it('renders the picker title when not in reauth state', () => {
    mockBackendType.mockReturnValue(null);
    mockPermissionState.mockReturnValue('denied');

    const { container } = render(BackendPicker, { props: {} });
    expect(container.querySelector('.picker-title')?.textContent?.trim()).toBe(
      'Connect to your project',
    );
  });

  it('renders the Local Folder and GitHub options', () => {
    mockBackendType.mockReturnValue(null);
    mockPermissionState.mockReturnValue('denied');

    const { container } = render(BackendPicker, { props: {} });
    const headings = Array.from(container.querySelectorAll('h3')).map((h) =>
      h.textContent?.trim(),
    );

    expect(headings).toContain('Local Folder');
    expect(headings).toContain('GitHub Repository');
  });

  //////////////////////////////
  // pickDirectory
  //////////////////////////////

  it('calls pickDirectory when the "Choose project folder" button is clicked', async () => {
    mockBackendType.mockReturnValue(null);
    mockPermissionState.mockReturnValue('denied');
    mockPickDirectory.mockClear();

    const { container } = render(BackendPicker, { props: {} });

    const buttons = Array.from(container.querySelectorAll('button'));
    const folderBtn = buttons.find(
      (b) => b.textContent?.trim() === 'Choose project folder',
    )!;
    await fireEvent.click(folderBtn);

    expect(mockPickDirectory).toHaveBeenCalledOnce();
  });

  //////////////////////////////
  // GitHub connect
  //////////////////////////////

  it('renders the GitHub form with token and repo inputs', () => {
    mockBackendType.mockReturnValue(null);
    mockPermissionState.mockReturnValue('denied');

    const { container } = render(BackendPicker, { props: {} });

    expect(container.querySelector('input[type="password"]')).not.toBeNull();
    expect(container.querySelector('input[type="text"]')).not.toBeNull();
  });

  it('disables the Connect button when token and repo are empty', () => {
    mockBackendType.mockReturnValue(null);
    mockPermissionState.mockReturnValue('denied');

    const { container } = render(BackendPicker, { props: {} });

    const buttons = Array.from(
      container.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    const connectBtn = buttons.find(
      (b) => b.textContent?.trim() === 'Connect',
    )!;

    expect(connectBtn?.disabled).toBe(true);
  });

  it('calls connectGitHub when the form is submitted with token and repo', async () => {
    mockBackendType.mockReturnValue(null);
    mockPermissionState.mockReturnValue('denied');
    mockConnectGitHub.mockClear();

    const { container } = render(BackendPicker, { props: {} });

    const tokenInput = container.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;
    const repoInput = container.querySelector(
      'input[type="text"]',
    ) as HTMLInputElement;

    await fireEvent.input(tokenInput, { target: { value: 'ghp_token' } });
    await fireEvent.input(repoInput, { target: { value: 'owner/repo' } });

    const form = container.querySelector('form')!;
    await fireEvent.submit(form);

    expect(mockConnectGitHub).toHaveBeenCalledOnce();
    expect(mockConnectGitHub).toHaveBeenCalledWith('ghp_token', 'owner/repo');
  });

  //////////////////////////////
  // Re-auth state
  //////////////////////////////

  it('renders the re-auth message when backend is fsa and permission is prompt', () => {
    mockBackendType.mockReturnValue('fsa');
    mockPermissionState.mockReturnValue('prompt');

    const { container } = render(BackendPicker, { props: {} });

    expect(container.textContent).toContain('re-authorization');
  });

  it('renders a Re-authorize button in the reauth state', () => {
    mockBackendType.mockReturnValue('fsa');
    mockPermissionState.mockReturnValue('prompt');

    const { container } = render(BackendPicker, { props: {} });

    const buttons = Array.from(container.querySelectorAll('button'));
    const reauthBtn = buttons.find(
      (b) => b.textContent?.trim() === 'Re-authorize folder',
    );
    expect(reauthBtn).not.toBeUndefined();
  });

  it('calls requestPermission when the Re-authorize button is clicked', async () => {
    mockBackendType.mockReturnValue('fsa');
    mockPermissionState.mockReturnValue('prompt');
    mockRequestPermission.mockClear();

    const { container } = render(BackendPicker, { props: {} });

    const buttons = Array.from(container.querySelectorAll('button'));
    const reauthBtn = buttons.find(
      (b) => b.textContent?.trim() === 'Re-authorize folder',
    )!;
    await fireEvent.click(reauthBtn);

    expect(mockRequestPermission).toHaveBeenCalledOnce();
  });

  //////////////////////////////
  // Error display
  //////////////////////////////

  it('renders the error message when error state is present', () => {
    mockBackendType.mockReturnValue(null);
    mockPermissionState.mockReturnValue('denied');
    mockError.mockReturnValue('Something went wrong');

    const { container } = render(BackendPicker, { props: {} });

    expect(container.querySelector('.error')?.textContent?.trim()).toBe(
      'Something went wrong',
    );
  });

  it('does not render an error when error state is null', () => {
    mockBackendType.mockReturnValue(null);
    mockPermissionState.mockReturnValue('denied');
    mockError.mockReturnValue(null);

    const { container } = render(BackendPicker, { props: {} });

    expect(container.querySelector('.error')).toBeNull();
  });
});
