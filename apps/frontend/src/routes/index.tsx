import { createFileRoute } from '@tanstack/react-router';
import { MapPage } from '../pages/MapPage.js';

export const Route = createFileRoute('/')({
  component: MapRouteComponent,
});

function MapRouteComponent() {
  return <MapPage />;
}
