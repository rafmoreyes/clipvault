# ClipVault · Build 001

Aplicativo **Windows**, 100% local: captura imagens copiadas para a área de transferência e organiza automaticamente em frames por data num canvas infinito.

## Primeiro uso

Na raiz do repositório (por exemplo `C:\Users\raf\clipvault`):

```powershell
npm install
npm test
npm start
```

Para atualizar depois: `git pull`, seguido de `npm install` caso o `package.json` tenha mudado.

## Comportamento

- Captura apenas imagens; conteúdos de texto são ignorados.
- Salva PNGs em `%USERPROFILE%\ClipVaultData\AAAA-MM-DD\`, fora da pasta do Git.
- Salva posições do canvas em `%USERPROFILE%\ClipVaultData\layout.json`.
- Cada dia ocupa um frame; é possível mover imagens, dar zoom e navegar pelo canvas.
- `Delete` remove a imagem selecionada **também do HD**. O botão **Apagar dia** pede confirmação.
- `Ctrl+Alt+P` pausa ou retoma a captura. Fechar a janela mantém o app ativo na bandeja; **Sair** encerra.

## Privacidade

**Nunca comitar capturas nem arquivos locais.** `.gitignore` ignora pastas de dados e arquivos de imagem comuns. O programa não faz upload, telemetria nem atualização automática; o carregamento externo da janela é bloqueado.

**Limites da Build 001:** capturas são verificadas por polling (700 ms); copiar a mesma imagem consecutivamente sem nenhuma alteração intermediária pode ser tratado como repetição. Ainda não há miniaturas, limpeza automática ou início com Windows.

## Validação

`npm test` executa smoke tests estáticos: sintaxe JavaScript, estrutura, CSP, isolamento do Electron e proteção dos dados. Um teste real de clipboard/tray no Windows continua necessário.

## Atualização Electron 45

A captura usa a API assíncrona `clipboard.read()` e `ClipboardItem.getType()`. No Windows PowerShell: `npm.cmd test` e `npm.cmd start`.
