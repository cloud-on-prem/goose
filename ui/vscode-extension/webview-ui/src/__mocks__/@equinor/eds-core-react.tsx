import React from 'react';

// Mock Button component
export const Button = ({
    children,
    onClick,
    className,
    variant,
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
    className?: string;
}) => (
    <button
        onClick={onClick}
        className={className}
        data-variant={variant}
        {...props}
    >
        {children}
    </button>
);

// Mock Icon component
export const Icon = ({
    data,
    size,
    ...props
}: {
    data: any;
    size?: number;
}) => (
    <span
        className="eds-icon"
        data-icon-name={data?.name || 'icon'}
        data-icon-size={size}
        {...props}
    />
);

// Mock Accordion components
export const Accordion = {
    Header: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
        <div className="eds-accordion-header" {...props}>{children}</div>
    ),
    Panel: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
        <div className="eds-accordion-panel" {...props}>{children}</div>
    )
}; 
