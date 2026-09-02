import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import {
  makeMirrorDefinition,
  makeMirrorCompute,
  makeMirrorStage,
  makeMirrorEducation,
  mirrorNotebook
} from '../optics/mirrorFactory';

import { meta } from './convex-mirror.meta';

export { meta };

const config = {
  concave: false,
  id: meta.id,
  slug: meta.slug,
  title: meta.title,
  shortTitle: meta.shortTitle,
  aim: meta.aim,
  practicalNo: meta.practicalNo
};

const definition = makeMirrorDefinition(config);
const education = makeMirrorEducation(config);

const Stage = makeMirrorStage(config);

export default function ConvexMirrorExperiment() {
  return (
    <PhysicsExperiment
      definition={definition}
      education={education}
      compute={makeMirrorCompute(config)}
      renderStage={(api) => <Stage {...api} />}
      notebook={mirrorNotebook(config)}
    />
  );
}

/**
 * Exported for the NCERT alignment audit, which reads the write-up and the
 * control list without mounting the apparatus.
 */
export { definition, education };
