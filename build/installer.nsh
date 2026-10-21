; Passos extras do instalador (rodam como administrador, perMachine: true).

!macro customInstall
  ; Firewall do Windows: libera o servidor embutido (porta 8077) pra que
  ; tablets e celulares da igreja abram a mesa pelo navegador. Sem isso o
  ; Windows bloqueia a porta ou abre um aviso no primeiro uso.
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Mesa de Som - Com.Vida"'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="Mesa de Som - Com.Vida" dir=in action=allow program="$INSTDIR\${APP_EXECUTABLE_FILENAME}" enable=yes profile=any'
!macroend

!macro customUnInstall
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Mesa de Som - Com.Vida"'
!macroend
