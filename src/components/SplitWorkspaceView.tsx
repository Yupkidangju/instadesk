import React, { useEffect, useRef, useState } from 'react';
import { TerminalView } from './terminal/TerminalView';
import { DesktopScreenView } from './desktop/DesktopScreenView';

interface SplitWorkspaceViewProps {
  tileId: string;
  machineId: string;
  profileId: string;
  sessionName: string;
  viewOnly: boolean;
  onSessionChange: (session: string) => void;
  onViewOnlyChange: (viewOnly: boolean) => void;
}

const clamp = (value: number) => Math.max(25, Math.min(75, value));

export const SplitWorkspaceView: React.FC<SplitWorkspaceViewProps> = (props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [ratio, setRatio] = useState(50);
  const [horizontal, setHorizontal] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setHorizontal(entry.contentRect.width >= 700));
    setHorizontal(container.getBoundingClientRect().width >= 700);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const moveDivider = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const position = horizontal ? clientX - rect.left : clientY - rect.top;
    const extent = horizontal ? rect.width : rect.height;
    if (extent > 0) setRatio(clamp(position / extent * 100));
  };

  return (
    <div ref={containerRef} className={`flex h-full w-full min-h-0 min-w-0 ${horizontal ? 'flex-row' : 'flex-col'}`}>
      <div className="min-h-0 min-w-0 shrink-0 overflow-hidden" style={horizontal ? { width: `${ratio}%` } : { height: `${ratio}%` }}>
        <TerminalView tileId={props.tileId} machineId={props.machineId} profileId={props.profileId}
          sessionName={props.sessionName} onSessionChange={props.onSessionChange} />
      </div>
      <div role="separator" tabIndex={0} aria-label="Resize terminal and desktop"
        aria-orientation={horizontal ? 'vertical' : 'horizontal'} aria-valuemin={25} aria-valuemax={75} aria-valuenow={Math.round(ratio)}
        onPointerDown={(event) => {
          draggingRef.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          moveDivider(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => { if (draggingRef.current) moveDivider(event.clientX, event.clientY); }}
        onPointerUp={(event) => { draggingRef.current = false; event.currentTarget.releasePointerCapture(event.pointerId); }}
        onPointerCancel={() => { draggingRef.current = false; }}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 10 : 5;
          const decrease = horizontal ? event.key === 'ArrowLeft' : event.key === 'ArrowUp';
          const increase = horizontal ? event.key === 'ArrowRight' : event.key === 'ArrowDown';
          if (decrease || increase || event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            setRatio((current) => event.key === 'Home' ? 25 : event.key === 'End' ? 75 : clamp(current + (decrease ? -step : step)));
          }
        }}
        className={`${horizontal ? 'w-2 cursor-col-resize' : 'h-2 cursor-row-resize'} shrink-0 bg-zinc-800 hover:bg-swiss-red focus:bg-swiss-red focus:outline-none touch-none`}
      />
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
        <DesktopScreenView machineId={props.machineId} profileId={props.profileId}
          viewOnly={props.viewOnly} onViewOnlyChange={props.onViewOnlyChange} />
      </div>
    </div>
  );
};
