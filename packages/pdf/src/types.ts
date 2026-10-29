import type { AtaContent, PdfTemplate } from '@talkin/core';

export type AtaOrg = {
  nome_fantasia: string;
  logo_url?: string | null;
  logo_light_url?: string | null;
  accent_color?: string | null;
  cnpj?: string | null;
  cidade?: string | null;
  uf?: string | null;
  site?: string | null;
};

export type AtaRecordingMeta = {
  title: string;
  date: string; // ISO
  durationS?: number | null;
  source?: string;
  participants?: string[];
  revisada?: boolean;
};

export type AtaDoc = {
  org: AtaOrg;
  recording: AtaRecordingMeta;
  ata: AtaContent;
  template?: PdfTemplate;
};
