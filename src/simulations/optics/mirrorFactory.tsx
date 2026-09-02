import type { EducationPack, ExperimentDefinition, ObservationRow, ParamValues } from '@/types/lab';
import type { ExperimentMeta } from '@/experiments/registry';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { mirrorImage } from '@/physics-engine/optics';
import {
  OpticsBench,
  benchGeometry,
  xOf,
  yOf,
  FocalMarks,
  type BenchRay
} from '@/components/instruments/OpticsBench';
import { MirrorSvg } from '@/components/instruments/Instruments';
import { col, num, ro } from '../experiments/_shared';
import { DragX, DragY, type StageApi } from '@/components/controls/StageKit';
import { formatFixed } from '@/utils/format';

/**
 * Concave and convex mirrors share one apparatus: the same bench, the same ray
 * construction and the same observation table. Only the sign of the focal
 * length and the wording change, so both are generated from this factory.
 */
export interface MirrorConfig {
  concave: boolean;
  /** The catalogue entry this simulator is built from. */
  meta: ExperimentMeta;
}

export function makeMirrorDefinition(config: MirrorConfig): ExperimentDefinition {
  return {
    id: config.meta.id,
    slug: config.meta.slug,
    title: config.meta.title,
    shortTitle: config.meta.shortTitle,
    aim: config.meta.aim,
    unit: config.meta.unit,
    chapter: config.meta.chapter,
    kind: config.meta.kind,
    difficulty: config.meta.difficulty,
    practicalNo: config.meta.practicalNo,
    thumbLabel: config.meta.shortTitle,
    accent: '#ffd257',
    controls: [
      {
        kind: 'slider',
        key: 'u',
        label: 'Object distance',
        symbol: 'u',
        unit: 'cm',
        min: 4,
        max: 60,
        step: 0.5,
        initial: config.concave ? 30 : 30,
        precision: 1,
        hint: 'Measured from the pole along the principal axis'
      },
      {
        kind: 'slider',
        key: 'radius',
        label: 'Radius of curvature',
        symbol: 'R',
        unit: 'cm',
        min: 6,
        max: 60,
        step: 0.5,
        initial: 24,
        precision: 1
      },
      {
        kind: 'slider',
        key: 'height',
        label: 'Object height',
        symbol: 'h',
        unit: 'cm',
        min: 0.5,
        max: 4,
        step: 0.1,
        initial: 1.5,
        precision: 1
      },
      { kind: 'toggle', key: 'showRays', label: 'Show construction rays', initial: true }
    ],
    defaults: { u: 30, radius: 24, height: 1.5, showRays: true }
  };
}

export function makeMirrorCompute(config: MirrorConfig) {
  return function compute(params: ParamValues): ModelOutput {
    const uCm = num(params, 'u', 30);
    const rCm = num(params, 'radius', 24);
    const hCm = num(params, 'height', 1.5);
    const img = mirrorImage(uCm / 100, rCm / 100, config.concave, hCm / 100);

    const vCm = Number.isFinite(img.imageDistance) ? img.imageDistance * 100 : Number.POSITIVE_INFINITY;
    const fCm = img.focalLength * 100;

    const points: { x: number; y: number }[] = [];
    for (let u = 4; u <= 60; u += 0.5) {
      const r = mirrorImage(u / 100, rCm / 100, config.concave, hCm / 100);
      if (Number.isFinite(r.imageDistance)) points.push({ x: u, y: r.imageDistance * 100 });
    }

    const nature = img.isReal
      ? img.isErect
        ? 'real and erect'
        : 'real and inverted'
      : img.isErect
      ? 'virtual and erect'
      : 'virtual and inverted';

    return {
      readouts: [
        ro('v', 'Image distance v', vCm, 'cm', 2, { tone: Number.isFinite(vCm) ? 'normal' : 'alert' }),
        ro('m', 'Magnification m', img.magnification, '×', 3, { tone: img.magnification < 0 ? 'neg' : 'normal' }),
        ro('h', 'Image height', img.imageHeight * 100, 'cm', 2),
        ro('f', 'Focal length f', fCm, 'cm', 2, { sub: config.concave ? 'concave' : 'convex' }),
        ro('nature', 'Image type', img.isReal ? 1 : 0, '', 0, { sub: nature, text: img.isReal ? 'REAL' : 'VIRTUAL' }),
        ro('ratio', 'Mirror equation check', Number.isFinite(vCm) ? 1 / vCm + 1 / -uCm : Number.NaN, 'cm⁻¹', 4, { sub: 'must equal 1/f' })
      ],
      graph: {
        title: config.concave ? 'Image distance against object distance (concave mirror)' : 'Image distance against object distance (convex mirror)',
        xLabel: 'u (cm)',
        yLabel: 'v (cm)',
        series: [{ key: 'v', label: 'v(u)', color: '#ffd257', points }],
        guides: [
          { axis: 'x', value: Math.abs(fCm), label: 'F', color: '#ffc65c' },
          { axis: 'x', value: Math.abs(fCm) * 2, label: 'C', color: '#9d8cff' }
        ]
      },
      live: Number.isFinite(vCm) ? { x: uCm, y: vCm } : null,
      description: `A ${config.concave ? 'concave' : 'convex'} mirror of radius of curvature ${rCm.toFixed(1)} centimetre with an object ${uCm.toFixed(1)} centimetre from the pole. The image forms ${Math.abs(vCm).toFixed(1)} centimetre from the pole and is ${nature}, with magnification ${img.magnification.toFixed(2)}.`,
      result: `For u = ${uCm.toFixed(1)} cm and R = ${rCm.toFixed(1)} cm (f = ${fCm.toFixed(2)} cm), the image forms at v = ${vCm.toFixed(2)} cm. It is ${nature} with magnification m = ${img.magnification.toFixed(3)} and height ${(img.imageHeight * 100).toFixed(2)} cm. The mirror equation 1/v + 1/u = 1/f is satisfied.`
    };
  };
}

export function makeMirrorStage(config: MirrorConfig) {
  return function Stage({ params, set, control }: StageApi) {
    const uCm = num(params, 'u', 30);
    const rCm = num(params, 'radius', 24);
    const hCm = num(params, 'height', 1.5);
    const showRays = Boolean(params.showRays ?? true);
    const g = benchGeometry(9);
    const img = mirrorImage(uCm / 100, rCm / 100, config.concave, hCm / 100);

    const u = -uCm;
    const oX = xOf(g, u);
    const oY = yOf(g, hCm);
    const iX = Number.isFinite(img.imageDistance) ? xOf(g, img.imageDistance * 100) : null;
    const iY = Number.isFinite(img.imageHeight) ? yOf(g, img.imageHeight * 100) : null;
    const fX = xOf(g, img.focalLength * 100);
    const cX = xOf(g, config.concave ? -rCm : rCm);

    const rays: BenchRay[] = [];
    if (showRays) {
      // Ray parallel to the axis, reflected through (or from) F.
      rays.push({ from: { x: oX, y: oY }, to: { x: g.originX, y: oY } });
      if (iX !== null && iY !== null) {
        rays.push({ from: { x: g.originX, y: oY }, to: { x: iX, y: iY } });
        if (!img.isReal) rays.push({ from: { x: g.originX, y: oY }, to: { x: iX, y: iY }, kind: 'virtual' });
      } else {
        const slope = (g.axisY - oY) / (g.originX - fX);
        rays.push({ from: { x: g.originX, y: oY }, to: { x: g.originX + 300, y: oY - slope * 300 } });
      }

      // Ray through the pole, reflected symmetrically.
      rays.push({ from: { x: oX, y: oY }, to: { x: g.originX, y: g.axisY } });
      const slope = (g.axisY - oY) / (g.originX - oX);
      rays.push({
        from: { x: g.originX, y: g.axisY },
        to: { x: g.originX + 300, y: g.axisY + slope * 300 }
      });
      if (!img.isReal && iX !== null && iY !== null) {
        rays.push({ from: { x: g.originX, y: g.axisY }, to: { x: iX, y: iY }, kind: 'virtual' });
      }

      // Ray aimed at the centre of curvature returns on itself (concave only).
      if (config.concave) {
        const dx = cX - oX;
        const dy = g.axisY - oY;
        const len = Math.hypot(dx, dy) || 1;
        const t = (g.originX - oX) / (dx / len);
        const hitY = oY + (dy / len) * t;
        if (Number.isFinite(hitY) && Math.abs(hitY - g.axisY) < 220) {
          rays.push({ from: { x: oX, y: oY }, to: { x: g.originX, y: hitY } });
          rays.push({ from: { x: g.originX, y: hitY }, to: { x: oX, y: oY }, kind: 'virtual' });
        }
      }
    }

    return (
      <OpticsBench
        geometry={g}
        rays={rays}
        objectX={oX}
        objectHeight={hCm}
        image={img}
        title={`${config.concave ? 'Concave' : 'Convex'} mirror · R = ${rCm.toFixed(1)} cm · f = ${(img.focalLength * 100).toFixed(1)} cm`}
        subtitle={`u = ${uCm.toFixed(1)} cm → v = ${(img.imageDistance * 100).toFixed(2)} cm · m = ${img.magnification.toFixed(3)}`}
        optic={
          <>
            <MirrorSvg
              x={g.originX}
              y={g.axisY}
              radius={(rCm * g.scale) / 100}
              concave={config.concave}
              height={210}
              label="Pole P"
            />
            <FocalMarks
              g={g}
              values={[
                { x: fX, label: 'F' },
                { x: xOf(g, 2 * img.focalLength * 100), label: '2F' },
                ...(config.concave ? [{ x: cX, label: 'C', color: '#9d8cff' }] : [])
              ]}
            />
            <line x1={g.originX} y1={g.axisY - 8} x2={g.originX} y2={g.axisY + 8} stroke="#cfdcea" strokeWidth={2} />
          </>
        }
      >
        {/* Drag the object along the bench; drag its tip to change its height. */}
        <DragX
          spec={control('u', 'slider')}
          params={params}
          onChange={(key, value) => set(key, value)}
          x={g.originX}
          y={g.axisY + 96}
          length={g.originX - xOf(g, -60)}
          mapping={{ toValue: (dx) => -dx / g.scale, invert: (u) => xOf(g, -u) }}
          label="Object distance u — drag along the bench"
        />
        <DragY
          spec={control('height', 'slider')}
          params={params}
          onChange={(key, value) => set(key, value)}
          x={oX - 22}
          y={g.axisY}
          height={g.axisY - yOf(g, 0.5)}
          mapping={{ toValue: (dy) => -dy / g.scale, invert: (h) => yOf(g, h) }}
          label="Object height h — drag the tip"
        />
      </OpticsBench>
    );
  };
}

export function makeMirrorEducation(config: MirrorConfig): EducationPack {
  const concave = config.concave;
  return {
    theory: [
      concave
        ? 'A concave mirror converges parallel rays to a real focus in front of the mirror. The image it forms depends on where the object sits: beyond C the image is real, inverted and diminished; at C it is the same size; between C and F it is magnified; and inside F the mirror produces a virtual, erect, magnified image.'
        : 'A convex mirror diverges parallel rays so that they appear to come from a virtual focus behind the mirror. Whatever the object position, the image is virtual, erect and diminished, and it lies between the pole and the focus. This is why convex mirrors are used as rear-view mirrors — they always give an upright image with a wide field of view.',
      'Both cases are governed by the same mirror equation with the Cartesian sign convention: distances measured against the direction of the incident light are negative. The focal length is −R/2 for a concave mirror and +R/2 for a convex one.',
      'The magnification m = −v/u tells you both the size and the orientation. A negative m means the image is inverted; a positive m means it is erect.'
    ],
    formulas: [
      { tex: '\\frac{1}{v} + \\frac{1}{u} = \\frac{1}{f}', caption: 'Mirror equation with the Cartesian sign convention.' },
      { tex: 'f = \\frac{R}{2}', caption: 'Focal length in terms of the radius of curvature.' },
      { tex: 'm = -\\frac{v}{u} = \\frac{h_i}{h_o}', caption: 'Linear magnification.' }
    ],
    variables: [
      { symbol: 'u', name: 'Object distance', unit: 'm', note: 'Negative in the Cartesian convention' },
      { symbol: 'v', name: 'Image distance', unit: 'm', note: 'Negative means a real image in front of the mirror' },
      { symbol: 'f', name: 'Focal length', unit: 'm' },
      { symbol: 'R', name: 'Radius of curvature', unit: 'm' },
      { symbol: 'm', name: 'Magnification', unit: '—' },
      { symbol: 'h_o, h_i', name: 'Object and image heights', unit: 'm' }
    ],
    procedure: [
      'Mount the mirror on the bench and place the object (a candle or an illuminated slit) in front of it.',
      'Set the object distance, locate the sharp image on the screen and read the image distance.',
      'Record u and v, then repeat for at least six different object distances.',
      'Plot 1/u against 1/v; the intercepts give 1/f, or plot u against v and use the intersection with the line u = v.',
      'Compute f for each reading and take the mean.'
    ],
    precautions: [
      'The mirror must be vertical and its pole must lie on the bench scale.',
      'Parallax between the object and the image must be removed before reading v.',
      'Use a small object so that paraxial rays dominate; wide apertures introduce spherical aberration.',
      'The screen must be perpendicular to the principal axis.'
    ],
    sourcesOfError: [
      'Spherical aberration for rays far from the axis.',
      'Finite thickness of the mirror and uncertainty in locating the pole.',
      'Parallax error while judging the sharpest image.'
    ],
    tips: [
      concave
        ? 'Move the object through F: the image flips from real and inverted to virtual and erect, and v changes sign.'
        : 'Try every object distance you like — the image never becomes real, and it never exceeds the focal length behind the mirror.'
    ],
    viva: [
      {
        q: 'State the mirror formula with the sign convention.',
        a: '1/v + 1/u = 1/f, with all distances measured from the pole and the incident direction taken as negative.'
      },
      {
        q: 'What is the magnification of a convex mirror?',
        a: 'Always positive and less than one: the image is erect and diminished for every object position.'
      },
      {
        q: concave ? 'Where must the object be for a virtual image from a concave mirror?' : 'Can a convex mirror ever form a real image?',
        a: concave
          ? 'Between the pole and the focus, that is u < f.'
          : 'Not with a real object. A real image needs a converging reflected beam, which a convex mirror cannot produce.'
      },
      { q: 'Why are convex mirrors used as rear-view mirrors?', a: 'They always give an erect image and cover a wider field of view than a plane or concave mirror.' },
      { q: 'What is spherical aberration?', a: 'Rays far from the principal axis focus closer to the mirror than paraxial rays, so the image is blurred.' }
    ],
    resultTemplate: 'The mean focal length obtained from the u–v readings agrees with R/2 within the experimental uncertainty.'
  };
}

export const mirrorNotebook = (config: MirrorConfig) => {
  return ({ params: p }: { params: ParamValues; rows: Record<string, number | string>[] }) => {
    const uCm = num(p, 'u', 30);
    const rCm = num(p, 'radius', 24);
    const hCm = num(p, 'height', 1.5);
    const img = mirrorImage(uCm / 100, rCm / 100, config.concave, hCm / 100);
    return {
      title: `Observation table — ${config.meta.shortTitle}`,
      columns: [
        col('u', 'u', 'cm', 1),
        col('v', 'v', 'cm', 2),
        col('m', 'm', '×', 3),
        col('hi', 'h′', 'cm', 2),
        col('f', 'f = uv/(u+v)', 'cm', 2, true)
      ],
      capture: () => ({
        u: -uCm,
        v: img.imageDistance * 100,
        m: img.magnification,
        hi: img.imageHeight * 100,
        f: 0
      }),
      derive: (row: ObservationRow) => {
        const u = Number(row.u);
        const v = Number(row.v);
        const denom = u + v;
        return { ...row, f: Math.abs(denom) < 1e-9 ? Number.NaN : (u * v) / denom };
      },
      comparison: {
        label: 'focal length',
        unit: 'cm',
        experimental: Math.abs(((-uCm) * img.imageDistance * 100) / (-uCm + img.imageDistance * 100)),
        theoretical: Math.abs(rCm / 2),
        precision: 2
      },
      extraFoot: [
        { label: 'Mean f from the table', value: `compare with R/2 = ${formatFixed(rCm / 2, 2)} cm` }
      ],
      captureHint: 'Change the object distance before each reading.'
    };
  };
};
