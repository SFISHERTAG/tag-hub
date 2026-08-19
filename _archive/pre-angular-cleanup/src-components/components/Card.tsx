import React from 'react';
import './Card.css';

/**
 * Card Component
 * Generic container with border and padding
 */
interface CardProps {
  children: React.ReactNode;
  elevated?: boolean;
  interactive?: boolean;
  padding?: 'sm' | 'md' | 'lg' | 'xl';
  onClick?: () => void;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  elevated = false,
  interactive = false,
  padding = 'lg',
  onClick,
  className = '',
}) => {
  return (
    <div
      className={`card ${elevated ? 'elevated' : ''} ${interactive ? 'interactive' : ''} card-padding-${padding} ${className}`}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (e) => e.key === 'Enter' && onClick?.() : undefined}
    >
      {children}
    </div>
  );
};

/**
 * Badge Component
 * Small label with background
 */
type BadgeVariant = 'success' | 'warning' | 'danger' | 'primary' | 'neutral';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  icon,
}) => {
  return (
    <span className={`badge badge-${variant}`}>
      {icon && <span className="badge-icon">{icon}</span>}
      {children}
    </span>
  );
};

/**
 * Grid Component
 * Responsive grid layout
 */
interface GridProps {
  children: React.ReactNode;
  columns?: number | { sm: number; md: number; lg: number };
  gap?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const Grid: React.FC<GridProps> = ({
  children,
  columns = 1,
  gap = 'lg',
  className = '',
}) => {
  const columnsValue = typeof columns === 'number' ? columns : columns.lg;

  return (
    <div
      className={`grid grid-cols-${columnsValue} grid-gap-${gap} ${className}`}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columnsValue}, 1fr)`,
        gap: `var(--space-${gap === 'sm' ? 'md' : gap === 'md' ? 'lg' : gap === 'lg' ? 'xl' : '2xl'})`,
      }}
    >
      {children}
    </div>
  );
};

/**
 * Flex Component
 * Flexible layout container
 */
interface FlexProps {
  children: React.ReactNode;
  direction?: 'row' | 'column';
  justify?: 'start' | 'center' | 'between' | 'end';
  align?: 'start' | 'center' | 'end' | 'stretch';
  gap?: 'sm' | 'md' | 'lg' | 'xl';
  wrap?: boolean;
  className?: string;
}

export const Flex: React.FC<FlexProps> = ({
  children,
  direction = 'row',
  justify = 'start',
  align = 'center',
  gap = 'lg',
  wrap = false,
  className = '',
}) => {
  const justifyMap = {
    start: 'flex-start',
    center: 'center',
    between: 'space-between',
    end: 'flex-end',
  };

  const alignMap = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
    stretch: 'stretch',
  };

  const gapMap = {
    sm: 'var(--space-md)',
    md: 'var(--space-lg)',
    lg: 'var(--space-xl)',
    xl: 'var(--space-2xl)',
  };

  return (
    <div
      className={`flex ${className}`}
      style={{
        display: 'flex',
        flexDirection: direction,
        justifyContent: justifyMap[justify],
        alignItems: alignMap[align],
        gap: gapMap[gap],
        flexWrap: wrap ? 'wrap' : 'nowrap',
      }}
    >
      {children}
    </div>
  );
};

/**
 * Container Component
 * Centered content container with max-width
 */
interface ContainerProps {
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  centered?: boolean;
  padding?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const Container: React.FC<ContainerProps> = ({
  children,
  size = 'lg',
  centered = true,
  padding = 'lg',
  className = '',
}) => {
  const sizeMap = {
    sm: '600px',
    md: '900px',
    lg: '1200px',
    xl: '1400px',
    full: '100%',
  };

  const paddingMap = {
    sm: 'var(--space-md)',
    md: 'var(--space-lg)',
    lg: 'var(--space-xl)',
    xl: 'var(--space-2xl)',
  };

  return (
    <div
      className={`container ${className}`}
      style={{
        maxWidth: sizeMap[size],
        margin: centered ? '0 auto' : '0',
        padding: paddingMap[padding],
        width: '100%',
      }}
    >
      {children}
    </div>
  );
};

export default { Card, Badge, Grid, Flex, Container };
