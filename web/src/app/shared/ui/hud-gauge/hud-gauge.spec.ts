import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HudGauge } from './hud-gauge';

/**
 * The dial is geometry over untrusted numbers, so the tests are about what it
 * refuses to draw. A reading past full scale, a negative one, or a max of zero
 * are all data problems; each one has a way of turning into a dial that laps
 * itself, draws backwards, or divides by zero, and any of those reads as a
 * confident instrument rather than as bad input.
 *
 * The accessible name is asserted separately because the SVG is aria-hidden:
 * if the label stops being built, the dial goes silent to a screen reader
 * while still looking correct.
 */

const CIRCUMFERENCE = 2 * Math.PI * 42;
const SWEEP = 0.75;

function mount(inputs: {
  value: number;
  label: string;
  unit?: string;
  max?: number;
  tone?: 'positive' | 'caution' | 'negative' | null;
}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [HudGauge],
    providers: [provideZonelessChangeDetection()],
  });
  const fixture = TestBed.createComponent(HudGauge);
  fixture.componentRef.setInput('value', inputs.value);
  fixture.componentRef.setInput('label', inputs.label);
  fixture.componentRef.setInput('unit', inputs.unit ?? '');
  if (inputs.max !== undefined) fixture.componentRef.setInput('max', inputs.max);
  if (inputs.tone !== undefined) fixture.componentRef.setInput('tone', inputs.tone);
  fixture.detectChanges();
  return { fixture, host: fixture.nativeElement as HTMLElement };
}

function setup(value: number, max?: number, label = 'Health', unit = '%') {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [HudGauge],
    providers: [provideZonelessChangeDetection()],
  });

  const fixture = TestBed.createComponent(HudGauge);
  fixture.componentRef.setInput('value', value);
  fixture.componentRef.setInput('label', label);
  fixture.componentRef.setInput('unit', unit);
  if (max !== undefined) fixture.componentRef.setInput('max', max);
  fixture.detectChanges();

  const host = fixture.nativeElement as HTMLElement;
  const arc = host.querySelector('.hud-gauge__value');
  return {
    fixture,
    host,
    drawnLength: Number(arc?.getAttribute('stroke-dasharray')?.split(' ')[0] ?? NaN),
  };
}

describe('HudGauge', () => {
  it('draws nothing at zero', () => {
    // Absent, not zero-length: a zero-length dash with round linecaps renders
    // as a dot, so the honest empty dial removes the arc element entirely.
    expect(setup(0).host.querySelector('.hud-gauge__value')).toBeNull();
  });

  it('draws the full sweep at full scale', () => {
    expect(setup(100).drawnLength).toBeCloseTo(SWEEP * CIRCUMFERENCE, 5);
  });

  it('draws half the sweep at half scale', () => {
    expect(setup(50).drawnLength).toBeCloseTo(SWEEP * CIRCUMFERENCE * 0.5, 5);
  });

  it('clamps a reading past full scale instead of lapping the dial', () => {
    expect(setup(250).drawnLength).toBeCloseTo(SWEEP * CIRCUMFERENCE, 5);
  });

  it('clamps a negative reading instead of drawing backwards', () => {
    expect(setup(-40).host.querySelector('.hud-gauge__value')).toBeNull();
  });

  it('draws nothing when max is zero rather than dividing by it', () => {
    expect(setup(10, 0).host.querySelector('.hud-gauge__value')).toBeNull();
  });

  it('draws nothing for a non-finite reading', () => {
    expect(setup(Number.NaN).host.querySelector('.hud-gauge__value')).toBeNull();
  });

  it('scales against a custom max', () => {
    expect(setup(25, 50).drawnLength).toBeCloseTo(SWEEP * CIRCUMFERENCE * 0.5, 5);
  });

  it('names itself for a screen reader, since the svg is hidden', () => {
    const { host } = setup(72, 100, 'Client health', '%');
    expect(host.querySelector('.hud-gauge')?.getAttribute('aria-label')).toBe('Client health: 72%');
    expect(host.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('declares no colour of its own, so the theme owns it', () => {
    const { host } = setup(50);
    for (const arc of Array.from(host.querySelectorAll('circle'))) {
      expect(arc.getAttribute('stroke')).toBeNull();
    }
  });
});

describe('HudGauge at the edges of its input (review Stream 4)', () => {
  it('draws no value arc at zero, not a dot', () => {
    // stroke-linecap: round renders a zero-length dash as a visible dot at
    // the start angle, so "0" showed a phantom reading. The arc element must
    // be absent, not merely zero-length.
    const { host } = mount({ value: 0, label: 'Health' });
    expect(host.querySelector('.hud-gauge__value')).toBeNull();
  });

  it('draws no value arc for NaN either', () => {
    const { host } = mount({ value: Number.NaN, label: 'Health' });
    expect(host.querySelector('.hud-gauge__value')).toBeNull();
  });

  it('never prints NaN in the readout', () => {
    const { host } = mount({ value: Number.NaN, label: 'Health', unit: '%' });
    expect(host.textContent).not.toContain('NaN');
    expect(host.querySelector('.hud-gauge__number')?.textContent?.trim()).toBe('no data');
  });

  it('announces "no reading" rather than a number that does not exist', () => {
    const { host } = mount({ value: Number.NaN, label: 'Health', unit: '%' });
    expect(host.querySelector('.hud-gauge')?.getAttribute('aria-label')).toBe(
      'Health: no reading',
    );
  });

  it('still renders a real zero as the number 0', () => {
    const { host } = mount({ value: 0, label: 'Health', unit: '%' });
    expect(host.querySelector('.hud-gauge__number')?.textContent).toContain('0');
    expect(host.querySelector('.hud-gauge')?.getAttribute('aria-label')).toBe('Health: 0%');
  });
});

describe('HudGauge tone (review Stream 4)', () => {
  it('defaults to the untoned arc', () => {
    const { host } = mount({ value: 50, label: 'Health' });
    const arc = host.querySelector('.hud-gauge__value');
    expect(arc?.classList.contains('hud-gauge__value--negative')).toBe(false);
    expect(arc?.classList.contains('hud-gauge__value--caution')).toBe(false);
  });

  it('carries a qualitative tone onto the arc', () => {
    // The department dial replaced a tile whose tone said good/warn/bad at a
    // glance; a dial that renders 23 and 95 in the same colour dropped that
    // signal. The tone input is how the caller restores it.
    const { host } = mount({ value: 23, label: 'Health', tone: 'negative' });
    expect(
      host.querySelector('.hud-gauge__value')?.classList.contains('hud-gauge__value--negative'),
    ).toBe(true);
  });
});
