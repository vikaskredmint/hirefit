import { createFileRoute, redirect } from "@tanstack/react-router";

// Root URL just redirects into the authenticated shell.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/" as never, replace: true });
  },
  component: () => null,
});
