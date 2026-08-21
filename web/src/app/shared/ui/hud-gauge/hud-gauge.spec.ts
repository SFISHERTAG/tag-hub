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
    expect(setup(0).drawnLength).toBe(0);
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
    expect(setup(-40).drawnLength).toBe(0);
  });

  it('draws nothing when max is zero rather than dividing by it', () => {
    expect(setup(10, 0).drawnLength).toBe(0);
  });

  it('draws nothing for a non-finite reading', () => {
    expect(setup(Number.NaN).drawnLength).toBe(0);
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
