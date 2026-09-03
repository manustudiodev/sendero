import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { UiLocaleProvider } from "../i18n/LanguageSelector.jsx";
import { GenerateTripApp } from "./GenerateTripApp.jsx";
import { hydrateActiveDraft } from "./draft-cache.js";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: Infinity,
      retry: false,
      staleTime: 30_000,
    },
  },
});
hydrateActiveDraft(queryClient);

const root = document.getElementById("root");
if (root) createRoot(root).render(
  <QueryClientProvider client={queryClient}>
    <UiLocaleProvider><GenerateTripApp /></UiLocaleProvider>
  </QueryClientProvider>,
);
