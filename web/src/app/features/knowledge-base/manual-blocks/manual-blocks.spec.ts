import { ChangeDetectionStrategy, Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ManualBlocks } from './manual-blocks';
import type { ManualBlock } from '../services/manual.model';

/**
 * Story: nothing in the manual is allowed to disappear.
 *
 * The block union is open — new shapes appear per page in the source. A
 * renderer that skipped what it did not recognise would delete content
 * silently, and the failure mode is a procedure that reads complete while
 * missing a step. Somebody follows it and never learns there was one.
 *
 * So an unknown block renders as raw JSON: ugly, visible, and reportable.
 */

@Component({
  selector: 'app-manual-blocks-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ManualBlocks],
  template: `<app-manual-blocks [blocks]="blocks()" />`,
})
class Host {
  readonly blocks = signal<readonly ManualBlock[]>([]);
}

function setup(blocks: readonly ManualBlock[]) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [Host],
    providers: [provideZonelessChangeDetection()],
  });

  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.blocks.set(blocks);
  fixture.detectChanges();

  return { fixture, text: () => fixture.nativeElement.textContent ?? '' };
}

describe('ManualBlocks', () => {
  it('renders an unknown block type as raw JSON rather than dropping it', () => {
    const { text, fixture } = setup([
      { type: 'flowchart', nodes: ['start', 'end'] } as ManualBlock,
    ]);

    expect(fixture.nativeElement.querySelector('pre')).not.toBeNull();
    expect(text()).toContain('flowchart');
    expect(text()).toContain('start');
  });

  it('renders a paragraph with its caveat', () => {
    const { text } = setup([
      {
        type: 'paragraph',
        title: 'Escalation',
        content: 'Escalate within one business day.',
        caveatLabel: 'Exception',
        caveat: 'Not for billing disputes.',
      } as ManualBlock,
    ]);

    expect(text()).toContain('Escalation');
    expect(text()).toContain('Escalate within one business day.');
    expect(text()).toContain('Exception');
    expect(text()).toContain('Not for billing disputes.');
  });

  it('numbers procedure steps and prefixes the reference when there is one', () => {
    const { fixture, text } = setup([
      {
        type: 'procedure',
        ref: '4.2',
        title: 'Handoff',
        steps: ['Confirm the scope', 'Book the call'],
        warning: 'Do not skip the scope check.',
      } as ManualBlock,
    ]);

    expect(text()).toContain('§4.2 Handoff');
    expect(fixture.nativeElement.querySelectorAll('ol li')).toHaveLength(2);
    expect(text()).toContain('Do not skip the scope check.');
  });

  it('renders a table with its headers and rows', () => {
    const { fixture } = setup([
      {
        type: 'table',
        title: 'Tiers',
        headers: ['Tier', 'Response'],
        rows: [
          ['P1', '1 hour'],
          ['P2', '1 day'],
        ],
      } as ManualBlock,
    ]);

    expect(fixture.nativeElement.querySelectorAll('th')).toHaveLength(2);
    expect(fixture.nativeElement.querySelectorAll('tbody tr')).toHaveLength(2);
  });

  it('says plainly that an instrument’s calculator is not ported', () => {
    const { text } = setup([
      {
        type: 'instrument',
        title: 'Unit economics',
        fields: [{ label: 'Close rate', default: '20%' }],
        outputs: [{ label: 'Cost per call' }],
      } as ManualBlock,
    ]);

    expect(text()).toContain('Unit economics');
    expect(text()).toContain('Close rate — 20%');
    expect(text()).toContain('Outputs: Cost per call');
    expect(text()).toContain('not ported');
  });

  it('renders a malformed block of a known type without throwing', () => {
    // A table whose rows are the wrong shape still renders its title, rather
    // than taking the whole page down on a bad edit.
    const { text } = setup([
      { type: 'table', title: 'Broken', headers: 'nope', rows: 'nope' } as ManualBlock,
    ]);

    expect(text()).toContain('Broken');
  });
});
