# Requirements
- Authentication 
	- Use a [[BFF Authorization Code Flow]]
	- Sessions stored in [[Valkey]]
- Authorization
	- Delegate all authz decisions to a backend call to an external OPA server using the official open-policy-agent/opa Node.js SDK
- Hosting
	- Both the frontend and backend will be hosted on the same domain
- Frontend
	- Client-Side Rendering
	- React
	- Typescript + React Compiler
	- Navigation
		- Use TanStack Router and its file-based routing system for Navigation
		- On all pages, have a pop out side bar on the left side of the screen with the following links:
			- Map
			- Admin
			- Logout
		- All pages are protected behind authentication, requiring a valid session token to see them. If the user goes to the web app without one, the app automatically redirects them to the backend's auth route
	- Pages
		- Map Page
			- Hosted at `/`
			- Currently only serves a fullscreen MapLibre GL map, with a basemap which will be retrieved from the backend
		- Admin Page (at `/admin`)
	- Authentication
		- Frontend is not aware of OAuth, relies on the backend to orchestrate
		- Session token from frontend stored in HttpOnly cookie
		- Before doing the auth redirect to the backend, the current URL should be bundled and sent so it can be returned to once auth is complete
	- API Communication
		- Use TanStack query to manage frontend state for all fetch calls to the backend
		- Use tRPC to actually make the fetch calls to the backend, with the TanStack React Query extension to integrate natively with TanStack Query
- Backend
	- Node.js with typescript
    - Hono Server
        - Top-level HTTP web server handling REST endpoints (`/api/auth/login`, `/api/auth/callback`, `/api/health`, `/api/map`) running via `@hono/node-server`
    - tRPC Server
        - Mounted via `@trpc/server/adapters/hono` middleware under the `/api/trpc/*` prefix
	- Authentication
		- Four API routes
		- `/api/auth/login`, REST endpoint to generate the auth url and initiate the BFF Authorization Code Flow
		- `/api/auth/callback`, REST endpoint to take the callback, get the token, create the session, and return back with it in a cookie
		- `/api/trpc/auth.logout`, RPC endpoint to invalidate the user's session and remove their session cookie (a consequence of which is the user is immediately redirected to the auth endpoint)
		- `/api/trpc/auth.me`, RPC endpoint to return information about a user's session and user data. Returns the a schema as in the example below
		- Use PKCE as part of the flow, generating a code_verifier and code_challenge for each auth request
		- Return To Links
			- Preserve the user's previous URL and ensure the browser is returned back to it once auth is complete
			- Reject any external host return URLs to prevent open-redirect vulnerabilities. Utilize relative path enforcement to do this
		- openid-client in the backend to handle the OAuth token swap and perhaps the auth url generation
		- Automatically handle access token refresh if the access token is invalid and a refresh token is present. If the token refresh fails, delete the user's session and force reauthentication
		- Tokens are stored on Valkey using ioredis and keyed to randomly generated session cookie values, which are returned to the frontend
		- Authentication State
			- When a user logs in, generate a random state value and store it in Valkey with the generated code_challenge and the returnTo link. Pass that state value in the state query parameter on auth
	- Map Data
		- Expose a `/api/map` REST endpoint which the frontend will request the basemap from. While the MapLibre client can utilize a lot more detail from other endpoints, this will be kept simple for now
		- The backend should proxy this request to a location defined in the basemap environment variable
		- The backend should attach the current user's access token to this proxied request
	- Configuration
		- Environment variables to inject the standard OAuth values (client ID, client secret, redirect URI, scopes)
		- Environment variable to set the port
		- Environment variable to set the basemap endpoint
		- Fail fast on all missing environment varibles
		- All environment variables should be prefixed with `OC_RR_`
		- All environment variables will be parsed and validated at boot using Zod (`OC_RR_ConfigSchema`)
	- Health Check
		- The backend exposes a REST health check API at `/api/health`
- Packages
	- Contracts
		- Stores Zod contracts for the frontend to backend communication
		- Exports the AppRouter type interface
		- Exports the Response schema for the auth.me response
		- Exports the Response schema for the auth.logout response (which will be empty)
		- Exports the `OC_RR_ConfigSchema` Zod contract for server environment variables
- Deployment
	- Local Dev Deployment
		- Local dev server for frontend
		- Backend services run on local docker containers, orchestrated with docker compose
			- Backend
			- [[mock-oauth2-server]]
			- Valkey
	- Kubernetes Cluster Deployment
		- CI/CD pipeline to build the web server for the frontend and the backend server in individual docker container images, with build decisions being made by NX and its dependency graph
		- CI/CD pipeline also runs automated unit, integration, and E2E tests
		- A helm chart to package the frontend and the backend for the app, as well as a Valkey instance, for deployment into Kubernetes clusters
- Testing
	- Refer to TESTS.md for relevant tests

# /auth/me Schema
```
{
  "isAuthenticated": true,
  "user": {
	"sub": "usr_94821a0f",
	"name": "Jane Doe",
	"email": "jdoe@county.gov",
	"preferred_username": "jdoe",
	"email_verified": true,
	"roles": ["Assessor", "TicketReviewer"],
	"jurisdiction": "District-4"
  },
  "expiresAt": "2026-09-24T23:59:59.000Z"
}
```

# Updates
## 1
- Reject the API call to the map route if the user doesn't have a session
  - **Implemented**: Updated `apps/backend/src/routes/map.ts` to inspect the `session_id` cookie and verify active Valkey session validity prior to proxying tile requests. If no session ID cookie is present or if the session is invalid/expired in Valkey, the endpoint immediately returns HTTP `401 Unauthorized` (`{ "error": "Unauthorized", "message": "Authentication session required" }`). Added corresponding unit test in `apps/backend/src/__tests__/auth.test.ts`.

## 2
- Use tanstack router's file based routing for navigation
  - **Implemented**: Configured official TanStack Router File-Based Routing using `@tanstack/router-plugin/vite` in `apps/frontend/vite.config.ts`. Created `createRootRoute` in `apps/frontend/src/routes/__root.tsx`, `createFileRoute('/')` in `apps/frontend/src/routes/index.tsx`, and `createFileRoute('/admin')` in `apps/frontend/src/routes/admin.tsx`. Integrated `@tanstack/router-cli` / `tsr generate` for auto-generating `src/routeTree.gen.ts`, producing automatic route code-splitting at build time.

## 3
- Add the frontend to the docker compose, served by an nginx web server
  - **Implemented**: Added `frontend` service to `docker-compose.yml` exposing port `${FRONTEND_PORT:-3000}:80` and depending on the backend container. Created `apps/frontend/nginx.conf` configuring Nginx with gzip compression, SPA fallback routing (`try_files $uri $uri/ /index.html`) for TanStack Router, and reverse-proxying `/api` requests to `http://backend:3001` so frontend and backend share the same origin domain for cookie-based authentication. Created multi-stage `apps/frontend/Dockerfile` leveraging pnpm monorepo workspace builds to compile static assets and copy them into an `nginx:alpine` image. Also added `apps/backend/Dockerfile` and root `.dockerignore` for unified container orchestration.

## 4
- Split OIDC front-channel issuer and back-channel token URL with issuer synchronization
  - **Implemented**: Added dual-variable support (`OC_RR_OIDC_ISSUER` for browser-facing redirection and expected ID token issuer verification; `OC_RR_OIDC_TOKEN_URL` for internal container/cluster token swap). Configured `mock-oauth2-server` in `docker-compose.yml` with `JSON_CONFIG` token callbacks to ensure minted ID tokens always sign with the expected public issuer claim (`${OC_RR_OIDC_ISSUER}`). Enhanced `backchannelFetch` in `apps/backend/src/oidc.ts` to supply `Host`, `X-Forwarded-Host`, `X-Forwarded-Proto`, `X-Forwarded-Port`, and explicit `Content-Length`. Improved OIDC discovery path resolution to support path-based realms (`/default`). Added detailed error cause logging in `/api/auth/callback`.

## 5
- Rework how access to the admin page works. Have the frontend do a pre-render check (with a loading state) to the backend on whether the user is eligible to see the admin page. If they are not elible, show a page state indicating that access is denied. If they are eligible, show a page state saying they have access and their user data object (but with no default values, just a printout of the json from the backend)
- Create a new route on the backend for the frontend to do admin authz querying at "/api/trpc/getAdminPage". It must do a check to OPA for authorization before it returns anything, and should return 403 if OPA returns they are not authorized. If they are, return a 200 with an empty response body for now. If OPA is not contactable, throw an error but proceed as if the user is unauthorized
- Wire up both these features with tlog logging
  - **Implemented**: 
    - **Backend OPA & Route**: Created `apps/backend/src/routers/admin.ts` with procedure `getAdminPageProcedure` and mounted it on `appRouter` in `apps/backend/src/router.ts` at `/api/trpc/getAdminPage`. Updated `apps/backend/src/opa.ts` to evaluate user authorization using `@open-policy-agent/opa` and re-throw errors when the OPA server is uncontactable. If OPA rejects authorization or is uncontactable, `getAdminPage` returns HTTP 403 (`TRPCError` with code `FORBIDDEN`). When authorized by OPA, it returns HTTP 200 with an empty object `{}`.
    - **Frontend Pre-Render Check & UI States**: Updated `apps/frontend/src/routes/admin.tsx` to execute a pre-render query via `trpc.getAdminPage.useQuery` alongside `trpc.auth.me.useQuery`. Reworked `apps/frontend/src/pages/AdminPage.tsx` to support three distinct states: a verification loading state, an "Access Denied" page state (when unauthorized or error), and an "Access Granted" page state displaying the raw JSON user data object without default fallbacks (`<pre>{JSON.stringify(userData, null, 2)}</pre>`).
    - **Logging**: Wired up `tslog` on both backend (`opaLogger` and `adminLogger` in `apps/backend/src/logger.ts`) and frontend (`apps/frontend/src/utils/logger.ts`) to log all authorization requests, decisions, and failure modes.
    - **Testing**: Added unit tests in `apps/backend/src/__tests__/admin.test.ts` covering unauthenticated requests (403), OPA denial (403), OPA approval (200 `{}`), and uncontactable OPA server handling (403).