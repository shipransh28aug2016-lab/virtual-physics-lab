import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { makeCoilDefinition, makeCoilCompute, makeCoilStage, makeCoilEducation, coilNotebook } from '../magnetism/_coilFactory';

import { meta } from './helmholtz-coil.meta';

export { meta };

const config = { mode: 'helmholtz' as const, id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim };

const definition = makeCoilDefinition(config);
const education = makeCoilEducation(config);

export default function HelmholtzCoilExperiment() {
  const Stage = makeCoilStage(config);
  return (
    <PhysicsExperiment
      definition={definition}
      education={education}
      compute={makeCoilCompute(config)}
      renderStage={(api) => <Stage {...api} />}
      notebook={coilNotebook(config)}
    />
  );
}

/**
 * Exported for the NCERT alignment audit, which reads the write-up and the
 * control list without mounting the apparatus.
 */
export { definition, education };
