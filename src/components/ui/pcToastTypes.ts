export type PcToastVariant = "success" | "error" | "info" | "warning";

export interface PcToastOptions {
  duration?: number;
}

export interface ShowToastPayload {
  variant: PcToastVariant;
  title: string;
  description?: string;
  duration?: number;
}

export interface ToastRecord extends ShowToastPayload {
  id: string;
  exiting?: boolean;
}
