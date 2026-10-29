import { toLibraryStatus, type RecordingStatus, type LibraryStatus } from '@talkin/core';
import { Pilula } from '@talkin/ui';

const LABEL: Record<LibraryStatus, string> = {
  gravando: 'Gravando',
  enviando: 'Enviando',
  processando: 'Processando',
  pronto: 'Ata pronta',
  erro: 'Com erro',
};

const COR: Record<LibraryStatus, string> = {
  gravando: 'var(--danger)',
  enviando: 'var(--text-secondary)',
  processando: 'var(--warning)',
  pronto: 'var(--success)',
  erro: 'var(--danger)',
};

export function StatusBadge({ status }: { status: RecordingStatus }) {
  const lib = toLibraryStatus(status);
  return (
    <Pilula style={{ color: COR[lib], borderColor: 'var(--border)' }}>
      <span
        aria-hidden
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: COR[lib],
          display: 'inline-block',
        }}
      />
      {LABEL[lib]}
    </Pilula>
  );
}
