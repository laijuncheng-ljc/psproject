import type { CSSProperties } from "react";
import type { Board } from "../types/board";
import { calculateResourceModel } from "../utils/gamification";

interface CommandProgressPanelProps {
  board: Board;
}

export function CommandProgressPanel({ board }: CommandProgressPanelProps) {
  const model = calculateResourceModel(board);
  const diggingStyle = {
    "--dig-depth": `${Math.min(82, 18 + model.digDepth * 8)}px`,
  } as CSSProperties;

  return (
    <section
      className="command-progress-panel digging-progress-panel"
      aria-label={`挖坑进度，已挖 ${model.digDepth} 层`}
      style={diggingStyle}
    >
      <div className="digging-scene" aria-hidden="true">
        <div className="digging-ground">
          <span />
          <span />
          <span />
        </div>
        <div className="digging-pit">
          <span />
        </div>
        <div className="digging-worker">
          <img src="/assets/cyber-lobster-miner.png" alt="" />
        </div>
        <span className="digging-chip">{model.digDepth}</span>
      </div>
    </section>
  );
}
