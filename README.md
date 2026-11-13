# ClipVault — Build 0.7.1 (Pan RMB / Select LMB)

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
| Ativar seleção retangular | Botão **Select** ou `S`, depois arraste com botão esquerdo |
| Voltar ao modo Pan | Botão **Pan** ou `S` |
| Criar frame nomeado | Selecione imagens e pressione `F`; digite nome e pressione Enter |
| Mover canvas | No modo Pan, arraste com o botão direito |
| Retornar ao topo | Home |
| Enviar imagem à lixeira | Selecione a imagem e pressione Delete |
| Enviar um dia à lixeira | Botão **Apagar dia**, confirmação obrigatória |
| Pausar/retomar captura | Ctrl+Alt+P ou menu na bandeja |
| Encerrar | Menu da bandeja > Sair |

Fechar a janela não encerra a captura; o app continua na bandeja do Windows. A cópia para outros apps funciona mesmo quando a captura está pausada.

## Testes

**npm.cmd test** valida sintaxe, políticas de segurança, o contrato de leitura e escrita do clipboard com mocks, os caminhos de arquivos e a geração do ícone PNG/ICO. Esse comando não abre o Electron nem acessa seu banco de imagens.

**Atenção:** um teste de uso real do executável, da bandeja e da colagem em outros aplicativos precisa ser realizado no Windows. Ainda não há limpeza automática ou início com Windows.

A Build 0.1.1 foi aprovada como baseline anterior; a 0.2.0 adiciona somente cópia de imagens e build portátil.

## Nomes de arquivos (Build 0.2.1)

As novas capturas recebem nomes como `13_11_2026_15h30m_01.png`, `13_11_2026_15h30m_02.png`. O último número é sequencial **por minuto**, sem sobrescrever capturas anteriores, mesmo após reiniciar. A organização das pastas por dia (`AAAA-MM-DD`) e os arquivos antigos **não mudam**, preservando as referências em `layout.json`.

## Build 0.3.0 — Canvas com miniaturas e carregamento sob demanda

- O **canvas cria elementos de imagem apenas próximos da área visível**. Ao arrastar ou ampliar, as imagens que saem da tela deixam de ocupar o renderer.
- Miniaturas de até **512 px** são geradas **sob demanda**, usando o mecanismo assíncrono do Electron no Windows. Em zoom alto, o canvas usa a imagem original para evitar pixelização.
- As miniaturas ficam em **%USERPROFILE%\\ClipVaultData\\.thumbnails\\**. A pasta é cache local, **não é backup nem contém originais**. Pode ser apagada com o aplicativo fechado para liberar espaço: ela será recriada conforme necessário.
- Os PNGs originais e **layout.json** continuam nas mesmas pastas; não há migração nem renomeação.
- Ao apagar uma imagem ou dia pelo ClipVault, a miniatura correspondente também é excluída.
- O carregamento inicial de metadados usa leitura assíncrona em lotes, evitando bloquear a interface por milhares de leituras síncronas.

### Teste sugerido com bastante conteúdo

Execute `npm.cmd test` e `npm.cmd run build:win`, copie o novo `dist\\ClipVault.exe` para o Desktop e confira:
1. Imagens antigas e posições preservadas.
2. Zoom e pan fluidos entre vários dias.
3. Clique para copiar e Ctrl+V em outro app.
4. Envio de imagem e dia à lixeira local, removendo a miniatura e permitindo restaurar o PNG.
5. O cache `.thumbnails` é criado localmente apenas para imagens visitadas.

**Nota:** os testes automatizados cobrem lógica de viewport e cache, incluindo cenário geométrico com 10.000 imagens; não medem FPS real ou memória no seu Windows. A versão 0.2.1 permanece como baseline anterior para comparação.


## Build 0.4.0 — Navegação por Datas

- Um botão **▦ Dias** no canto superior esquerdo abre um painel recolhível, sem modificar os controles do canvas.
- Cada data aparece em ordem decrescente, com a quantidade de capturas daquele dia. Clicar numa data posiciona o canvas no cabeçalho do frame correspondente.
- **Pesquisar por data** aceita `13/11/2026`, `13_11_2026`, `2026-11`, `13/11`, `novembro`, `nov` e outras variações.
- **Ctrl+F** abre e foca a pesquisa; **Enter** leva ao primeiro dia encontrado; **Esc** fecha o painel.
- O botão **Voltar ao dia mais recente** leva para a data mais nova, independente de filtros anteriores.
- As contagens são atualizadas após capturas novas e exclusões. Não há arquivos de índice extras, conexão de rede nem mudanças na organização dos PNGs ou em `layout.json`.
- Busca e navegação não enviam imagens para nenhum serviço; toda a informação vem dos metadados já carregados localmente.

### Validação

`npm.cmd test` inclui testes de formatação, filtros e uma simulação de UI com vários dias. O empacotamento Windows continua em `npm.cmd run build:win` e o executável portátil em `dist\ClipVault.exe`.

A virtualização e a geração local de miniaturas da versão 0.3 são mantidas. Teste prático com arquivos reais no Windows ainda é necessário antes de marcar esta build como baseline estável.

## Build 0.5.0 — Seleção Múltipla

- Clique normal **continua copiando** uma imagem para o clipboard, sem mostrar uma nova barra de ferramentas.
- **Ctrl+Clique** alterna imagens na seleção; **Shift+Clique** adiciona um intervalo a partir da última imagem-âncora, inclusive entre dias.
- Quando o modo de seleção é usado, aparece uma barra discreta com a quantidade de imagens e os botões **Exportar**, **Apagar** e **Limpar seleção**.
- Arrastar uma imagem já selecionada move todas as selecionadas juntas, preservando o dia e o espaçamento relativo. O movimento não copia nada para o clipboard.
- **Exportar** abre uma caixa para escolher a pasta e copia os PNGs originais, sem removê-los do Vault nem sobrescrever arquivos preexistentes. Em colisões usa `__02`, `__03` etc. Não é permitido exportar para dentro de `ClipVaultData`.
- **Apagar** e a tecla **Delete** exigem uma segunda confirmação quando há duas ou mais imagens selecionadas. Na 0.5 original essa ação removia os PNGs. Na 0.6 eles são movidos para a lixeira local, com recuperação disponível.
- **Esc** limpa a seleção; o painel de datas mantém prioridade sobre Esc quando estiver aberto.
- **Ctrl+C** continua copiando uma única imagem selecionada. Não tenta colocar múltiplos PNGs no clipboard.
- Há limite de 2.000 imagens por operação em lote; o conteúdo continua **100% local**. Nem o Git, nem o aplicativo enviam capturas para a rede.
- A função de seleção convive com a virtualização de miniaturas da Build 0.3: imagens fora da tela permanecem selecionadas.

### Validação

`npm.cmd test` agora verifica intervalos, deslocamento agrupado, compatibilidade do painel de datas, exportação sem sobrescrever, confirmação de exclusão e o fluxo de clique para copiar. O build Windows permanece `npm.cmd run build:win`. Teste real no Windows é necessário antes de aprovar a nova baseline.

## Build 0.6.0 — Espaço ocupado e lixeira recuperável

- O botão **▤ Espaço** abre um painel recolhível à direita, sem alterar o canvas nem o painel de datas.
- Exibe a quantidade e o peso das imagens originais por dia, além do espaço usado pelas miniaturas e pela lixeira local.
- Selecione um ou vários dias no painel para **mover suas imagens à lixeira**. A ação exige confirmação. As datas e quantidades no canvas são atualizadas depois.
- Excluir uma imagem (Delete), várias imagens (Build 0.5) ou um dia no próprio frame também **move os PNGs para a lixeira**, em vez de apagá-los definitivamente.
- A lixeira fica em `%USERPROFILE%\ClipVaultData\.trash\`. Cada item é salvo com metadados de data e posição. **Ela persiste após reiniciar o PC.**
- **Restaurar** devolve o PNG ao dia original e tenta preservar as posições do canvas. Se o arquivo de destino já existir, cria um novo nome com `_restored_01`, `_restored_02` etc., sem sobrescrever.
- **Esvaziar lixeira** elimina definitivamente os PNGs da lixeira, após confirmação dupla. Nenhuma exclusão automática por tempo é aplicada.
- As miniaturas em `.thumbnails` continuam sendo cache recriável. O painel as contabiliza separadamente; elas não são versões originais.
- Tanto as operações de limpeza quanto as de restauração são **100% locais**. Nenhum PNG, ícone ou executável entra no GitHub.
- O limite da seleção em lote permanece em **2.000 imagens por operação**. A limpeza por dia também respeita esse limite.

### Teste da 0.6 no Windows

1. Abra **▤ Espaço** e confira os totais por data.
2. Selecione um dia, confirme a limpeza e verifique sua presença na lixeira.
3. Use **Restaurar** e confira o PNG e sua posição anterior no canvas.
4. Teste Ctrl+Clique, Shift+Clique, arraste em grupo e Exportar da 0.5.
5. Teste **Esvaziar lixeira** apenas com imagens descartáveis: essa operação é definitiva.

`npm.cmd test` executa também cenários automatizados de armazenamento, movimentação para a lixeira, colisões de nomes e restauração. O Electron/Windows precisa de validação prática antes da aprovação da build 0.6.

## Build 0.6.1 — Correção urgente do canvas / captura aparentemente parada

**Causa identificada:** desde a 0.5, `renderer/index.html` incluía o script `multi-select.js`, porém o servidor local `vault://app` em `main.js` não autorizava seu carregamento. O JavaScript do renderer falhava ao inicializar e, por isso, o canvas não registrava os eventos visuais de novas capturas. O monitor do clipboard do processo principal não sofreu alterações.

- O hotfix inclui `multi-select.js` na allowlist explícita do protocolo local, sem abrir permissão para outros arquivos.
- Novo teste `tests/asset-allowlist.test.js` verifica que todo `<script>` e stylesheet presente no `index.html` está na allowlist e existe no disco. Evita repetir essa regressão.
- Os recursos da 0.5 e da 0.6 permanecem; nenhuma captura antiga é apagada ou migrada.
- **Se as imagens foram capturadas durante a falha:** elas podem já estar em `ClipVaultData\AAAA-MM-DD` e voltarão a aparecer na abertura após o hotfix.
- Encerre completamente via bandeja **Sair** antes de substituir/reabrir o executável. Recompile com `git pull`, `npm.cmd test`, `npm.cmd run build:win` e execute `dist\ClipVault.exe`.

Teste real no Windows ainda é necessário antes de aprovar esta hotfix como baseline.

## Build 0.7.0 — Pan/Select e frames com nome

- Na barra superior aparecem os modos **Pan** e **Select**. O aplicativo inicia em **Pan**, preservando o clique esquerdo em imagens para copiar ou arrastar.
- **Botão direito arrastado (em qualquer modo):** move o canvas. No modo normal, o botão esquerdo no fundo apenas limpa a seleção; em Select, desenha o retângulo.
- **Botão esquerdo arrastado em Select:** desenha um retângulo de seleção. Imagens tocadas pelo retângulo são selecionadas, inclusive se estiverem virtualizadas/fora do DOM. `Ctrl` ou `Shift` com o botão esquerdo adiciona à seleção existente.
- **S** alterna Pan e Select. Ctrl+Clique e Shift+Clique sobre imagens continuam funcionando.
- **F**, com uma ou várias imagens selecionadas, cria um **frame visual nomeável** ao redor dessas imagens. O nome é editado imediatamente: digite e pressione Enter. Clique no nome para renomear depois.
- O `×` no cabeçalho remove somente o frame visual — não exclui nenhum PNG.
- O frame acompanha a posição das imagens; pode conter referências de datas diferentes, sem alterar a organização por dia nem o clipboard.
- Os frames ficam em `%USERPROFILE%\ClipVaultData\frames.json`. `layout.json` e os PNGs originais não são alterados por criar ou renomear frames.
- **Importante:** Pan é sempre RMB, em qualquer modo. A seleção por retângulo usa LMB quando a ferramenta Select está ativa.
- O protocolo `vault://app` não ganhou nenhum script novo. O teste de autorização de scripts da 0.6.1 permanece, para evitar a regressão de captura.

### Verificações

Os testes automatizados incluem simulação de Pan RMB, seleção por retângulo LMB, criação/renomeação/remoção de frame, persistência de `frames.json`, captura-cópia tradicional e regressões de datas, lixeira e seleção múltipla.

Teste a 0.7 no seu Windows antes de marcá-la como baseline. Encerre o executável pela bandeja, faça `git pull`, `npm.cmd test`, `npm.cmd run build:win` e abra `dist\ClipVault.exe`.

## Hotfix 0.7.1 — Mapeamento de botões corrigido

- **RMB (botão direito) faz Pan SEMPRE**, tanto no modo normal quanto em Select.
- **LMB (botão esquerdo) desenha seleção retangular em Select**, inclusive iniciando o gesto sobre uma imagem.
- No modo normal/Pan, LMB sobre imagens continua copiando com clique ou movendo com arraste.
- Em Select, LMB sem arraste sobre uma imagem a seleciona sem copiar. Ctrl/Shift com LMB continuam adicionando à seleção.
- **S** alterna o comportamento do botão esquerdo entre edição normal e Select; não altera RMB.
- **F** cria frame nomeável da seleção, como na 0.7.0.
- Nenhuma alteração na captura, armazenamento, lixeira, formatos PNG ou protocolo de assets.
- O teste de integração cobre RMB Pan no modo Select, seleção LMB iniciando sobre imagem, ausência de cópia acidental e preservação do frame.
