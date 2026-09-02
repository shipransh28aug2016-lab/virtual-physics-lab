import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PreferencesProvider } from '@/app/providers/PreferencesProvider';
import { useLang, useLocalized, useT } from './index';

function Probe() {
  const t = useT();
  const { lang, setLang } = useLang();
  const L = useLocalized();
  const meta = { slug: 'ohms-law', title: 'Ohm’s Law', aim: 'verify', unit: 'current-electricity' } as never;
  return (
    <div>
      <button type="button" onClick={() => setLang(lang === 'hi' ? 'en' : 'hi')}>
        toggle
      </button>
      <span data-testid="nav">{t('nav.practicals')}</span>
      <span data-testid="title">{L.metaTitle(meta)}</span>
    </div>
  );
}

describe('i18n', () => {
  it('switches the UI between English and NCERT Devanagari', () => {
    render(
      <PreferencesProvider>
        <Probe />
      </PreferencesProvider>
    );
    expect(screen.getByTestId('nav').textContent).toBe('Practicals');
    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    expect(screen.getByTestId('nav').textContent).toBe('प्रयोग');
    expect(screen.getByTestId('title').textContent).toContain('ओम का नियम');
    // Switch back to English.
    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    expect(screen.getByTestId('nav').textContent).toBe('Practicals');
  });
});
