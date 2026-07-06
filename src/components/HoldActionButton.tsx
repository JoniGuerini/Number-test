import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useHoldRepeat } from '../hooks/useHoldRepeat';

interface HoldActionButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  onAction: () => boolean | void;
  children: ReactNode;
}

/** Botão de ação com repetição enquanto pressionado (compra, pesquisa, troca…). */
export default function HoldActionButton({
  onAction,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: HoldActionButtonProps) {
  const hold = useHoldRepeat(onAction, !!disabled);
  return (
    <button
      type={type}
      className={className}
      disabled={disabled}
      {...rest}
      {...hold}
    >
      {children}
    </button>
  );
}
