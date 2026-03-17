import { useEffect, useRef } from "react";

export default function LogPanel({ logs, compact }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs.length]);

  if (compact) {
    return (
      <div className="log-panel">
        <div className="log-toolbar">
          <div className="log-title">
            Logs <span className="log-count">{logs.length}</span>
          </div>
        </div>
        <div className="log-body" ref={containerRef}>
          {logs.length === 0 ? (
            <span className="log-empty">No logs yet.</span>
          ) : (
            logs.map((line, i) => (
              <div key={i} className="log-line">{line}</div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ height: "100%" }}>
      <div className="card-header">
        <h3>Run Logs</h3>
        <span className="log-count">{logs.length} lines</span>
      </div>
      <div className="log-body" ref={containerRef} style={{ flex: 1 }}>
        {logs.length === 0 ? (
          <span className="log-empty">No logs yet. Run a tool to see output here.</span>
        ) : (
          logs.map((line, i) => (
            <div key={i} className="log-line">{line}</div>
          ))
        )}
      </div>
    </div>
  );
}
