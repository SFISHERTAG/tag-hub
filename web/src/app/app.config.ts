import {
  ApplicationConfig,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  isDevMode,
  inject,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
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
    provideRouter(routes),
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
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
