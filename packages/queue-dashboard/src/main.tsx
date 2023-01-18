import React from "react";
import { createRoot } from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";
import List from "./pages/List";
import { QueryClient, QueryClientProvider } from "react-query";
import Detail from "./pages/Detail";

const queryClient = new QueryClient();

const router = createHashRouter([
  {
    path: "/",
    element: <List />,
  },
  {
    path: "/:name",
    element: <Detail />,
  },
]);

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>
  </QueryClientProvider>
);
