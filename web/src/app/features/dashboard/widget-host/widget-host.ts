import { NgComponentOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  type Type,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { PermissionService } from '../../../core/services/permission.service';
import { WidgetRegistryService } from '../../../shared/widgets/widget-registry.service';

type HostState = 'loading' | 'ready' | 'unknown' | 'forbidden' | 'unbuilt';

/**
 * One cell of the dashboard: resolve a widget by id, render it, or say plainly
 * why it is not there.
 *
 * The shell hands this a string and nothing else. That is the whole point of
 * the registry — the dashboard never imports a widget, never knows a client
 * from a campaign, and a new integration adds a `registerLoader` call rather
 * than a branch in a grid component. The reference implementation's
 * `widget-grid.tsx` was a fifteen-arm if/else importing every widget in the
 * app, so adding one meant editing the shell, and the shell's props grew a
 * field per widget.
 *
 * Four not-rendered states, kept distinct because they have different fixes:
 *
 * - `unknown`   — the id is not in the registry at all. A layout row naming a
 *                 widget that no longer exists.
 * - `forbidden` — the widget exists but this hat may not use it. Cosmetic only:
 *                 the server strips these from the layout on read and each
 *                 widget's data endpoint returns 403 anyway. This branch is the
 *                 belt to the server's braces, not the control.
 * - `unbuilt`   — registered as a definition, no component registered yet.
 *                 The honest state for a widget whose screen has not landed.
 * - `loading`   — the chunk is in flight.
 *
 * A failed dynamic import lands on `unbuilt` rather than throwing, so one
 * missing chunk cannot take down every other tile on the page.
 */
@Component({
  selector: 'app-widget-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgComponentOutlet, MatCardModule],
  templateUrl: './widget-host.html',
  styleUrl: './widget-host.scss',
})
export class WidgetHost {
  private readonly registry = inject(WidgetRegistryService);
  private readonly permission = inject(PermissionService);

  readonly widgetId = input.required<string>();

  protected readonly state = signal<HostState>('loading');
  protected readonly component = signal<Type<unknown> | null>(null);

  protected readonly definition = computed(() => this.registry.getDefinition(this.widgetId()));

  protected readonly title = computed(() => this.definition()?.title ?? this.widgetId());

  protected readonly description = computed(() => this.definition()?.description ?? null);

  /**
   * Guards against a slow chunk for a previous id resolving after the input has
   * already moved on. Placements are keyed by id in the grid so this is rare,
   * but "rare" and "cannot happen" are different, and the symptom would be one
   * tile rendering another tile's widget.
   */
  private resolution = 0;

  constructor() {
    effect(() => {
      const id = this.widgetId();
      void this.resolve(id);
    });
  }

  private async resolve(id: string): Promise<void> {
    const token = ++this.resolution;

    const definition = this.registry.getDefinition(id);
    if (!definition) {
      this.apply(token, 'unknown', null);
      return;
    }

    if (!this.permission.hasAnyRole(definition.availableFor)) {
      this.apply(token, 'forbidden', null);
      return;
    }

    this.apply(token, 'loading', null);

    try {
      const component = await this.registry.loadComponent(id);
      this.apply(token, 'ready', component);
    } catch {
      // No component registered for this id yet, or its chunk failed to load.
      // Either way the tile says so and the rest of the dashboard survives.
      this.apply(token, 'unbuilt', null);
    }
  }

  private apply(token: number, state: HostState, component: Type<unknown> | null): void {
    if (token !== this.resolution) return;
    this.state.set(state);
    this.component.set(component);
  }
}
