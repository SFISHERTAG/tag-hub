import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

/**
 * App is a bootstrap host with nothing in it, and that is the property worth
 * testing. It used to be the shell, which put five Material modules into the
 * initial bundle for every visitor. The shell now lives at layout/shell behind
 * a lazy guarded route.
 *
 * The shell's own behaviour is covered by layout/shell/shell.spec.ts.
 */
describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('creates', () => {
    expect(TestBed.createComponent(App).componentInstance).toBeTruthy();
  });

  it('renders only a router outlet', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    // If this ever fails it means chrome crept back into the root component,
    // which is exactly the regression that costs every visitor bytes.
    expect(host.querySelector('router-outlet')).not.toBeNull();
    expect(host.querySelector('mat-toolbar')).toBeNull();
    expect(host.querySelector('mat-sidenav-container')).toBeNull();
  });
});
