import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { makeDefectDefinition, makeDefectCompute, makeDefectStage, makeDefectEducation, defectNotebook } from '../optics/defectVisionFactory';

import { meta } from './myopia.meta';

export { meta };

const config = { defect: 'myopia' as const, id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim };

const definition = makeDefectDefinition(config);
const education = makeDefectEducation(config);

export default function MyopiaExperiment() {
  const Stage = makeDefectStage(config);
  return (
    <PhysicsExperiment
      definition={definition}
      education={education}
      compute={makeDefectCompute(config)}
      renderStage={(api) => <Stage {...api} />}
      notebook={defectNotebook(config)}
    />
  );
}

/**
 * Exported for the NCERT alignment audit, which reads the write-up and the
 * control list without mounting the apparatus.
 */
export { definition, education };
