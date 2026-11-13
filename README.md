# ClipVault — Build 0.2.0

Vault de imagens para **Windows 11**, inteiramente local. Captura imagens copiadas para o clipboard e organiza automaticamente em um canvas infinito com um frame por dia.

## Novidade: reutilizar qualquer imagem

- **Clique em uma imagem** do canvas para colocá-la automaticamente no clipboard (sinal de confirmação no rodapé).
- Vá para outro aplicativo (Paint, Photoshop, Discord etc.) e use **Ctrl+V**. O app de destino precisa aceitar colagem de imagens.
- **Ctrl+C** dentro do ClipVault copia novamente a imagem selecionada.
- Arrastar uma imagem no canvas **não** substitui seu clipboard.
- Copiar uma imagem a partir do Vault **não** cria outra cópia armazenada no próprio Vault.

## Compilar o ClipVault.exe (Windows, uma vez)

Abra o PowerShell na pasta do projeto:

~~~powershell
cd C:\Users\raf\clipvault
git pull
npm.cmd install
npm.cmd test
npm.cmd run build:win
~~~

O executável portátil será criado em **dist\ClipVault.exe**. Pode copiar esse arquivo para a Área de Trabalho e executá-lo com duplo clique, sem precisar abrir o PowerShell. O app não exige instalação. Como o executável não é assinado digitalmente, o Windows pode apresentar um aviso de segurança.

A primeira compilação **baixa ferramentas de build e o Electron**, mas o **aplicativo em execução não se conecta à internet**. O próprio projeto desabilita chamadas de rede da janela e não contém telemetria, cloud ou atualizações automáticas.

Para executar o projeto em modo de desenvolvimento, use **npm.cmd start**. Para compilar novamente depois de um pull, rode **npm.cmd install** (se houver mudanças nas dependências) e **npm.cmd run build:win**.

## Local de armazenamento e privacidade

- PNGs capturados: **%USERPROFILE%\ClipVaultData\AAAA-MM-DD\**
- Posições do canvas: **%USERPROFILE%\ClipVaultData\layout.json**
- **O GitHub armazena apenas código, documentação e configuração. Nenhum screenshot, PNG, ICO, EXE ou asset gerado entra no repositório.**
- O script **scripts/generate-icon.js** desenha um quadro-cofre e gera localmente **build/icon.png** e **build/icon.ico** para a bandeja, janela e executável. Essa pasta é ignorada pelo Git.
- Os executáveis ficam em **dist/**, igualmente ignorada pelo Git.

## Controles

| Ação | Comando |
| --- | --- |
| Capturar imagem externa | Copie uma imagem (Ctrl+C no app de origem) |
| Copiar imagem do Vault | Clique na imagem ou selecione e pressione Ctrl+C |
| Colar em outro aplicativo | Ctrl+V no aplicativo de destino |
| Arrastar imagem | Arraste com botão esquerdo |
| Zoom | Roda do mouse |
| Mover canvas | Arraste o fundo |
| Retornar ao topo | Home |
| Apagar imagem do HD | Selecione a imagem e pressione Delete |
| Apagar um dia | Botão **Apagar dia**, confirmação obrigatória |
| Pausar/retomar captura | Ctrl+Alt+P ou menu na bandeja |
| Encerrar | Menu da bandeja > Sair |

Fechar a janela não encerra a captura; o app continua na bandeja do Windows. A cópia para outros apps funciona mesmo quando a captura está pausada.

## Testes

**npm.cmd test** valida sintaxe, políticas de segurança, o contrato de leitura e escrita do clipboard com mocks, os caminhos de arquivos e a geração do ícone PNG/ICO. Esse comando não abre o Electron nem acessa seu banco de imagens.

**Atenção:** um teste de uso real do executável, da bandeja e da colagem em outros aplicativos precisa ser realizado no Windows. Ainda não há miniaturas, limpeza automática ou início com Windows.

A Build 0.1.1 foi aprovada como baseline anterior; a 0.2.0 adiciona somente cópia de imagens e build portátil.

## Nomes de arquivos (Build 0.2.1)

As novas capturas recebem nomes como `13_11_2026_15h30m_01.png`, `13_11_2026_15h30m_02.png`. O último número é sequencial **por minuto**, sem sobrescrever capturas anteriores, mesmo após reiniciar. A organização das pastas por dia (`AAAA-MM-DD`) e os arquivos antigos **não mudam**, preservando as referências em `layout.json`.
