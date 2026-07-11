import React, { useState } from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void | Promise<unknown>;
  loading?: boolean;
}

export function Button({
  onClick,
  loading: propLoading,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const [localLoading, setLocalLoading] = useState(false);
  const isLoading = propLoading || localLoading;

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!onClick) return;
    const result = onClick(e);
    if (result instanceof Promise) {
      setLocalLoading(true);
      try {
        await result;
      } finally {
        setLocalLoading(false);
      }
    }
  };

  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      onClick={onClick ? handleClick : undefined}
      data-loading={isLoading ? 'true' : undefined}
    >
      {children}
    </button>
  );
}
