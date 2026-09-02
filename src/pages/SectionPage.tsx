import { useEffect } from 'react';
import { CatalogueShell } from '@/components/common/Catalogue';
import { EXPERIMENTS } from '@/experiments/registry';
import { documentTitle } from '@/app/branding/brand';

export default function SectionPage({ section }: { section: 'a' | 'b' }) {
  const unit = section === 'a' ? 'practical-a' : 'practical-b';
  const items = EXPERIMENTS.filter((e) => e.meta.unit === unit).map((e) => e.meta);
  const title =
    section === 'a' ? 'Section A — Electricity and Magnetism' : 'Section B — Optics';

  useEffect(() => {
    document.title = documentTitle(title);
  }, [title]);

  return (
    <CatalogueShell
      title={title}
      lede={
        section === 'a'
          ? 'Practicals 1–8 from the CBSE Class XII physics list, each with a working apparatus, observation table and graph.'
          : 'Practicals 9–16 from the CBSE Class XII physics list, with ray-accurate optical bench simulations.'
      }
      unit={unit}
      items={items}
      showUnits={false}
    />
  );
}
