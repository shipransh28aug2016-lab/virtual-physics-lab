import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/app/layout/AppLayout';
import { EXPERIMENTS } from '@/experiments/registry';
import ExperimentPage from '@/pages/ExperimentPage';

const HomePage = lazy(() => import('@/pages/HomePage'));
const Class12Page = lazy(() => import('@/pages/Class12Page'));
const UnitPage = lazy(() => import('@/pages/UnitPage'));
const SimulatorsPage = lazy(() => import('@/pages/SimulatorsPage'));
const PracticalsPage = lazy(() => import('@/pages/PracticalsPage'));
const SectionPage = lazy(() => import('@/pages/SectionPage'));
const AboutPage = lazy(() => import('@/pages/AboutPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

/**
 * One route per experiment, generated from the registry — adding a simulator
 * file is all it takes for its URL, catalogue entry and unit listing to exist.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="class-12" element={<Class12Page />} />
        <Route path="class-12/:unit" element={<UnitPage />} />
        <Route path="simulators" element={<SimulatorsPage />} />
        <Route path="simulators/physics" element={<SimulatorsPage filter="physics" />} />
        <Route path="practicals" element={<PracticalsPage />} />
        <Route path="practicals/section-a" element={<SectionPage section="a" />} />
        <Route path="practicals/section-b" element={<SectionPage section="b" />} />
        <Route path="about" element={<AboutPage />} />
        {EXPERIMENTS.map((mod) => (
          <Route
            key={mod.meta.slug}
            path={`simulators/physics/${mod.meta.slug}`}
            element={<ExperimentPage module={mod} />}
          />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
