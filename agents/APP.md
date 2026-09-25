# Summary
This web application helps government property assessment offices review assessment model results across their jurisdiction and assemble their final assessment roles. It primarily does this by allowing office employees to draw polygons on a map and connect tickets to those polygons to share where they have discovered issues with the underlying models. Other employees can then review those areas and leave comments on the tickets to indicate status, with the opening employee able to close the ticket once they determine the issue is fixed. Furthermore, later versions of the tool will allow for pulling in the outputs of model runs into the tool directly and for users to use them to assign property values to parcels, and then export the final assessment roll from the app itself. The application is meant to be implemented alongside the Civil OS municipal data warehousing solution, but can be run standalone as well.

# Technical Design
- Monorepo format with a frontend and a Backend for Frontend (BFF)
- Frontend is a Typescript React Single-Page Application
- Backend is a TypeScript Node.js application that exposes routes with Hono and tRPC
- Frontend to backend communication occur:
	- REST API routes exposed by Hono
	- RPCs handled via tRPC using API contracts defined in an in-repo package written with Zod, which are also served by Hono
- Authentication is through OIDC (using the BFF Authorization Code Flow)
- Authorization is handled through backend calls to an OpenPolicyAgent instance

## Packages
### Workspace Root
- nx

#### Dev Dependencies
- @playwright/test

### Frontend
- Vite
- Zod
- @tanstack/react-router
- @tanstack/react-query
- @trpc/tanstack-react-query
- @trpc/server
- @trpc/client
- @rollreviewer/contracts
- maplibre-gl

#### Dev Dependencies
- vitest
- @testing-library/react
- happy-dom
- msw ([[Mock Service Worker]])
- oxlint
- babel-plugin-react-compiler

### Backend
- Hono
- Zod
- @trpc/server
- openid-client
- open-policy-agent/opa (Node.js SDK)
- ioredis
- @rollreviewer/contracts
- @hono/node-server

#### Dev Dependencies
- vitest
- supertest
- @types/supertest
- ioredis-mock
- @types/node

### Contracts
- Zod

#### Dev Dependencies
- vitest

## Development MCP Servers

## Supporting Services
- Valkey
- Civil OS
- Open Policy Agent

## Repository layout
- apps
	- frontend
	- backend
- packages
	- contracts