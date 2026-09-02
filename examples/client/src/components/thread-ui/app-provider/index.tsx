"use client";

import { I18nextProvider, useTranslation } from "react-i18next";
import type { FC, PropsWithChildren } from "react";
import type { i18n as I18nInstance } from "i18next";

import type { ToastProviderProps } from "@/components/thread-ui/toast";
import { AlertDialogProvider } from "@/components/thread-ui/alert-dialog";
import { ToastProvider } from "@/components/thread-ui/toast";

export type AppProviderProps = PropsWithChildren<{
  i18n: I18nInstance;
  toast?: ToastProviderProps;
}>;

export const useThreadUITranslation = () => {
  return useTranslation("thread-ui");
};

export const AppProvider: FC<AppProviderProps> = ({
  children,
  i18n,
  toast,
}) => {
  return (
    <I18nextProvider i18n={i18n}>
      <AlertDialogProvider>
        <ToastProvider {...toast}>{children}</ToastProvider>
      </AlertDialogProvider>
    </I18nextProvider>
  );
};
