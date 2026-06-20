import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Evitar que el scroll cambie el valor de inputs numéricos
document.addEventListener("wheel", (e) => {
  const el = document.activeElement as HTMLInputElement | null;
  if (el?.type === "number") el.blur();
}, { passive: true });

createRoot(document.getElementById("root")!).render(<App />);
