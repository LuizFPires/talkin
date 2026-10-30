import * as Notifications from 'expo-notifications';

/**
 * Indicador permanente de gravação (regra do projeto: nunca gravar sem indicador).
 * No Android, a notificação "sticky" (ongoing) sinaliza o foreground service e
 * mantém o usuário ciente de que o microfone está ativo.
 */
let notifId: string | null = null;

export async function iniciarNotificacaoGravacao(): Promise<void> {
  try {
    await Notifications.requestPermissionsAsync();
    notifId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Talkin — gravando',
        body: 'Reunião sendo gravada. Avise os participantes.',
        sticky: true, // Android: notificação permanente (não dispensável)
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null,
    });
  } catch {
    // Sem permissão de notificação: segue gravando, só não mostra o indicador fixo.
  }
}

export async function pararNotificacaoGravacao(): Promise<void> {
  try {
    if (notifId) await Notifications.dismissNotificationAsync(notifId);
  } catch {
    // ignora
  }
  notifId = null;
}
