import React, { useState, useEffect } from "react";
import { DiscourseNode } from "../types";

interface InteractiveNodeBannerProps {
  nodeType: DiscourseNode;
  metadata: Record<string, any>;
  onViewRelations?: () => void;
}

const InteractiveNodeBanner: React.FC<InteractiveNodeBannerProps> = ({
  nodeType,
  metadata,
  onViewRelations,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    console.log("InteractiveNodeBanner mounted with nodeType:", nodeType);
  }, [nodeType]);

  return (
    <div
      className="discourse-node-banner"
      style={{
        padding: "10px 16px",
        marginBottom: "8px",
        borderRadius: "4px",
        // background: "yellow",
        display: "flex",
        flexDirection: "column",
        transition: "all 0.2s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div>
          <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
            {nodeType.name}
          </div>
          <div style={{ fontSize: "0.8em", opacity: 0.8 }}>
            ID: {metadata.nodeInstanceId}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              background: "rgba(140, 136, 136, 0.2)",
              padding: "2px 6px",
              borderRadius: "4px",
              fontSize: "0.8em",
            }}
          >
            Discourse Node
          </span>
          <span style={{ fontSize: "0.9em" }}>{isExpanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {isExpanded && (
        <div
          style={{
            marginTop: "12px",
            padding: "8px",
            background: "rgba(255, 255, 255, 0.1)",
            borderRadius: "4px",
          }}
        >
          <div style={{ marginBottom: "8px" }}>
            <strong>Format:</strong> {nodeType.format || "N/A"}
          </div>

          {nodeType.shortcut && (
            <div style={{ marginBottom: "8px" }}>
              <strong>Shortcut:</strong> {nodeType.shortcut}
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: "8px",
            }}
          >
            <button
              className="clickable-icon"
              style={{
                padding: "4px 10px",
                background: "var(--interactive-accent)",
                color: "var(--text-on-accent)",
                borderRadius: "4px",
                border: "none",
                cursor: "pointer",
                fontSize: "0.8em",
                fontWeight: "bold",
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (onViewRelations) onViewRelations();
              }}
            >
              View Relations
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractiveNodeBanner;
