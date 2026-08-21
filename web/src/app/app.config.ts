import {
  ApplicationConfig,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  isDevMode,
  inject,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { registerWidgetLoaders } from './widget-loaders';
import { WidgetRegistryService } from './shared/widgets/widget-registry.service';
import { provideServiceWorker } from '@angular/service-worker';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { RBAC_SERVICE } from './core/services/rbac.service';
import { MockRbacService } from './core/services/mock-rbac.service';
import { HttpRbacService } from './core/services/http-rbac.service';
import { RbacService } from './core/services/rbac.service';
import { APP_CONFIG } from './core/config/app-config';
import { validateAppConfig } from './core/config/app-config.validator';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: APP_CONFIG, useValue: environment },
    // Fails the app at startup on a malformed config rather than at the first
    // request that needed the missing value. Same rule CLAUDE.md states for
    // lib/config.ts, applied on this side of the network boundary.
    provideAppInitializer(() => validateAppConfig(environment)),
    // withComponentInputBinding is required, not cosmetic. `ClientDetail`
    // declares `clientId = input.required<string>()` and is reached at
    // /clients/:clientId; without this the router never writes that input and
    // the first read throws NG0950 at runtime — a compile-clean crash on a
    // route the build cannot catch. Every other routed screen reads
    // ActivatedRoute.paramMap directly and is unaffected either way.
    //
    // This also binds route `data` and query params to same-named inputs. No
    // routed component declares an input named `permission`, `page` or `view`,
    // so nothing is shadowed today; check that before naming a new input after
    // a route data key.
    provideRouter(routes, withComponentInputBinding()),
    // Order matters and is not obvious: withInterceptors composes via
    // reduceRight, so the LAST entry is outermost and sees an error first.
    // With authInterceptor last, errorInterceptor's catchError ran first and
    // rethrew a plain ApiError; authInterceptor then tested
    // `error instanceof HttpErrorResponse`, got false, and never refreshed —
    // the mandated single-in-flight 401 refresh was unreachable dead code.
    // errorInterceptor must be outermost: authInterceptor gets the raw
    // HttpErrorResponse and may retry, and only a failure that survives the
    // retry becomes a typed ApiError for the caller.
    provideHttpClient(withInterceptors([errorInterceptor, authInterceptor])),
    // The mock stays confined to development so `ng serve` works without a
    // running API. It carries a hardcoded tag_exec session including `admin` in
    // availableRoles, so providing it unconditionally (as this once did) meant
    // every guard passed for everyone in a production bundle.
    { provide: RBAC_SERVICE, useClass: isDevMode() ? MockRbacService : HttpRbacService },
    // Resolve the session BEFORE any route activates.
    //
    // provideAppInitializer awaits a returned promise, and the router's default
    // initialNavigation runs in a bootstrap listener after those settle, so
    // route activation genuinely waits. Without this, authGuard reads a signal
    // that is still null on a cold load and bounces a signed-in user to
    // /signin — a bug that only ever appears on first paint.
    //
    // This holds only while nobody adds withEnabledBlockingInitialNavigation()
    // to provideRouter: that registers a competing initializer and navigates
    // concurrently. Do not add it.
    provideAppInitializer(() => inject<RbacService>(RBAC_SERVICE).load()),
    // Populate the widget registry before the router activates anything, so a
    // dashboard reached by deep link finds its loaders already there. Cheap and
    // synchronous: registration is Map.set calls over dynamic imports, and no
    // widget chunk is fetched until a layout actually places one.
    provideAppInitializer(() => registerWidgetLoaders(inject(WidgetRegistryService))),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
