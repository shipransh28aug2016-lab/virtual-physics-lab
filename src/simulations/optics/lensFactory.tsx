import type { EducationPack, ExperimentDefinition, ObservationRow, ParamValues } from '@/types/lab';
import type { ExperimentMeta } from '@/experiments/registry';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { lensImage, lensPower } from '@/physics-engine/optics';
import { OpticsBench, benchGeometry, xOf, yOf, FocalMarks, type BenchRay } from '@/components/instruments/OpticsBench';
import { LensSvg } from '@/components/instruments/Instruments';
import { col, num, ro } from '../experiments/_shared';
import { DragX, DragY, type StageApi } from '@/components/controls/StageKit';
import { formatFixed } from '@/utils/format';

export interface LensConfig {
  convex: boolean;
  /** The catalogue entry this simulator is built from. */
  meta: ExperimentMeta;
}

export function makeLensDefinition(c: LensConfig): ExperimentDefinition {
  return {
    id: c.meta.id, slug: c.meta.slug, title: c.meta.title, shortTitle: c.meta.shortTitle,
    aim: c.meta.aim, unit: c.meta.unit, chapter: c.meta.chapter, kind: c.meta.kind,
    difficulty: c.meta.difficulty, practicalNo: c.meta.practicalNo,
    thumbLabel: c.meta.shortTitle, accent: '#6ee7ff',
    controls: [
      { kind: 'slider', key: 'u', label: 'Object distance', symbol: 'u', unit: 'cm', min: 3, max: 60, step: 0.5, initial: 30, precision: 1 },
      { kind: 'slider', key: 'f', label: 'Focal length', symbol: 'f', unit: 'cm', min: c.convex ? 4 : -30, max: c.convex ? 30 : -4, step: 0.5, initial: c.convex ? 15 : -15, precision: 1, hint: c.convex ? 'Positive for a converging lens' : 'Negative for a diverging lens' },
      { kind: 'slider', key: 'height', label: 'Object height', symbol: 'h', unit: 'cm', min: 0.5, max: 4, step: 0.1, initial: 1.5, precision: 1 },
      { kind: 'toggle', key: 'showRays', label: 'Show construction rays', initial: true }
    ],
    defaults: { u: 30, f: c.convex ? 15 : -15, height: 1.5, showRays: true }
  };
}

export function makeLensCompute(c: LensConfig) {
  return function compute(params: ParamValues): ModelOutput {
    const uCm = num(params, 'u', 30);
    const fCm = num(params, 'f', c.convex ? 15 : -15);
    const hCm = num(params, 'height', 1.5);
    const img = lensImage(uCm / 100, fCm / 100, hCm / 100);
    const vCm = Number.isFinite(img.imageDistance) ? img.imageDistance * 100 : Number.POSITIVE_INFINITY;
    const power = lensPower(fCm / 100);

    const points: { x: number; y: number }[] = [];
    for (let u = 3; u <= 60; u += 0.5) {
      const r = lensImage(u / 100, fCm / 100, hCm / 100);
      if (Number.isFinite(r.imageDistance) && Math.abs(r.imageDistance) < 5) points.push({ x: u, y: r.imageDistance * 100 });
    }
    const invPoints = points.map((p) => ({ x: -100 / p.x, y: 100 / p.y }));

    const nature = img.isReal ? (img.isErect ? 'real and erect' : 'real and inverted') : img.isErect ? 'virtual and erect' : 'virtual and inverted';

    return {
      readouts: [
        ro('v', 'Image distance v', vCm, 'cm', 2, { tone: Number.isFinite(vCm) ? 'normal' : 'alert' }),
        ro('m', 'Magnification m', img.magnification, '×', 3, { tone: img.magnification < 0 ? 'neg' : 'normal' }),
        ro('h', 'Image height', img.imageHeight * 100, 'cm', 2),
        ro('p', 'Lens power', power, 'D', 2),
        ro('nature', 'Image type', img.isReal ? 1 : 0, '', 0, { sub: nature, text: img.isReal ? 'REAL' : 'VIRTUAL' })
      ],
      graph: {
        title: '1/v against 1/u — the intercepts give 1/f',
        xLabel: '1/u (cm⁻¹)',
        yLabel: '1/v (cm⁻¹)',
        series: [{ key: 'inv', label: '1/v', color: '#6ee7ff', points: invPoints }],
        guides: [{ axis: 'y', value: 100 / fCm, label: '1/f', color: '#ffc65c' }]
      },
      live: Number.isFinite(vCm) && vCm !== 0 ? { x: -100 / uCm, y: 100 / vCm } : null,
      description: `A ${c.convex ? 'convex' : 'concave'} lens of focal length ${fCm.toFixed(1)} centimetre with an object ${uCm.toFixed(1)} centimetre from the optical centre. The image forms at ${vCm.toFixed(1)} centimetre and is ${nature} with magnification ${img.magnification.toFixed(2)}.`,
      result: `For u = ${uCm.toFixed(1)} cm and f = ${fCm.toFixed(1)} cm the image forms at v = ${vCm.toFixed(2)} cm. It is ${nature}, m = ${img.magnification.toFixed(3)}, and the lens power is ${power.toFixed(2)} D.`
    };
  };
}

export function makeLensStage(c: LensConfig) {
  return function Stage({ params, set, control }: StageApi) {
    const uCm = num(params, 'u', 30);
    const fCm = num(params, 'f', c.convex ? 15 : -15);
    const hCm = num(params, 'height', 1.5);
    const showRays = Boolean(params.showRays ?? true);
    const g = benchGeometry(9);
    const img = lensImage(uCm / 100, fCm / 100, hCm / 100);
    const u = -uCm;
    const oX = xOf(g, u);
    const oY = yOf(g, hCm);
    const iX = Number.isFinite(img.imageDistance) ? xOf(g, img.imageDistance * 100) : null;
    const iY = Number.isFinite(img.imageHeight) ? yOf(g, img.imageHeight * 100) : null;
    const fX = xOf(g, fCm);
    const f2X = xOf(g, -fCm);

    const rays: BenchRay[] = [];
    if (showRays) {
      rays.push({ from: { x: oX, y: oY }, to: { x: g.originX, y: oY } });
      const slopePar = (g.axisY - oY) / (fX - g.originX);
      if (iX !== null && iY !== null) {
        rays.push({ from: { x: g.originX, y: oY }, to: { x: iX, y: iY } });
        if (!img.isReal) rays.push({ from: { x: g.originX, y: oY }, to: { x: iX, y: iY }, kind: 'virtual' });
      } else {
        rays.push({ from: { x: g.originX, y: oY }, to: { x: g.originX + 320, y: oY + slopePar * 320 } });
        rays.push({ from: { x: g.originX, y: oY }, to: { x: f2X, y: g.axisY }, kind: 'virtual' });
      }
      rays.push({ from: { x: oX, y: oY }, to: { x: g.originX, y: g.axisY } });
      const slopeC = (g.axisY - oY) / (g.originX - oX);
      rays.push({ from: { x: g.originX, y: g.axisY }, to: { x: g.originX + 320, y: g.axisY + slopeC * 320 } });
      if (!img.isReal && iX !== null && iY !== null) {
        rays.push({ from: { x: g.originX, y: g.axisY }, to: { x: iX, y: iY }, kind: 'virtual' });
      }
      if (c.convex) {
        rays.push({ from: { x: oX, y: oY }, to: { x: f2X, y: oY + slopeC * (f2X - oX) } });
        rays.push({ from: { x: f2X, y: oY + slopeC * (f2X - oX) }, to: { x: g.originX, y: g.axisY } });
      }
    }

    return (
      <OpticsBench
        geometry={g}
        rays={rays}
        objectX={oX}
        objectHeight={hCm}
        image={img}
        title={`${c.convex ? 'Convex' : 'Concave'} lens · f = ${fCm.toFixed(1)} cm · P = ${(100 / fCm).toFixed(2)} D`}
        subtitle={`u = ${uCm.toFixed(1)} cm → v = ${(img.imageDistance * 100).toFixed(2)} cm · m = ${img.magnification.toFixed(3)}`}
        optic={
          <>
            <LensSvg x={g.originX} y={g.axisY} convex={c.convex} height={210} thickness={26} label="O" />
            <FocalMarks g={g} values={[{ x: fX, label: c.convex ? "F'" : 'F' }, { x: f2X, label: 'F' }, { x: xOf(g, 2 * fCm), label: "2F'" }, { x: xOf(g, -2 * fCm), label: '2F' }]} />
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

export function makeLensEducation(c: LensConfig): EducationPack {
  return {
    theory: [
      c.convex
        ? 'A convex lens is thicker at the centre and converges parallel rays to a real focus on the other side. Its image changes character with the object position: beyond 2F the image is real, inverted and diminished; at 2F it is the same size; between F and 2F it is magnified; and inside F the lens acts as a simple microscope, giving a virtual, erect, magnified image.'
        : 'A concave lens is thinner at the centre and diverges parallel rays so that they appear to come from a virtual focus on the object side. For every real object position the image is virtual, erect and diminished, and it lies between the optical centre and the focus.',
      'Both are described by the thin lens equation 1/v − 1/u = 1/f with the Cartesian sign convention: light travels left to right, distances measured against it are negative, and the focal length of a diverging lens is negative.',
      'The power of a lens is the reciprocal of its focal length in metres and is measured in dioptres. A convex lens has positive power; a concave lens has negative power.'
    ],
    formulas: [
      { tex: '\\frac{1}{v} - \\frac{1}{u} = \\frac{1}{f}', caption: 'Thin lens equation.' },
      { tex: 'm = \\frac{v}{u} = \\frac{h_i}{h_o}', caption: 'Linear magnification.' },
      { tex: 'P = \\frac{1}{f}', caption: 'Power in dioptres with f in metres.' },
      { tex: '\\frac{1}{f} = (n-1)\\left(\\frac{1}{R_1} - \\frac{1}{R_2}\\right)', caption: 'Lens maker’s formula.' }
    ],
    variables: [
      { symbol: 'u', name: 'Object distance', unit: 'm', note: 'Negative in the Cartesian convention' },
      { symbol: 'v', name: 'Image distance', unit: 'm', note: 'Positive means a real image on the far side' },
      { symbol: 'f', name: 'Focal length', unit: 'm', note: c.convex ? 'Positive' : 'Negative' },
      { symbol: 'm', name: 'Magnification', unit: '—' },
      { symbol: 'P', name: 'Power', unit: 'D' }
    ],
    procedure: [
      'Mount the lens vertically on the bench with its optical centre on the scale.',
      'Place the object at a known distance u and obtain a sharp image on the screen.',
      'Record u and v, then repeat for at least six object distances spanning both sides of 2F.',
      'Plot u against v and also 1/u against 1/v; the latter should be a straight line with intercepts 1/f.',
      'Compute f from each pair of readings and take the mean.'
    ],
    precautions: [
      'The lens must be vertical and its optical centre must be at the height of the object tip.',
      'Remove parallax before reading the image position.',
      'Keep the object small so that only paraxial rays are used.',
      'Do not touch the polished surfaces of the lens.'
    ],
    sourcesOfError: [
      'Spherical and chromatic aberration of a single lens.',
      'Uncertainty in the position of the optical centre.',
      'Judging the sharpest image by eye, which is uncertain to a millimetre or more.'
    ],
    tips: c.convex
      ? ['Move the object through F and watch the image jump from real and inverted to virtual and erect.']
      : ['No object position gives a real image — that is why a concave lens focal length needs an auxiliary convex lens.'],
    viva: [
      { q: 'State the thin lens formula.', a: '1/v − 1/u = 1/f with the Cartesian sign convention.' },
      { q: 'What is the power of a lens of focal length 20 cm?', a: 'P = 1/0.20 = +5 D for a convex lens, −5 D for a concave lens.' },
      { q: c.convex ? 'Where must the object be for a virtual image from a convex lens?' : 'What is always true of the image formed by a concave lens?', a: c.convex ? 'Between the optical centre and the focus, that is u < f.' : 'It is always virtual, erect and diminished.' },
      { q: 'Define one dioptre.', a: 'The power of a lens whose focal length is one metre.' },
      { q: 'Why does a lens suffer from chromatic aberration?', a: 'Because the refractive index depends on wavelength, so different colours focus at different distances.' }
    ],
    resultTemplate: 'The mean focal length from the u–v readings agrees with the value obtained from the 1/u–1/v graph.'
  };
}

export const lensNotebook = (c: LensConfig) => {
  return ({ params: p }: { params: ParamValues; rows: Record<string, number | string>[] }) => {
    const uCm = num(p, 'u', 30);
    const fCm = num(p, 'f', c.convex ? 15 : -15);
    const hCm = num(p, 'height', 1.5);
    const img = lensImage(uCm / 100, fCm / 100, hCm / 100);
    return {
      title: `Observation table — ${c.meta.shortTitle}`,
      columns: [
        col('u', 'u', 'cm', 1),
        col('v', 'v', 'cm', 2),
        col('m', 'm', '×', 3),
        col('hi', 'h′', 'cm', 2),
        col('f', 'f = uv/(u+v)', 'cm', 2, true)
      ],
      capture: () => ({ u: uCm, v: img.imageDistance * 100, m: img.magnification, hi: img.imageHeight * 100, f: 0 }),
      derive: (row: ObservationRow) => {
        const u = -Math.abs(Number(row.u));
        const v = Number(row.v);
        const denom = u + v;
        return { ...row, f: Math.abs(denom) < 1e-9 ? Number.NaN : (u * v) / denom };
      },
      comparison: { label: 'focal length', unit: 'cm', experimental: Math.abs(fCm), theoretical: Math.abs(fCm), precision: 2 },
      extraFoot: [{ label: 'Expected f', value: `${formatFixed(fCm, 2)} cm from the lens setting` }],
      captureHint: 'Change the object distance before each reading.'
    };
  };
};
