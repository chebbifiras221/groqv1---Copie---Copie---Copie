import React, { ButtonHTMLAttributes, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { LoadingSVG } from "./loading-svg";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-50 leading-none",
  {
    variants: {
      variant: {
        default: "bg-button-bg text-button-text hover:bg-button-hover-bg active:bg-button-active-bg",
        primary: "bg-primary-DEFAULT/80 text-white hover:bg-primary-hover active:bg-primary-focus border border-primary-DEFAULT/20 shadow-none",
        secondary: "bg-secondary-DEFAULT/90 text-white hover:bg-secondary-hover active:bg-secondary-focus",
        success: "bg-success-DEFAULT/90 text-white hover:bg-success-hover active:bg-success-focus",
        danger: "bg-danger-DEFAULT/90 text-white hover:bg-danger-hover active:bg-danger-focus",
        warning: "bg-warning-DEFAULT/90 text-text-inverse hover:bg-warning-hover active:bg-warning-focus",
        outline: "bg-transparent border border-bg-tertiary/30 hover:bg-bg-tertiary/10 hover:text-text-primary shadow-none",
        ghost: "bg-transparent text-text-secondary hover:bg-bg-tertiary hover:text-text-primary",
        link: "bg-transparent text-primary-DEFAULT underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8 text-base",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  children: ReactNode;
  className?: string;
  isLoading?: boolean;
}

export function Button({
  children,
  className,
  variant,
  size,
  isLoading = false,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <LoadingSVG size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
        </span>
      )}
      <span className={isLoading ? "invisible" : ""}>{children}</span>
    </button>
  );
}


