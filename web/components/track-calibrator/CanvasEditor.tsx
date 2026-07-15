"use client";

import { useEffect, useRef, useState } from "react";
import type { Point, TrackProfile } from "@/lib/track-profile";

export function CanvasEditor({ profile, backgroundUrl, onAddPoint, onMovePoint, onDeletePoint }: { profile: TrackProfile; backgroundUrl: string | null; onAddPoint(point: Point): void; onMovePoint(index: number, point: Point): void; onDeletePoint(index: number): void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const pointFor = (event: React.PointerEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>): Point => { const rect = event.currentTarget.getBoundingClientRect(); return { x: (event.clientX - rect.left) / rect.width * profile.viewBox.width, y: (event.clientY - rect.top) / rect.height * profile.viewBox.height }; };
  const nearest = (point: Point) => profile.centerline.points.reduce((best, candidate, index) => { const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y); return distance < best.distance ? { index, distance } : best; }, { index: -1, distance: Number.POSITIVE_INFINITY });
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#65f2c0";
    context.lineWidth = 4;
    context.beginPath();
    profile.centerline.points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
    context.closePath();
    context.stroke();
    profile.centerline.points.forEach((point, index) => {
      context.beginPath();
      context.arc(point.x, point.y, index === selectedIndex ? 8 : 5, 0, Math.PI * 2);
      context.fillStyle = index === selectedIndex ? "#ffbd5b" : "#f8fbff";
      context.fill();
    });
  }, [profile, selectedIndex]);
  return <div className="calibrator-canvas" style={backgroundUrl ? { backgroundImage: `url(${backgroundUrl})` } : undefined}>
    <canvas ref={ref} tabIndex={0} aria-label="赛道中心线编辑画布。选择控制点后可用 Delete 键删除。" width={profile.viewBox.width} height={profile.viewBox.height} onPointerDown={(event) => { const point = pointFor(event); const found = nearest(point); if (found.distance <= 24) { setSelectedIndex(found.index); setDragIndex(found.index); event.currentTarget.setPointerCapture(event.pointerId); } else { onAddPoint(point); setSelectedIndex(profile.centerline.points.length); } }} onPointerMove={(event) => { if (dragIndex !== null) onMovePoint(dragIndex, pointFor(event)); }} onPointerUp={() => setDragIndex(null)} onKeyDown={(event) => { if ((event.key === "Delete" || event.key === "Backspace") && selectedIndex !== null && profile.centerline.points.length > 4) { event.preventDefault(); onDeletePoint(selectedIndex); setSelectedIndex(null); } }} onDoubleClick={(event) => { const found = nearest(pointFor(event)); if (found.distance <= 24 && profile.centerline.points.length > 4) { onDeletePoint(found.index); setSelectedIndex(null); } }} data-testid="calibrator-canvas" />
  </div>;
}
