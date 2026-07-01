import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/classes/$id")({
  component: () => <Outlet />,
});