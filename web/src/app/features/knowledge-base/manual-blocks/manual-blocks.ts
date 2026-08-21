import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  instrumentFields,
  noteSeverity,
  rawJson,
  stringGrid,
  stringList,
  textField,
  type InstrumentField,
  type ManualBlock,
  type NoteSeverity,
} from '../services/manual.model';

/**
 * Renders the manual's block types: paragraph, heading, note, table, procedure,
 * instrument — and anything else as raw JSON.
 *
 * The raw-JSON fallback is the important part. `blocks` is a loose union that
 * gains new shapes per page, and a renderer that skipped what it did not
 * recognise would delete content silently: someone follows a procedure with a
 * step missing and never learns there was one. An ugly JSON dump is visible,
 * reportable, and honest.
 *
 * `instrument` blocks were interactive calculators in the original static
 * manual. That JavaScript is not ported, so they render as a static reference
 * list and say so, rather than as inputs that compute nothing.
 */
@Component({
  selector: 'app-manual-blocks',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './manual-blocks.html',
  styleUrl: './manual-blocks.scss',
})
export class ManualBlocks {
  readonly blocks = input.required<readonly ManualBlock[]>();

  protected text(block: ManualBlock, key: string): string | null {
    return textField(block, key);
  }

  protected steps(block: ManualBlock): readonly string[] {
    return stringList(block, 'steps');
  }

  protected headers(block: ManualBlock): readonly string[] {
    return stringList(block, 'headers');
  }

  protected rows(block: ManualBlock): readonly (readonly string[])[] {
    return stringGrid(block, 'rows');
  }

  protected fields(block: ManualBlock): readonly InstrumentField[] {
    return instrumentFields(block, 'fields');
  }

  protected outputs(block: ManualBlock): readonly string[] {
    return instrumentFields(block, 'outputs').map((output) => output.label);
  }

  protected severity(block: ManualBlock): NoteSeverity {
    return noteSeverity(block);
  }

  protected json(block: ManualBlock): string {
    return rawJson(block);
  }

  /** `§4.2 Title` where the block carries a reference, plain title otherwise. */
  protected procedureTitle(block: ManualBlock): string | null {
    const title = textField(block, 'title');
    if (!title) return null;
    const ref = textField(block, 'ref');
    return ref ? `§${ref} ${title}` : title;
  }
}
