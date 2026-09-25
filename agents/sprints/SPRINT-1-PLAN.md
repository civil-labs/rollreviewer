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
  - **Implemented**: Structured `apps/frontend/src/routes/` with TanStack Router file-based routing components (`__root.tsx`, `index.tsx`, `admin.tsx`), route tree (`routeTree.gen.ts`), and router instance (`router.ts`), mounted via `<RouterProvider router={router} />` in `App.tsx`. All routes enforce auth session protection with automatic OIDC login redirection.