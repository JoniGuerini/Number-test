/** Lista rolável. Os itens ficam montados — desmontar fora da janela
    (IntersectionObserver + fantasma de altura) deixava buracos no scroll
    quando o card mudava de tamanho (retrato, barra de ciclo, etc.). */

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import styles from './VirtualList.module.css';

export const VirtualList = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(function VirtualList({ children, ...rest }, ref) {
  return (
    <div {...rest} ref={ref}>
      {children}
    </div>
  );
});

interface VirtualItemProps {
  /** Mantido na API; a altura real vem do conteúdo. */
  estimateHeight?: number;
  className?: string;
  children: () => ReactNode;
}

export function VirtualItem({ className, children }: VirtualItemProps) {
  return (
    <div className={className ? `${styles.item} ${className}` : styles.item}>
      {children()}
    </div>
  );
}
