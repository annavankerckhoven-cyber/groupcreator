import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/classes/$id/configs/$configId/runs/$runId")({
  component: () => <Outlet />,
});