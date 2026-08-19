import { ApplicationConfig, provideBrowserGlobalErrorListeners, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { RBAC_SERVICE } from './core/services/rbac.service';
import { MockRbacService } from './core/services/mock-rbac.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
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
    // Swap to a real HTTP-backed RbacService here when the session API
    // lands — every consumer depends on RBAC_SERVICE, not this class.
    { provide: RBAC_SERVICE, useClass: MockRbacService },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
