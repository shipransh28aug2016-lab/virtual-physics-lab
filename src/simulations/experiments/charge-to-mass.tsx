import { useEffect, useRef, useState } from 'react';
import type { EducationPack, ExperimentDefinition, ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { PhysicsExperiment } from '@/components/shell/PhysicsExperiment';
import { SvgDefs } from '@/components/shell/Viewport';
import { CONSTANTS } from '@/physics-engine/constants';
import { velocityAfterAcceleration } from '@/physics-engine/electrostatics';
import { gyroradius } from '@/physics-engine/magnetism';
import { formatSI } from '@/utils/format';
import { num, ro, singleSeriesGraph } from './_shared';
import { Knob, type StageApi } from '@/components/controls/StageKit';
import { useRafLoop } from '@/hooks/useAnimation';
import { useLang, type Lang } from '@/i18n';
import { Icons } from '@/components/common/Icons';

import { meta } from './charge-to-mass.meta';

export { meta };

const definition: ExperimentDefinition = {
  id: meta.id, slug: meta.slug, title: meta.title, shortTitle: meta.shortTitle, aim: meta.aim,
  unit: meta.unit, chapter: meta.chapter, kind: meta.kind, difficulty: meta.difficulty,
  thumbLabel: meta.shortTitle, accent: '#ffc65c',
  controls: [
    { kind: 'slider', key: 'vAcc', label: 'Accelerating voltage', symbol: 'V', unit: 'V', min: 100, max: 5000, step: 10, initial: 2000 },
    { kind: 'slider', key: 'eField', label: 'Deflecting field', symbol: 'E', unit: 'kV/m', min: 0, max: 200, step: 1, initial: 60 },
    { kind: 'slider', key: 'bField', label: 'Magnetic field', symbol: 'B', unit: 'mT', min: 0, max: 5, step: 0.01, initial: 1.6, precision: 2, hint: 'At the balance field B = E/\u221a(4V\u00b7(e/m)) \u2248 1.60 mT the beam is undeflected and e/m = E\u00b2/(4VB\u00b2).' },
    { kind: 'slider', key: 'length', label: 'Deflection length', symbol: 'l', unit: 'cm', min: 2, max: 12, step: 0.5, initial: 5, precision: 1 },
    { kind: 'slider', key: 'screen', label: 'Field to screen', symbol: 'L', unit: 'cm', min: 10, max: 40, step: 1, initial: 20 }
  ],
  defaults: { vAcc: 2000, eField: 60, bField: 1.6, length: 5, screen: 20 }
};

const education: EducationPack = {
  theory: [
    'An electron gun accelerates electrons from rest through a potential difference V, so each electron leaves with kinetic energy eV. Its speed is therefore fixed by V and by the unknown ratio e/m.',
    'The beam then passes between charged plates that bend it electrically, and through a magnetic field that bends it the other way. When the two deflections cancel, the beam travels straight and e/m can be found from the balance condition.',
    'The balance condition is eE = evB, which gives v = E/B. Combining this with ½mv² = eV eliminates v and gives e/m = E²/(4VB²).',
    'J. J. Thomson used exactly this method in 1897. The value he obtained was about a thousand times larger than that of the hydrogen ion, which is what suggested that the electron is a universal constituent of matter.'
  ],
  formulas: [
    { tex: '\\frac{1}{2} m v^2 = eV', caption: 'Energy gained in the accelerating field.' },
    { tex: 'eE = evB', caption: 'Balance of electric and magnetic forces.' },
    { tex: '\\frac{e}{m} = \\frac{E^2}{4VB^2}', caption: 'Specific charge from the balance condition, since \u00bdmv\u00b2 = eV.' },
    { tex: 'r = \\frac{mv}{eB}', caption: 'Radius of the circular path when only the magnetic field acts.' }
  ],
  variables: [
    { symbol: 'e', name: 'Elementary charge', unit: 'C', note: '1.602 × 10⁻¹⁹' },
    { symbol: 'm', name: 'Electron mass', unit: 'kg', note: '9.109 × 10⁻³¹' },
    { symbol: 'V', name: 'Accelerating voltage', unit: 'V' },
    { symbol: 'E', name: 'Deflecting electric field', unit: 'V m⁻¹' },
    { symbol: 'B', name: 'Magnetic field', unit: 'T' },
    { symbol: 'v', name: 'Electron speed', unit: 'm s⁻¹' },
    { symbol: 'r', name: 'Path radius', unit: 'm' }
  ],
  procedure: [
    'Set the accelerating voltage, for example 2000 V.',
    'With the magnetic field at zero, raise the electric field until the beam is clearly deflected.',
    'Now raise the magnetic field until the beam returns to the undeflected line — this is the balance point.',
    'Record V, E and B at balance and press Record reading.',
    'Repeat for several accelerating voltages and average the values of e/m obtained.'
  ],
  precautions: [
    'The non-relativistic formula is accurate only while v is well below the speed of light; above about 5 kV a correction is needed.',
    'Stray magnetic fields from the Earth and from nearby equipment must be compensated.',
    'The beam has finite thickness, so the balance point cannot be located more precisely than about a millimetre.'
  ],
  tips: [
    'At balance the readout labelled “net deflection” reads zero — that is the condition to search for.',
    'Compare the value you obtain with the accepted 1.759 × 10¹¹ C/kg.'
  ],
  viva: [
    { q: 'Why is the beam undeflected at balance?', a: 'Because the electric force eE and the magnetic force evB are equal and opposite, so the net transverse force is zero.' },
    { q: 'Derive e/m = E²/(4VB²).', a: 'From eE = evB, v = E/B. Substituting into ½mv² = eV gives v² = 2V(e/m), so E²/B² = 2V(e/m) and e/m = E²/(4VB²).' },
    { q: 'What is the accepted value of e/m for the electron?', a: 'About 1.759 × 10¹¹ C/kg.' },
    { q: 'Why does the method become inaccurate at high accelerating voltage?', a: 'Because the electron speed becomes a significant fraction of c and relativistic mass increase matters.' },
    { q: 'What did Thomson conclude from the large value of e/m?', a: 'That the electron is much lighter than any ion and is a universal constituent of atoms.' }
  ],
  resultTemplate: 'The value of e/m obtained from the balance condition agrees with the accepted value within the experimental uncertainty.'
};

type Localized = { en: string; hi: string };

// On-stage labels, both languages vetted; falls back to English if a key is missing.
const STAGE_TXT: Record<string, Localized> = {
  gun: { en: 'e⁻ gun', hi: 'इलेक्ट्रॉन गन' },
  screen: { en: 'screen', hi: 'पर्दा' },
  outOfScreen: { en: '(out of screen)', hi: '(पर्दे से बाहर)' },
  balanced: { en: 'Balanced — electric and magnetic deflections cancel', hi: 'संतुलित — वैद्युत तथा चुम्बकीय विक्षेप परस्पर निरस्त' },
  deflected: { en: 'Beam deflected — adjust B to restore balance', hi: 'किरण विक्षेपित — संतुलन हेतु B समायोजित करें' },
  magKnob: { en: 'Magnetic field B — turn the magnet supply', hi: 'चुम्बकीय क्षेत्र B — चुम्बक आपूर्ति घुमाएँ' },
  live: { en: 'LIVE', hi: 'लाइव' },
  paused: { en: 'PAUSED', hi: 'रुका हुआ' },
  pause: { en: 'Pause animation', hi: 'चित्रण रोकें' },
  resume: { en: 'Resume animation', hi: 'चित्रण फिर से चलाएँ' },
  speak: { en: 'Speak result', hi: 'परिणाम सुनें' },
  stop: { en: 'Stop speaking', hi: 'बोलना रोकें' }
};
const txt = (key: keyof typeof STAGE_TXT, lang: Lang): string => STAGE_TXT[key]?.[lang] ?? STAGE_TXT[key]?.en ?? String(key);

/** Rounds to a few significant figures and speaks it as "m times ten to the power n", legible to any TTS voice. */
function spokenSci(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  const exp = Math.floor(Math.log10(Math.abs(value)));
  const mantissa = value / 10 ** exp;
  return `${mantissa.toFixed(digits)} × 10^${exp}`;
}

/** Builds the sentence read aloud by the "speak result" control, in the current UI language. */
function buildSpeech(lang: Lang, vAcc: number, v: number, qmMeasured: number, qmTrue: number, balanced: boolean): string {
  if (lang === 'hi') {
    return (
      `थॉमसन विधि। ${vAcc.toFixed(0)} वोल्ट से त्वरित इलेक्ट्रॉन ${spokenSci(v)} मीटर प्रति सेकंड की चाल से गति करते हैं। ` +
      (balanced
        ? `किरण संतुलित है, अतः मापा गया आवेश-द्रव्यमान अनुपात ${spokenSci(qmMeasured)} कूलॉम प्रति किलोग्राम है, जो मानक मान ${spokenSci(qmTrue)} के निकट है।`
        : `किरण अभी विक्षेपित है। संतुलन प्राप्त करने हेतु चुम्बकीय क्षेत्र B को समायोजित करें।`)
    );
  }
  return (
    `Thomson method. Electrons accelerated through ${vAcc.toFixed(0)} volts move at ${spokenSci(v)} metres per second. ` +
    (balanced
      ? `The beam is balanced, so the measured specific charge is ${spokenSci(qmMeasured)} coulombs per kilogram, close to the accepted ${spokenSci(qmTrue)}.`
      : `The beam is currently deflected. Adjust the magnetic field to restore balance.`)
  );
}

function compute(params: ParamValues): ModelOutput {
  const vAcc = num(params, 'vAcc', 2000);
  const eField = num(params, 'eField', 60) * 1000;
  const bField = num(params, 'bField', 1.14) / 1000;
  const length = num(params, 'length', 5) / 100;
  const screen = num(params, 'screen', 20) / 100;

  const qmTrue = CONSTANTS.E_CHARGE / CONSTANTS.M_E;
  const v = velocityAfterAcceleration(CONSTANTS.E_CHARGE, vAcc, CONSTANTS.M_E);
  const qmMeasured = bField === 0 ? Number.POSITIVE_INFINITY : (eField * eField) / (4 * vAcc * bField * bField);
  const fE = CONSTANTS.E_CHARGE * eField;
  const fB = CONSTANTS.E_CHARGE * v * bField;
  const netForce = fE - fB;
  // Transverse displacement on the screen for a beam of the true e/m.
  const accel = netForce / CONSTANTS.M_E;
  const tIn = length / v;
  const yIn = 0.5 * accel * tIn * tIn;
  const slope = accel * tIn / v;
  const yScreen = yIn + slope * (screen - length / 2);
  const radius = gyroradius(CONSTANTS.M_E, v, CONSTANTS.E_CHARGE, bField);

  const points: { x: number; y: number }[] = [];
  for (let b = 0.0001; b <= 0.005; b += 0.00005) {
    const a2 = (CONSTANTS.E_CHARGE * (eField - v * b)) / CONSTANTS.M_E;
    const y2 = 0.5 * a2 * tIn * tIn + (a2 * tIn / v) * (screen - length / 2);
    points.push({ x: b * 1000, y: y2 * 1000 });
  }

  return {
    readouts: [
      ro('v', 'Electron speed', v, 'm/s', 4, { sub: `${((v / CONSTANTS.C_LIGHT) * 100).toFixed(2)}% of c` }),
      ro('qm', 'e/m from balance', qmMeasured, 'C/kg', 4, { tone: Math.abs(qmMeasured - qmTrue) / qmTrue < 0.02 ? 'normal' : 'alert' }),
      ro('qmT', 'Accepted e/m', qmTrue, 'C/kg', 4, { tone: 'dim' }),
      ro('defl', 'Screen deflection', yScreen * 1000, 'mm', 2, { tone: Math.abs(yScreen) < 1e-4 ? 'normal' : 'alert' }),
      ro('r', 'Path radius', radius, 'm', 4)
    ],
    graph: singleSeriesGraph({
      title: 'Screen deflection against magnetic field', xLabel: 'B (mT)', yLabel: 'deflection (mm)',
      seriesLabel: 'deflection', color: '#ffc65c', points,
      live: { x: bField * 1000, y: yScreen * 1000 },
      guides: [{ axis: 'y', value: 0, label: 'balance', color: '#45d68b' }]
    }),
    description: `Electrons accelerated through ${vAcc} volts travel at ${formatSI(v, 3)} metres per second. The electric and magnetic deflections are ${formatSI(fE, 3)} and ${formatSI(fB, 3)} newton, so the beam lands ${formatSI(yScreen * 1000, 3)} millimetre from the undeflected line.`,
    result: Math.abs(yScreen) < 2e-4
      ? `The beam is undeflected, so eE = evB and e/m = E²/(4VB²) = ${formatSI(qmMeasured, 4)} C/kg, within ${(((qmMeasured - qmTrue) / qmTrue) * 100).toFixed(2)}% of the accepted ${formatSI(qmTrue, 4)} C/kg.`
      : `The beam is deflected by ${formatSI(yScreen * 1000, 3)} mm. Adjust the magnetic field until the deflection is zero, then read e/m from the measurement panel.`
  };
}

// Beam geometry shared by the path drawer and the electron-flow animation.
const X0 = 120;
const X_PLATE0 = 300;
const X_PLATE1 = 400;
const X_SCREEN = 700;
const Y_MID = 240;
const SCALE = 1400;

/** A point on the (straight → curved → straight) beam at arc-fraction t ∈ [0, 1]. */
function pointOnBeam(t: number, y1: number, y2: number): { x: number; y: number } {
  const segs = [X_PLATE0 - X0, X_PLATE1 - X_PLATE0, X_SCREEN - X_PLATE1];
  const total = segs[0] + segs[1] + segs[2];
  const d = Math.max(0, Math.min(1, t)) * total;
  if (d <= segs[0]) return { x: X0 + d, y: Y_MID };
  if (d <= segs[0] + segs[1]) {
    const s = (d - segs[0]) / segs[1];
    const mx = (X_PLATE0 + X_PLATE1) / 2;
    const my = (Y_MID + y1) / 2;
    // Point on the quadratic Bézier used for the plate-region curve.
    const x = (1 - s) * (1 - s) * X_PLATE0 + 2 * (1 - s) * s * mx + s * s * X_PLATE1;
    const y = (1 - s) * (1 - s) * Y_MID + 2 * (1 - s) * s * my + s * s * y1;
    return { x, y };
  }
  const s = (d - segs[0] - segs[1]) / segs[2];
  return { x: X_PLATE1 + s * (X_SCREEN - X_PLATE1), y: y1 + s * (y2 - y1) };
}

const ELECTRON_COUNT = 4;

function Stage({ params, set, control, running }: StageApi & { running: boolean }) {
  const { lang } = useLang();
  const vAcc = num(params, 'vAcc', 2000);
  const eField = num(params, 'eField', 60) * 1000;
  const bField = num(params, 'bField', 1.14) / 1000;
  const v = velocityAfterAcceleration(CONSTANTS.E_CHARGE, vAcc, CONSTANTS.M_E);
  const netForce = CONSTANTS.E_CHARGE * (eField - v * bField);
  const length = num(params, 'length', 5) / 100;
  const screen = num(params, 'screen', 20) / 100;
  const accel = netForce / CONSTANTS.M_E;
  const tIn = length / v;
  const yIn = 0.5 * accel * tIn * tIn;
  const slope = (accel * tIn) / v;
  const yScreen = yIn + slope * (screen - length / 2);
  const balanced = Math.abs(yScreen) < 2e-4;

  const y1 = Y_MID - yIn * SCALE;
  const y2Clamped = Math.max(30, Math.min(450, Y_MID - yScreen * SCALE));

  const beamRef = useRef<SVGPathElement>(null);
  useEffect(() => {
    if (!beamRef.current) return;
    beamRef.current.setAttribute(
      'd',
      `M${X0} ${Y_MID} L${X_PLATE0} ${Y_MID} Q${(X_PLATE0 + X_PLATE1) / 2} ${(Y_MID + y1) / 2} ${X_PLATE1} ${y1} L${X_SCREEN} ${y2Clamped}`
    );
  }, [y1, y2Clamped]);

  // Real electron transit times are nanoseconds; the loop period is scaled from
  // the live speed against a reference so a faster beam visibly streams faster,
  // while staying inside a comfortable, watchable range on screen.
  const REF_V = 4.5e7;
  const dotRefs = useRef<(SVGCircleElement | null)[]>([]);
  useRafLoop((elapsed) => {
    const period = Math.max(0.5, Math.min(2.6, 1.1 * (REF_V / Math.max(v, 1e5))));
    for (let i = 0; i < ELECTRON_COUNT; i++) {
      const phase = i / ELECTRON_COUNT;
      const frac = ((elapsed / period + phase) % 1 + 1) % 1;
      const p = pointOnBeam(frac, y1, y2Clamped);
      const dot = dotRefs.current[i];
      if (dot) {
        dot.setAttribute('cx', p.x.toFixed(1));
        dot.setAttribute('cy', p.y.toFixed(1));
      }
    }
  }, running);

  return (
    <svg viewBox="0 0 800 480" className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />
      <rect x={70} y={205} width={70} height={70} rx={8} fill="url(#lab-case)" stroke="#3a4c60" />
      <text x={105} y={244} textAnchor="middle" fontSize={10} fill="#8497ad">{txt('gun', lang)}</text>
      <text x={105} y={292} textAnchor="middle" fontSize={10} className="label-mono">{vAcc.toFixed(0)} V</text>
      <rect x={290} y={170} width={120} height={14} rx={3} fill="url(#lab-plate)" stroke="#5c7085" />
      <rect x={290} y={296} width={120} height={14} rx={3} fill="url(#lab-plate)" stroke="#5c7085" />
      {Array.from({ length: 6 }, (_, i) => (
        <text key={i} x={305 + i * 20} y={190} fontSize={11} fill="#ff6b7d" fontWeight={700}>+</text>
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <text key={`n${i}`} x={305 + i * 20} y={308} fontSize={12} fill="#5aa9ff" fontWeight={700}>−</text>
      ))}
      <text x={350} y={160} textAnchor="middle" fontSize={10} fill="#8497ad">E = {(eField / 1000).toFixed(0)} kV/m</text>
      <g opacity={0.85}>
        {Array.from({ length: 6 }, (_, i) =>
          Array.from({ length: 3 }, (_, j) => (
            <circle key={`${i}-${j}`} cx={470 + i * 34} cy={200 + j * 40} r={7} fill="none" stroke="#9d8cff" strokeWidth={1.2} />
          ))
        )}
        {Array.from({ length: 6 }, (_, i) =>
          Array.from({ length: 3 }, (_, j) => (
            <circle key={`d${i}-${j}`} cx={470 + i * 34} cy={200 + j * 40} r={1.8} fill="#9d8cff" />
          ))
        )}
      </g>
      <text x={555} y={176} textAnchor="middle" fontSize={10} fill="#9d8cff">B = {(bField * 1000).toFixed(2)} mT {txt('outOfScreen', lang)}</text>
      <rect x={696} y={40} width={14} height={400} rx={3} fill="url(#lab-metal)" stroke="#5c7085" />
      <text x={703} y={32} textAnchor="middle" fontSize={10} fill="#8497ad">{txt('screen', lang)}</text>
      <line x1={120} y1={240} x2={700} y2={240} className="dim-line" />
      <path ref={beamRef} d="M120 240 L700 240" fill="none" stroke="#ffd257" strokeWidth={2.6} strokeLinecap="round" opacity={0.55} style={{ filter: 'drop-shadow(0 0 6px #ffd25788)' }} />
      {/* A stream of electrons, spaced along the live beam path and re-timed every frame from the true speed v. */}
      {Array.from({ length: ELECTRON_COUNT }, (_, i) => (
        <circle
          key={i}
          ref={(el) => { dotRefs.current[i] = el; }}
          cx={X0 + i * ((X_SCREEN - X0) / ELECTRON_COUNT)}
          cy={Y_MID}
          r={4.2}
          fill="#6ee7ff"
          style={{ filter: 'drop-shadow(0 0 5px #6ee7ffaa)' }}
        />
      ))}
      <text x={400} y={56} textAnchor="middle" fontSize={12.5} fill="#eaf1f8" fontWeight={600}>
        {balanced ? txt('balanced', lang) : txt('deflected', lang)}
      </text>
      {/* The magnet's field is set on the apparatus, beside the deflection region. */}
      <Knob
        spec={control('bField', 'slider')}
        params={params}
        onChange={(key, value) => set(key, value)}
        x={400}
        y={432}
        radius={19}
        label={txt('magKnob', lang)}
      />
        </svg>
  );
}

interface StageOverlayProps {
  vAcc: number;
  v: number;
  qmMeasured: number;
  qmTrue: number;
  balanced: boolean;
  running: boolean;
  onToggleRunning: () => void;
}

/** Play/pause + bilingual "speak the result" controls shown in the viewport's top-right corner. */
function StageOverlay({ vAcc, v, qmMeasured, qmTrue, balanced, running, onToggleRunning }: StageOverlayProps) {
  const { lang } = useLang();
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => () => {
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  const toggleSpeech = () => {
    if (!supported) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utter = new SpeechSynthesisUtterance(buildSpeech(lang, vAcc, v, qmMeasured, qmTrue, balanced));
    utter.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    utter.rate = 0.95;
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
    setSpeaking(true);
  };

  return (
    <>
      <button
        type="button"
        className={`view-pill view-pill-live${running ? '' : ' is-paused'}`}
        onClick={onToggleRunning}
        aria-pressed={running}
        aria-label={running ? txt('pause', lang) : txt('resume', lang)}
        title={running ? txt('pause', lang) : txt('resume', lang)}
      >
        {running ? <Icons.PauseCircle width={13} height={13} /> : <Icons.PlayCircle width={13} height={13} />}
        {running ? <span className="pulse-dot" /> : null}
        <b>{running ? txt('live', lang) : txt('paused', lang)}</b>
      </button>
      {supported ? (
        <button
          type="button"
          className={`btn btn-sm btn-icon${speaking ? ' is-speaking' : ''}`}
          onClick={toggleSpeech}
          aria-pressed={speaking}
          aria-label={speaking ? txt('stop', lang) : txt('speak', lang)}
          title={speaking ? txt('stop', lang) : txt('speak', lang)}
        >
          {speaking ? <Icons.SpeakerMute width={15} height={15} /> : <Icons.Speaker width={15} height={15} />}
        </button>
      ) : null}
    </>
  );
}

export default function ChargeToMassExperiment() {
  // Shared by the stage (drives the raf loop) and the overlay (draws the toggle);
  // both are rendered from here, so a plain state value is enough to link them.
  const [running, setRunning] = useState(true);
  return (
    <PhysicsExperiment
      definition={definition} education={education} compute={compute}
      renderStage={(api) => <Stage {...api} running={running} />}
      viewportOverlay={(params) => {
        const vAcc = num(params, 'vAcc', 2000);
        const eField = num(params, 'eField', 60) * 1000;
        const bField = num(params, 'bField', 1.6) / 1000;
        const v = velocityAfterAcceleration(CONSTANTS.E_CHARGE, vAcc, CONSTANTS.M_E);
        const qmTrue = CONSTANTS.E_CHARGE / CONSTANTS.M_E;
        const qmMeasured = bField === 0 ? Number.POSITIVE_INFINITY : (eField * eField) / (4 * vAcc * bField * bField);
        const balanced = Math.abs(qmMeasured - qmTrue) / qmTrue < 0.02;
        return (
          <StageOverlay
            vAcc={vAcc} v={v} qmMeasured={qmMeasured} qmTrue={qmTrue} balanced={balanced}
            running={running} onToggleRunning={() => setRunning((r) => !r)}
          />
        );
      }}
      notebook={({ params: p }) => {
        const vAcc = num(p, 'vAcc', 2000);
        const eField = num(p, 'eField', 60) * 1000;
        const bField = num(p, 'bField', 1.14) / 1000;
        const qm = (eField * eField) / (4 * vAcc * bField * bField);
        return {
          title: 'Observation table — determination of e/m',
          columns: [
            { key: 'v', label: 'V', unit: 'V', precision: 0 },
            { key: 'e', label: 'E', unit: 'kV/m', precision: 1 },
            { key: 'b', label: 'B', unit: 'mT', precision: 2 },
            { key: 'qm', label: 'e/m', unit: '×10¹¹ C/kg', precision: 3, derived: true }
          ],
          capture: () => ({ v: vAcc, e: eField / 1000, b: bField * 1000, qm: 0 }),
          derive: (row) => {
            const V = Number(row.v);
            const E = Number(row.e) * 1000;
            const B = Number(row.b) / 1000;
            return { ...row, qm: B === 0 ? Number.NaN : (E * E) / (2 * V * B * B) / 1e11 };
          },
          comparison: { label: 'specific charge', unit: '×10¹¹ C/kg', experimental: qm / 1e11, theoretical: CONSTANTS.E_CHARGE / CONSTANTS.M_E / 1e11, precision: 3 },
          captureHint: 'Adjust B until the beam is undeflected, then record.'
        };
      }}
    />
  );
}

/**
 * Exported for the NCERT alignment audit, which reads the write-up and the
 * control list without mounting the apparatus.
 */
export { definition, education };
