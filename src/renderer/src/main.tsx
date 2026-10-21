import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initConfig } from "./state/config";
import "./styles/theme.css";

initConfig().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
