import * as React from "react";

// Last-resort screen when the app itself fails to render. Plain markup with
// inline styles: the theme and Chakra provider may be what broke.
export const RootErrorFallback = () => (
  <div
    role="alert"
    style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "12px",
      background: "#1e1e1e",
      color: "#e6e6e6",
      fontFamily: "system-ui, sans-serif",
      textAlign: "center",
      padding: "16px",
    }}
  >
    <div style={{ fontSize: "18px", fontWeight: 600 }}>Something went wrong</div>
    <div style={{ fontSize: "14px", color: "#aaa" }}>Reload the page to continue. The browser console has the details.</div>
    <button type="button" onClick={() => window.location.reload()} style={{ padding: "6px 14px", cursor: "pointer" }}>
      Reload
    </button>
  </div>
);

export default RootErrorFallback;
