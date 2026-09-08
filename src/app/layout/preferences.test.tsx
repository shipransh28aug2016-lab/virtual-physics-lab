import { describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { PreferencesProvider } from '@/app/providers/PreferencesProvider';
import { labAudio } from '@/lab/audio';

const mount = () =>
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <PreferencesProvider>
        <AppLayout>
          <p>bench</p>
        </AppLayout>
      </PreferencesProvider>
    </MemoryRouter>
  );

describe('the shell exposes the lab preferences', () => {
  it('starts with apparatus sound off', () => {
    mount();
    const button = screen.getByRole('button', { name: /turn apparatus sound on/i });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(labAudio.isEnabled).toBe(false);
    cleanup();
  });

  it('turns sound on and back off from the header', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole('button', { name: /turn apparatus sound on/i }));
    expect(labAudio.isEnabled).toBe(true);
    await user.click(screen.getByRole('button', { name: /turn apparatus sound off/i }));
    expect(labAudio.isEnabled).toBe(false);
    cleanup();
  });

  it('drives the motion preference onto the document, where the CSS reads it', async () => {
    const user = userEvent.setup();
    mount();
    expect(document.documentElement.dataset.motion).toBe('on');
    await user.click(screen.getByRole('button', { name: /motion on/i }));
    expect(document.documentElement.dataset.motion).toBe('off');
    cleanup();
  });
});
