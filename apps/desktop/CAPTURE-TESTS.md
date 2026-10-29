# Testes manuais da captura nativa (por versão de SO)

O módulo `src-tauri/src/capture/` é a única parte nativa e **não roda no CI**.
Cada mudança nele exige rodar os testes abaixo e anotar a versão do SO.

## Windows (WASAPI loopback)

| #   | Passo                                         | Esperado                                                            |
| --- | --------------------------------------------- | ------------------------------------------------------------------- |
| 1   | Entrar numa reunião no Teams desktop e gravar | Faixa "outros" tem a voz dos participantes; "eu" tem só o microfone |
| 2   | Trocar o dispositivo de saída no meio (fone)  | Captura acompanha sem interromper                                   |
| 3   | Deixar o app da reunião no mudo               | Afeta a gravação (esperado); mudo da reunião não afeta              |
| 4   | Sem internet por 2 min                        | Blocos ficam na fila e sobem ao voltar (nenhum perdido)             |

Versões testadas: _(anotar: Windows 11 23H2 → OK/erro, data)_

## macOS (ScreenCaptureKit / Core Audio)

| #   | Passo                          | Esperado                                            |
| --- | ------------------------------ | --------------------------------------------------- |
| 1   | Primeiro uso                   | App guia a permissão "Gravação de áudio do sistema" |
| 2   | Reunião no Meet pelo navegador | Faixas "eu" × "outros" corretas                     |
| 3   | Computador dorme e volta       | Pausa e pergunta se retoma                          |

Versões testadas: _(anotar: macOS 15.x → OK/erro, data)_

## Aceite (SPEC 2)

Gravar uma reunião no Teams desktop e outra no Meet pelo navegador; ambas com as
faixas "Eu" e "Outros" corretas na transcrição.
