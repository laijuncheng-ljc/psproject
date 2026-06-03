import type { Board } from "../types/board";
import { calculateResourceModel } from "../utils/gamification";

interface CommandProgressPanelProps {
  board: Board;
}

export function CommandProgressPanel({ board }: CommandProgressPanelProps) {
  const model = calculateResourceModel(board);
  const unlockedAchievements = model.achievements.filter(
    (achievement) => achievement.unlocked,
  );
  const nextAchievement = model.achievements.find(
    (achievement) => !achievement.unlocked,
  );
  const territoryProgress =
    model.nextTerritoryTarget > 0
      ? Math.min(100, (model.completedCards / model.nextTerritoryTarget) * 100)
      : 0;

  return (
    <section className="command-progress-panel" aria-label="资源进度">
      <div className="command-hero">
        <div className="command-hero-copy">
          <span className="command-kicker">MECHANICAL COMMAND GRID</span>
          <h2>任务完成会点亮能量、土地和领地</h2>
          <p>
            每完成卡片都会累积资源；保存时会同步写入
            project-data/resources.md 和 achievements.md。
          </p>
        </div>
        <div className="reactor-core" aria-hidden="true">
          <span>{model.energy}</span>
          <strong>能量</strong>
        </div>
      </div>
      <div className="resource-grid">
        <ResourceTile label="土地" value={model.land} unit="块" />
        <ResourceTile label="领地" value={model.territory} unit="域" />
        <ResourceTile label="机械合金" value={model.alloy} unit="份" />
        <ResourceTile label="数据核心" value={model.dataCores} unit="枚" />
      </div>
      <div className="progress-track-panel">
        <div className="progress-track-header">
          <span>下一块领地</span>
          <strong>
            {model.completedCards}/{model.nextTerritoryTarget}
          </strong>
        </div>
        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${territoryProgress}%` }} />
        </div>
        <p>
          已解锁 {unlockedAchievements.length}/{model.achievements.length} 项成就
          {nextAchievement ? `，下一项：${nextAchievement.title}` : "，全部成就已点亮"}
        </p>
      </div>
    </section>
  );
}

interface ResourceTileProps {
  label: string;
  value: number;
  unit: string;
}

function ResourceTile({ label, value, unit }: ResourceTileProps) {
  return (
    <div className="resource-tile">
      <span>{label}</span>
      <strong>{value}</strong>
      <em>{unit}</em>
    </div>
  );
}
