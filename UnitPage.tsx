import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { CatalogueShell } from '@/components/common/Catalogue';
import { UNITS } from '@/data/units';
import { byUnit } from '@/experiments/registry';
import type { UnitSlug } from '@/types/lab';
import { documentTitle } from '@/app/branding/brand';

export default function UnitPage() {
  const { unit } = useParams<{ unit: string }>();
  const meta = UNITS.find((u) => u.slug === unit);

  useEffect(() => {
    if (meta) document.title = documentTitle(meta.label);
  }, [meta]);

  if (!meta) return <Navigate to="/class-12" replace />;
  const items = byUnit(meta.slug as UnitSlug).map((e) => e.meta);

  return (
    <CatalogueShell
      title={meta.label}
      lede={`${meta.ncert} — ${meta.description} ${items.length} interactive experiment${items.length === 1 ? '' : 's'} in this unit.`}
      unit={meta.slug}
      items={items}
      showUnits={false}
    />
  );
}
