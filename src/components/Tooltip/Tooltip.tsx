/** App-styled hover tooltip. Replaces the browser `title` chrome so the
    hint matches paper cards, mono type and brass tokens. Portaled to
    `document.body` so list/row `overflow: hidden` cannot clip it. */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './Tooltip.module.css';

interface TooltipProps {
  text: string;
  children: ReactNode;
  className?: string;
}

interface Pos {
  left: number;
  top: number;
  place: 'above' | 'below';
}

export default function Tooltip({ text, children, className }: TooltipProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);

  const place = () => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const placeAbove = r.top > 44;
    setPos({
      left: Math.min(r.right, window.innerWidth - 8),
      top: placeAbove ? r.top : r.bottom,
      place: placeAbove ? 'above' : 'below',
    });
  };

  const show = () => {
    place();
    setOpen(true);
  };
  const hide = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onMove = () => {
      place();
    };
    const onClose = () => setOpen(false);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onClose);
    };
  }, [open]);

  return (
    <span
      ref={anchorRef}
      className={`${styles.anchor}${className ? ` ${className}` : ''}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusCapture={show}
      onBlurCapture={hide}
    >
      {children}
      {open &&
        pos &&
        createPortal(
          <div
            role="tooltip"
            className={styles.tip}
            data-place={pos.place}
            style={{ left: pos.left, top: pos.top }}
          >
            {text}
          </div>,
          document.body
        )}
    </span>
  );
}
