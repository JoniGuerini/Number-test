/** Virtualização de lista: itens fora da janela (com folga) viram fantasmas
    da mesma altura medida — o React não monta o conteúdo, o scroll não pula.
    A simulação não entra aqui; só a renderização. */

import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type MutableRefObject,
  type ReactNode,
  type Ref,
} from 'react';
import styles from './VirtualList.module.css';

const VirtualRootContext = createContext<HTMLElement | null>(null);

/** Folga extra acima/abaixo da janela para o conteúdo montar antes de
    entrar na tela (evita flash ao scrollar). ~3–4 cards de gerador. */
const OVERSCAN = '280px 0px';

const bindRef = <T,>(ref: Ref<T> | undefined, value: T | null) => {
  if (!ref) return;
  if (typeof ref === 'function') ref(value);
  else (ref as MutableRefObject<T | null>).current = value;
};

export const VirtualList = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(function VirtualList({ children, ...rest }, ref) {
  const [root, setRoot] = useState<HTMLElement | null>(null);

  return (
    <VirtualRootContext.Provider value={root}>
      <div
        {...rest}
        ref={(el) => {
          setRoot((prev) => (prev === el ? prev : el));
          bindRef(ref, el);
        }}
      >
        {children}
      </div>
    </VirtualRootContext.Provider>
  );
});

interface VirtualItemProps {
  /** Altura até a primeira medição (px). */
  estimateHeight: number;
  className?: string;
  children: () => ReactNode;
}

export function VirtualItem({
  estimateHeight,
  className,
  children,
}: VirtualItemProps) {
  const root = useContext(VirtualRootContext);
  const wrapRef = useRef<HTMLDivElement>(null);
  const heightRef = useRef(estimateHeight);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !root) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          return;
        }
        const h = el.getBoundingClientRect().height;
        if (h > 0) heightRef.current = h;
        setVisible(false);
      },
      { root, rootMargin: OVERSCAN, threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [root]);

  useLayoutEffect(() => {
    if (!visible) return;
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const h = el.getBoundingClientRect().height;
      if (h > 0) heightRef.current = h;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [visible]);

  // Card ↔ fantasma pode mudar scrollHeight sem o usuário rolar; o listener
  // de scroll da lista (setinhas, fades) precisa reavaliar.
  useEffect(() => {
    if (!root) return;
    root.dispatchEvent(new Event('scroll'));
  }, [visible, root]);

  return (
    <div
      ref={wrapRef}
      className={className ? `${styles.item} ${className}` : styles.item}
      style={
        visible
          ? undefined
          : { height: heightRef.current, overflow: 'hidden' }
      }
      aria-hidden={!visible || undefined}
    >
      {visible ? children() : null}
    </div>
  );
}
