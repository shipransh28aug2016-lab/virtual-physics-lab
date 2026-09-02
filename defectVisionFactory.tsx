import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { SvgDefs } from '@/components/shell/Viewport';
import { myopiaCorrection, hypermetropiaCorrection, lensPower } from '@/physics-engine/optics';
import { formatSI } from '@/utils/format';
import { col, num, ro } from '../experiments/_shared';
import { Knob, StageSwitch, type StageApi } from '@/components/controls/StageKit';
import { BenchBoard } from '@/components/instruments/BenchBoard';

/**
 * Myopia and hypermetropia are the same optical bench with the eye's focal
 * power shifted in opposite directions, so one factory produces both.
 */
export interface DefectConfig {
  defect: 'myopia' | 'hypermetropia';
  id: string;
  slug: string;
  title: string;
  shortTitle: string;
  aim: string;
}

const EYE = { cx: 430, cy: 210, rx: 105, ry: 78, retinaX: 528 };

export function makeDefectDefinition(c: DefectConfig): ExperimentDefinition {
  const myopic = c.defect === 'myopia';
  return {
    id: c.id, slug: c.slug, title: c.title, shortTitle: c.shortTitle, aim: c.aim,
    unit: 'optics', chapter: 'Unit VI · Ray Optics and Optical Instruments',
    kind: 'theory', difficulty: 'easy', thumbLabel: c.shortTitle, accent: '#25d0ee',
    controls: [
      myopic
        ? { kind: 'slider', key: 'farPoint', label: 'Far point of the eye', symbol: 'd_f', unit: 'cm', min: 15, max: 200, step: 1, initial: 60, hint: 'The farthest object seen clearly without a lens' }
        : { kind: 'slider', key: 'nearPoint', label: 'Near point of the eye', symbol: 'd_n', unit: 'cm', min: 26, max: 200, step: 1, initial: 75, hint: 'The closest object seen clearly without a lens' },
      { kind: 'slider', key: 'obj', label: 'Object distance', symbol: 'u', unit: 'cm', min: 10, max: 400, step: 1, initial: myopic ? 150 : 25 },
      { kind: 'toggle', key: 'glasses', label: 'Wear the correcting lens', initial: true },
      { kind: 'slider', key: 'power', label: 'Lens power used', symbol: 'P', unit: 'D', min: -8, max: 8, step: 0.25, initial: myopic ? -1.75 : 2.5, precision: 2, hint: 'Compare with the calculated prescription' }
    ],
    defaults: myopic
      ? { farPoint: 60, obj: 150, glasses: true, power: -1.75 }
      : { nearPoint: 75, obj: 25, glasses: true, power: 2.5 }
  };
}

export function makeDefectCompute(c: DefectConfig) {
  const myopic = c.defect === 'myopia';
  return function compute(params: ParamValues): ModelOutput {
    const farPoint = num(params, 'farPoint', 60) / 100;
    const nearPoint = num(params, 'nearPoint', 75) / 100;
    const obj = num(params, 'obj', myopic ? 150 : 25) / 100;
    const glasses = Boolean(params.glasses ?? true);
    const power = num(params, 'power', myopic ? -1.75 : 2.5);

    const ideal = myopic ? myopiaCorrection(farPoint) : hypermetropiaCorrection(nearPoint);
    const idealPower = lensPower(ideal);
    const mismatch = Math.abs(power - idealPower);
    const sharp = !glasses
      ? myopic
        ? obj <= farPoint
        : obj >= nearPoint
      : mismatch < 0.3;

    const imagePosition = myopic
      ? Math.min(obj, farPoint) * (obj > farPoint ? 0.86 : 1)
      : obj;
    const points: { x: number; y: number }[] = [];
    for (let d = 10; d <= 400; d += 2) {
      points.push({ x: d, y: myopic ? Math.min(d, farPoint * 100) : Math.max(d, nearPoint * 100) });
    }

    return {
      readouts: [
        myopic
          ? ro('fp', 'Far point', farPoint, 'm', 3, { sub: `${(farPoint * 100).toFixed(0)} cm` })
          : ro('np', 'Near point', nearPoint, 'm', 3, { sub: `${(nearPoint * 100).toFixed(0)} cm` }),
        ro('u', 'Object distance', obj, 'm', 3, { sub: `${(obj * 100).toFixed(0)} cm` }),
        ro('f', 'Focal length of the correction', ideal, 'm', 3, { sub: `${(ideal * 100).toFixed(1)} cm`, tone: ideal < 0 ? 'neg' : 'normal' }),
        ro('p', 'Prescribed power', idealPower, 'D', 2, { sub: myopic ? 'concave lens' : 'convex lens' }),
        ro('pu', 'Power of the lens worn', power, 'D', 2, { tone: mismatch < 0.3 ? 'normal' : 'alert' }),
        ro('sharp', 'Image on the retina', sharp ? 1 : 0, '\u2014', 0, { text: sharp ? 'sharp' : 'blurred', tone: sharp ? 'normal' : 'alert' }),
        ro('v', 'Image formed at', imagePosition, 'm', 3, { sub: myopic ? (obj > farPoint ? 'in front of the retina' : 'on the retina') : 'behind the retina' })
      ],
      graph: {
        title: myopic ? 'Farthest clearly seen distance against the far point' : 'Nearest clearly seen distance against the near point',
        xLabel: 'object distance (cm)', yLabel: 'image distance (cm)',
        series: [{ key: 'v', label: 'v', color: '#25d0ee', points }]
      },
      live: { x: obj * 100, y: imagePosition * 100 },
      description: myopic
        ? `With a far point of ${(farPoint * 100).toFixed(0)} cm, an object at ${(obj * 100).toFixed(0)} cm forms its image ${obj > farPoint ? 'in front of the retina, so it is blurred' : 'on the retina, so it is sharp'}. A concave lens of focal length ${(ideal * 100).toFixed(1)} cm (${idealPower.toFixed(2)} D) brings the image back onto the retina.`
        : `With a near point of ${(nearPoint * 100).toFixed(0)} cm, an object at the normal reading distance of 25 cm cannot be focused. A convex lens of focal length ${(ideal * 100).toFixed(1)} cm (${idealPower.toFixed(2)} D) forms a virtual image at the near point so the eye can see it clearly.`,
      result: myopic
        ? `f = \u2212far point = \u2212${(farPoint * 100).toFixed(0)} cm, so P = 1/f = ${idealPower.toFixed(2)} D (concave). The lens worn has ${power.toFixed(2)} D, ${mismatch < 0.3 ? 'which matches the prescription' : `which differs by ${mismatch.toFixed(2)} D and leaves the image blurred`}.`
        : `1/f = 1/v \u2212 1/u = 1/(\u2212${(nearPoint * 100).toFixed(0)}) \u2212 1/(\u221225), giving f = ${(ideal * 100).toFixed(1)} cm and P = ${idealPower.toFixed(2)} D (convex). The lens worn has ${power.toFixed(2)} D, ${mismatch < 0.3 ? 'matching the prescription' : `differing by ${mismatch.toFixed(2)} D`}.`
    };
  };
}

export function makeDefectStage(c: DefectConfig) {
  const myopic = c.defect === 'myopia';
  return function Stage({ params, set, control }: StageApi) {
    const farPoint = num(params, 'farPoint', 60) / 100;
    const nearPoint = num(params, 'nearPoint', 75) / 100;
    const obj = num(params, 'obj', myopic ? 150 : 25) / 100;
    const glasses = Boolean(params.glasses ?? true);
    const power = num(params, 'power', myopic ? -1.75 : 2.5);
    const ideal = myopic ? myopiaCorrection(farPoint) : hypermetropiaCorrection(nearPoint);
    const mismatch = Math.abs(power - lensPower(ideal));
    const sharp = !glasses ? (myopic ? obj <= farPoint : obj >= nearPoint) : mismatch < 0.3;

    const scale = 420 / 400;
    const objX = EYE.cx - 250 - Math.min(obj * 100, 250) * scale * 0.35;
    const focusX = myopic
      ? sharp ? EYE.retinaX : EYE.retinaX - 34
      : sharp ? EYE.retinaX : EYE.retinaX + 30;
    const lensX = EYE.cx - 150;

    return (
      <svg viewBox="0 0 800 420" className="svg-lab" preserveAspectRatio="xMidYMid meet">
        <SvgDefs />
        <BenchBoard x={20} y={40} width={760} height={330} rx={12} />
        <ellipse cx={EYE.cx} cy={EYE.cy} rx={EYE.rx} ry={EYE.ry} fill="url(#lab-glass)" stroke="#3a5568" strokeWidth={2} />
        <path d={`M${EYE.cx + 30} ${EYE.cy - 40} Q${EYE.cx + 62} ${EYE.cy} ${EYE.cx + 30} ${EYE.cy + 40}`} fill="none" stroke="#8fd4ea" strokeWidth={5} strokeLinecap="round" />
        <line x1={EYE.retinaX} y1={EYE.cy - 60} x2={EYE.retinaX} y2={EYE.cy + 60} stroke="#ff7a90" strokeWidth={4} />
        <text x={EYE.retinaX} y={EYE.cy + 76} textAnchor="middle" fontSize={9.5} fill="#ff7a90">retina</text>
        <text x={EYE.cx + 46} y={EYE.cy - 50} fontSize={9.5} fill="#8fd4ea">eye lens</text>
        {glasses ? (
          <g transform={`translate(${lensX} ${EYE.cy})`}>
            <path
              d={power < 0 ? 'M0 -54 Q-10 0 0 54 M0 -54 Q10 0 0 54' : 'M0 -54 Q12 0 0 54 M0 -54 Q-12 0 0 54'}
              fill="none"
              stroke={power < 0 ? '#9d8cff' : '#45d68b'}
              strokeWidth={3}
            />
            <text y={70} textAnchor="middle" fontSize={9.5} fill="#8497ad">
              {power.toFixed(2)} D
            </text>
          </g>
        ) : null}
        <g transform={`translate(${objX} ${EYE.cy})`}>
          <line x1={0} y1={26} x2={0} y2={-26} stroke="#ffc65c" strokeWidth={3} markerEnd="url(#lab-arrow)" />
          <text y={44} textAnchor="middle" fontSize={9.5} fill="#ffc65c">object {(obj * 100).toFixed(0)} cm</text>
        </g>
        {[-20, 20].map((dy) => (
          <g key={dy}>
            <line x1={objX} y1={EYE.cy + dy} x2={EYE.cx + 30} y2={EYE.cy + dy * 0.5} stroke="#25d0ee" strokeWidth={1.6} />
            <line
              x1={EYE.cx + 30}
              y1={EYE.cy + dy * 0.5}
              x2={focusX}
              y2={EYE.cy}
              stroke={sharp ? '#45d68b' : '#ff7a90'}
              strokeWidth={1.8}
            />
            {!sharp ? (
              <line
                x1={focusX}
                y1={EYE.cy}
                x2={EYE.retinaX}
                y2={EYE.cy - dy * 1.4}
                stroke="#ff7a90"
                strokeWidth={1.4}
                strokeDasharray="5 4"
              />
            ) : null}
          </g>
        ))}
        <circle cx={sharp ? EYE.retinaX : focusX} cy={EYE.cy} r={sharp ? 5 : 9} fill={sharp ? '#45d68b' : '#ff7a90'} opacity={sharp ? 1 : 0.45} />
        <text x={400} y={68} textAnchor="middle" fontSize={13} fill="#eaf1f8" fontWeight={600}>
          {myopic ? 'Myopia — image forms in front of the retina' : 'Hypermetropia — image would form behind the retina'}
        </text>
        <text x={400} y={392} textAnchor="middle" fontSize={10.5} fill="#5e7189">
          {myopic ? `far point ${(farPoint * 100).toFixed(0)} cm · correction ${formatSI(ideal, 3)} m (${lensPower(ideal).toFixed(2)} D)` : `near point ${(nearPoint * 100).toFixed(0)} cm · correction ${formatSI(ideal, 3)} m (${lensPower(ideal).toFixed(2)} D)`}
        </text>
        <text x={400} y={352} textAnchor="middle" fontSize={11} fill={sharp ? '#45d68b' : '#ff7a90'}>
          {sharp ? 'image falls on the retina — clear vision' : 'image misses the retina — blurred vision'}
        </text>
        <Knob
          spec={control('obj', 'slider')}
          params={params}
          onChange={(key, value) => set(key, value)}
          x={130}
          y={382}
          radius={18}
          label="Object distance — move the reading card"
        />
        <StageSwitch
          spec={control('glasses', 'toggle')}
          params={params}
          onChange={(key, value) => set(key, value)}
          x={660}
          y={382}
          label="Wear the correcting lens"
        />
            </svg>
    );
  };
}

export function makeDefectEducation(c: DefectConfig): EducationPack {
  const myopic = c.defect === 'myopia';
  return {
    theory: myopic
      ? [
          'A myopic eye can see near objects clearly but not distant ones. The eyeball is too long, or the eye lens is too powerful, so parallel rays from a distant object are brought to a focus in front of the retina.',
          'The farthest point that can be seen clearly is called the far point. For a normal eye it is at infinity; for a myopic eye it is at a finite distance.',
          'The defect is corrected by a concave lens whose focal length equals the distance of the far point. The lens diverges the incoming parallel rays so that they appear to come from the far point, and the eye then focuses them onto the retina.'
        ]
      : [
          'A hypermetropic eye can see distant objects clearly but has difficulty with near ones. The eyeball is too short, or the eye lens is too weak, so rays from a near object would converge behind the retina.',
          'The closest point that can be seen clearly is called the near point. For a normal eye it is 25 cm; for a hypermetropic eye it is farther away.',
          'The defect is corrected by a convex lens that forms a virtual image of an object at 25 cm at the actual near point of the eye, so the eye can focus it onto the retina.'
        ],
    formulas: myopic
      ? [
          { tex: 'f = -d_f', caption: 'Focal length of the correcting concave lens.' },
          { tex: 'P = \\frac{1}{f}', caption: 'Power in dioptres, f in metres.' }
        ]
      : [
          { tex: '\\frac{1}{f} = \\frac{1}{v} - \\frac{1}{u}', caption: 'Lens formula for the correction.' },
          { tex: 'u = -25 \\text{ cm}, \\; v = -d_n', caption: 'Object at the normal near point, image at the actual near point.' },
          { tex: 'P = \\frac{1}{f}', caption: 'Power in dioptres.' }
        ],
    variables: myopic
      ? [
          { symbol: 'd_f', name: 'Far point', unit: 'm' },
          { symbol: 'f', name: 'Focal length of the correction', unit: 'm' },
          { symbol: 'P', name: 'Power of the lens', unit: 'D' }
        ]
      : [
          { symbol: 'd_n', name: 'Near point', unit: 'm' },
          { symbol: 'f', name: 'Focal length of the correction', unit: 'm' },
          { symbol: 'P', name: 'Power of the lens', unit: 'D' }
        ],
    procedure: [
      myopic ? 'Set the far point of the eye and place an object beyond it.' : 'Set the near point of the eye and place an object at 25 cm.',
      'Observe where the rays converge and note that the image misses the retina.',
      'Put on the correcting lens and adjust its power until the image falls on the retina.',
      'Compare the power used with the calculated prescription.'
    ],
    precautions: [
      'The eye lens changes its focal length by accommodation, so the values quoted apply to the relaxed eye.',
      'A real prescription also includes a cylindrical term for astigmatism, which is not modelled here.',
      'Lens powers are quoted in steps of 0.25 dioptre in practice.'
    ],
    tips: myopic
      ? ['A −2 D lens has a focal length of −50 cm, which is the far point of the corrected eye.']
      : ['A +2 D lens lets an eye with a 50 cm near point read comfortably at 25 cm.'],
    viva: myopic
      ? [
          { q: 'What causes myopia?', a: 'An eyeball that is too long or an eye lens that is too powerful, so the image forms in front of the retina.' },
          { q: 'Which lens corrects it?', a: 'A concave lens of focal length equal to the distance of the far point.' },
          { q: 'Where is the far point of a myopic eye?', a: 'At a finite distance in front of the eye, not at infinity.' },
          { q: 'Why is the power of the correcting lens negative?', a: 'Because a diverging lens is needed, and diverging lenses have negative focal length.' }
        ]
      : [
          { q: 'What causes hypermetropia?', a: 'An eyeball that is too short or an eye lens that is too weak, so the image would form behind the retina.' },
          { q: 'Which lens corrects it?', a: 'A convex lens that forms a virtual image at the near point of the eye.' },
          { q: 'Where is the near point of a hypermetropic eye?', a: 'Farther than 25 cm from the eye.' },
          { q: 'Why is the power of the correcting lens positive?', a: 'Because a converging lens is needed to add focusing power to the eye.' }
        ],
    resultTemplate: myopic
      ? 'The myopic eye is corrected by a concave lens of focal length equal to the far point, of power … dioptre.'
      : 'The hypermetropic eye is corrected by a convex lens of focal length … cm, of power … dioptre.'
  };
}

export const defectNotebook = (c: DefectConfig) => ({ params: p }: { params: ParamValues; rows: Record<string, number | string>[] }) => {
  const myopic = c.defect === 'myopia';
  const farPoint = num(p, 'farPoint', 60) / 100;
  const nearPoint = num(p, 'nearPoint', 75) / 100;
  const obj = num(p, 'obj', myopic ? 150 : 25) / 100;
  const ideal = myopic ? myopiaCorrection(farPoint) : hypermetropiaCorrection(nearPoint);
  return {
    title: `Observation table — ${c.shortTitle}`,
    columns: [
      col('u', 'u', 'cm', 1),
      col('pt', myopic ? 'far point' : 'near point', 'cm', 1),
      col('f', 'f needed', 'cm', 2, true),
      col('pw', 'P', 'D', 2, true)
    ],
    capture: () => ({ u: obj * 100, pt: (myopic ? farPoint : nearPoint) * 100, f: 0, pw: 0 }),
    derive: () => ({ f: ideal * 100, pw: lensPower(ideal) }),
    extraFoot: [{ label: 'prescription', value: `${lensPower(ideal).toFixed(2)} D (${myopic ? 'concave' : 'convex'})` }]
  };
};
