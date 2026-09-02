import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CatalogueShell } from '@/components/common/Catalogue';
import { documentTitle } from '@/app/branding/brand';

export default function SimulatorsPage({ filter }: { filter?: 'physics' }) {
  const [params] = useSearchParams();
  const favouritesOnly = params.get('view') === 'favourites';
  useEffect(() => {
    document.title = documentTitle(filter === 'physics' ? 'Physics simulators' : 'Simulator index');
  }, [filter]);
  return (
    <CatalogueShell
      title={filter === 'physics' ? 'Class XII physics simulators' : 'Simulator index'}
      lede={
        filter === 'physics'
          ? 'Every NCERT physics chapter represented as an interactive apparatus.'
          : 'Every simulation in the lab, searchable by chapter, apparatus, practical number or difficulty.'
      }
      unit="all"
      initialFavouritesOnly={favouritesOnly}
    />
  );
}
