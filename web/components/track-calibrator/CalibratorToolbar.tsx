"use client";

export function CalibratorToolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onReverse,
  onImport,
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo(): void;
  onRedo(): void;
  onReverse(): void;
  onImport(file: File): void;
}) {
  return <section className="calibrator-toolbar" aria-label="标定编辑工具栏">
    <button data-testid="undo-track-change" type="button" disabled={!canUndo} onClick={onUndo}>撤销</button>
    <button data-testid="redo-track-change" type="button" disabled={!canRedo} onClick={onRedo}>重做</button>
    <button data-testid="reverse-direction" type="button" onClick={onReverse}>反转赛道方向</button>
    <label className="calibrator-import">导入 Draft
      <input data-testid="import-draft" type="file" accept="application/json,.json" onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) onImport(file);
        event.currentTarget.value = "";
      }} />
    </label>
  </section>;
}
