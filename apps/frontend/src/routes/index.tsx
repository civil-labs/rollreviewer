import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root.js';
import { MapPage } from '../pages/MapPage.js';

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: MapRouteComponent,
});

function MapRouteComponent() {
  return <MapPage />;
}
