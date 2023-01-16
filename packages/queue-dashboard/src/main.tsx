import React from "react";
import ReactDOM from "react-dom";
import { createHashRouter, RouterProvider } from "react-router-dom";
import List from "./pages/List";
import { QueryClient, QueryClientProvider } from "react-query";

const queryClient = new QueryClient();

const router = createHashRouter([
  {
    path: "/",
    element: <List />,
  },
]);

ReactDOM.render(
  <QueryClientProvider client={queryClient}>
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>
  </QueryClientProvider>,
  document.getElementById("root")
);
