import React from "react";
import ReactDOM from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import "./index.css";
import App from "./App.jsx";

console.log("[boot] app start");

function isCapacitorIos() {
  const userAgent = window.navigator?.userAgent || "";
  const isIosDevice = /iPad|iPhone|iPod/.test(userAgent);
  const capacitorPlatform = window.Capacitor?.getPlatform?.();

  return window.location.protocol === "capacitor:" || capacitorPlatform === "ios" || isIosDevice;
}

function setupCapacitorIosLayout() {
  if (!isCapacitorIos()) return;

  document.body.classList.add("capacitor-ios");

  const scrollFocusedControlIntoView = (event) => {
    const target = event.target;
    if (!target?.matches?.("input, textarea, select")) return;

    document.body.classList.add("keyboard-open");
    window.setTimeout(() => {
      target.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    }, 280);
  };

  document.addEventListener("focusin", scrollFocusedControlIntoView);
  document.addEventListener("focusout", () => {
    window.setTimeout(() => {
      if (!document.activeElement?.matches?.("input, textarea, select")) {
        document.body.classList.remove("keyboard-open");
      }
    }, 80);
  });
}

setupCapacitorIosLayout();

function reportBootError(error) {
  console.error("[boot] error", error);
}

window.onerror = (_message, _source, _lineno, _colno, error) => {
  reportBootError(error || _message);
};

window.onunhandledrejection = (event) => {
  reportBootError(event.reason || event);
};

function BootErrorScreen({ error }) {
  const message = error?.message || String(error || "Unknown error");

  return (
    <div className="boot-error-screen">
      <h1>Ball Knowledge could not start.</h1>
      {import.meta.env.DEV && <pre>{message}</pre>}
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    reportBootError(error);
  }

  render() {
    if (this.state.error) return <BootErrorScreen error={this.state.error} />;
    return this.props.children;
  }
}

try {
  const rootElement = document.getElementById("root");
  const capacitorIos = isCapacitorIos();
  console.log("[boot] rendering React");
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
        {!capacitorIos && <Analytics />}
      </ErrorBoundary>
    </React.StrictMode>
  );
  window.clearTimeout(window.__ballKnowledgeBootTimer);
  console.log("[boot] React rendered");
} catch (error) {
  reportBootError(error);
  const rootElement = document.getElementById("root");
  if (rootElement) {
    rootElement.innerHTML =
      '<div class="boot-error-screen"><h1>Ball Knowledge could not start.</h1></div>';
  }
}
