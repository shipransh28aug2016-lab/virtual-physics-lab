import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { makeLensDefinition, makeLensCompute, makeLensStage, makeLensEducation, lensNotebook } from '../optics/lensFactory';

import { meta } from './concave-lens.meta';

export { meta };

const config = { convex: false, meta };

const definition = makeLensDefinition(config);
const education = makeLensEducation(config);

export default function ConcaveLensExperiment() {
  const Stage = makeLensStage(config);
  return (
    <PhysicsExperiment
      definition={definition}
      education={education}
      compute={makeLensCompute(config)}
      renderStage={(api) => <Stage {...api} />}
      notebook={lensNotebook(config)}
    />
  );
}

/**
 * Exported for the NCERT alignment audit, which reads the write-up and the
 * control list without mounting the apparatus.
 */
export { definition, education };
