import React from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  children: React.ReactNode;
  text: string;
}

export function Tooltip({ children, text }: TooltipProps) {
  const [isVisible, setIsVisible] = React.useState(false);
  const [coords, setCoords] = React.useState({ top: 0, left: 0 });
  const triggerRef = React.useRef<HTMLSpanElement>(null);
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const hideTimeoutRef = React.useRef<number>();

  const updatePosition = React.useCallback(() => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipHeight = tooltipRef.current?.offsetHeight || 60;
    const gap = 8;

    setCoords({
      left: rect.left + rect.width / 2,
      top: rect.top - tooltipHeight - gap,
    });
  }, []);

  const show = React.useCallback(() => {
    clearTimeout(hideTimeoutRef.current);
    updatePosition();
    setIsVisible(true);
  }, [updatePosition]);

  const hide = React.useCallback(() => {
    hideTimeoutRef.current = window.setTimeout(() => setIsVisible(false), 100);
  }, []);

  React.useEffect(() => {
    if (!isVisible) return;

    updatePosition();

    const handleUpdate = () => updatePosition();
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [isVisible, updatePosition]);

  React.useEffect(() => () => clearTimeout(hideTimeoutRef.current), []);

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="group relative inline-block"
      >
        <span className="cursor-help">{children}</span>
      </span>
      {isVisible &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              transform: 'translateX(-50%)',
              zIndex: 9999,
            }}
            className="pointer-events-none w-56 rounded-md bg-gray-900 px-3 py-2 text-xs leading-relaxed text-gray-100 shadow-lg opacity-100 transition-opacity"
          >
            {text}
            <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
          </div>,
          document.body
        )}
    </>
  );
}
