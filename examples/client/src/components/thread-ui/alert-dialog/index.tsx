"use client";

import { memo, useCallback, useEffect, useState } from "react";
import type { FC, PropsWithChildren, ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export interface AlertDialogOptions {
  title: ReactNode;
  description?: ReactNode;
  content?: ReactNode;
  icon?: ReactNode;
  size?: "default" | "sm";
  cancelText?: string;
  confirmText?: string;
  variant?: "default" | "destructive";
}

interface AlertDialogItemProps {
  id: number;
  options: AlertDialogOptions;
  resolve: (value: boolean) => void;
  open: boolean;
}

type AlertDialogListener = (item: AlertDialogItemProps) => void;

class AlertDialogManager {
  private listeners = new Set<AlertDialogListener>();
  private idCounter = 0;

  subscribe(listener: AlertDialogListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  show(options: AlertDialogOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.listeners.forEach((listener) =>
        listener({
          id: this.idCounter++,
          options,
          resolve,
          open: true,
        }),
      );
    });
  }
}

const MANAGER_KEY = Symbol.for("alert-dialog-manager");

const getManager = (): AlertDialogManager => {
  const globalObj = globalThis as unknown as Record<symbol, AlertDialogManager>;
  if (!globalObj[MANAGER_KEY]) {
    globalObj[MANAGER_KEY] = new AlertDialogManager();
  }
  return globalObj[MANAGER_KEY];
};

const manager = getManager();

export const alertDialog = (options: AlertDialogOptions): Promise<boolean> => {
  return manager.show(options);
};

interface AlertDialogRendererProps {
  dialog: AlertDialogItemProps;
  onClose: (id: number, result: boolean) => void;
  onRemove: (id: number) => void;
}

const AlertDialogRenderer = memo(function AlertDialogRenderer({
  dialog,
  onClose,
  onRemove,
}: AlertDialogRendererProps) {
  const { id, open, options } = dialog;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(open) => {
        if (!open) onClose(id, false);
      }}
      onOpenChangeComplete={(open) => {
        if (!open) onRemove(id);
      }}
    >
      <AlertDialogContent data-testid="alert-dialog" size={options.size}>
        <AlertDialogHeader>
          {options.icon && (
            <AlertDialogMedia
              className={cn(
                options.variant === "destructive" &&
                  "bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive",
              )}
            >
              {options.icon}
            </AlertDialogMedia>
          )}
          <AlertDialogTitle>{options.title}</AlertDialogTitle>
          {options.description && (
            <AlertDialogDescription>
              {options.description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>

        {options.content}

        <AlertDialogFooter>
          <AlertDialogCancel data-testid="alert-dialog-cancel">
            {options.cancelText ?? "Cancel"}
          </AlertDialogCancel>
          <AlertDialogAction
            data-testid="alert-dialog-confirm"
            variant={options.variant}
            onClick={() => onClose(id, true)}
          >
            {options.confirmText ?? "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
});

export const AlertDialogProvider: FC<PropsWithChildren> = ({ children }) => {
  const [dialogs, setDialogs] = useState<Array<AlertDialogItemProps>>([]);

  useEffect(() => {
    const unsubscribe = manager.subscribe((item) => {
      setDialogs((prev) => [...prev, item]);
    });

    return () => {
      unsubscribe();

      setDialogs((prev) => {
        prev.forEach((dialog) => {
          if (dialog.open) dialog.resolve(false);
        });
        return [];
      });
    };
  }, []);

  const handleClose = useCallback((id: number, result: boolean) => {
    setDialogs((prev) => {
      const dialog = prev.find((item) => item.id === id);
      if (dialog && dialog.open) {
        dialog.resolve(result);
        return prev.map((item) =>
          item.id === id ? { ...item, open: false } : item,
        );
      }
      return prev;
    });
  }, []);

  const handleRemove = useCallback((id: number) => {
    setDialogs((prev) => prev.filter((dialog) => dialog.id !== id));
  }, []);

  return (
    <>
      {children}
      {dialogs.map((dialog) => (
        <AlertDialogRenderer
          key={dialog.id}
          dialog={dialog}
          onClose={handleClose}
          onRemove={handleRemove}
        />
      ))}
    </>
  );
};
