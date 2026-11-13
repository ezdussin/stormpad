# Stormpad

Notas, lembranças, imagens e bancos de dados num app web offline-first que usa **o seu próprio repositório do GitHub** como armazenamento. Não tem servidor nem conta extra: tudo fica no navegador e é sincronizado como arquivos simples (`.md` e `.json`) num repositório privado seu.

## Funcionalidades

- **Notas**: editor Markdown formatado (WYSIWYG), com modo código (`Ctrl+/`), frontmatter, tags, busca, renomear, duplicar e menu de botão direito.
- **Lembranças**: quadro kanban com um campo de entrada estilo chat. As listas funcionam como etiquetas, e os blocos podem ser arrastados entre elas, editados e fixados no topo.
- **Galeria**: imagens com várias categorias e filtro por categoria. As imagens são redimensionadas (no máximo 2560px) e comprimidas em WebP antes do envio. Em outros aparelhos, cada imagem só é baixada quando aparece na tela.
- **Bancos de dados**: tabelas no estilo Notion, com campos de título, texto, número, seleção, multisseleção, data, checkbox e URL. Têm filtros, ordenação por várias colunas, busca em todas as colunas e importação de CSV, TSV ou JSON.
- **Sync com o GitHub**: as alterações pendentes vão num único commit por sincronização. A sincronização roda ao abrir o app, a cada 5 minutos, quando a conexão volta e sob demanda. Conflitos entre aparelhos são detectados e não sobrescrevem dados em silêncio.
- **Offline-first**: tudo é salvo primeiro no IndexedDB do navegador e continua funcionando sem internet.

## Como os dados ficam no repositório

```
notes/inbox/minha-nota.md                    # uma nota: frontmatter + Markdown
memories/2026/11/<data>-<id>.md              # uma lembrança: frontmatter (lista, fixado…) + texto
memories/board.json                          # listas do quadro de lembranças
gallery/2026/11/<data>-<id>.webp             # imagem
gallery/2026/11/<data>-<id>.json             # metadados da imagem (categorias, dimensões…)
databases/<nome>-<id>/schema.json            # campos, opções, filtros e ordenação do banco
databases/<nome>-<id>/rows/<id>.json         # uma linha do banco
```

Como são arquivos comuns, dá para ler, editar e versionar tudo direto pelo GitHub ou por qualquer editor.

## Configuração

### 1. Token do GitHub

Crie um token *fine-grained* em [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new):

- **Opção mais segura:** crie antes, à mão, um repositório **privado** (por padrão `stormpad-storage`). No token, escolha **Repository access → Only select repositories**, selecione esse repositório e dê a permissão **Contents: Read and write**.
- **Para o app criar o repositório sozinho:** escolha **All repositories** e dê **Contents: Read and write** e **Administration: Read and write**. Esse token tem acesso a todos os seus repositórios, então prefira a opção anterior.

### 2. Conectar

Abra o app e cole o token. Por padrão, o repositório usado é `stormpad-storage`, na branch `main`, e o dono é o usuário do token. Para mudar dono, repositório ou branch, use **Customizações avançadas**. Se a branch não existir, ela é criada no primeiro sync.

O token e as configurações ficam salvos apenas no navegador (IndexedDB).

## Desenvolvimento

Requer Node.js 20.19+ ou 22.12+.

```bash
npm install
npm run dev       # servidor de desenvolvimento em http://localhost:5173
npm run build     # typecheck + build de produção em dist/
npm run preview   # serve o build localmente
npm run lint      # oxlint
```

### Stack

React 19, TypeScript, Vite, Tailwind CSS 4, Dexie (IndexedDB), TipTap (editor Markdown), Octokit (API do GitHub) e lucide-react (ícones).

### Estrutura do código

```
src/
  components/          # telas e componentes (notas, modais, menu de contexto…)
    memories/          # quadro kanban de lembranças
    gallery/           # galeria de imagens
    database/          # bancos de dados (tabela, filtros, importação…)
  db/                  # tabelas do IndexedDB e operações de cada modalidade
  lib/                 # utilitários: frontmatter, CSV, imagens, consultas…
  sync/                # sincronização com o GitHub
```

## Limitações conhecidas

- No iPhone e no iPad, o menu de botão direito não abre, e arrastar blocos no kanban não funciona com toque.
- Num conflito em linhas de banco de dados, em metadados da galeria ou nas listas do quadro, vale a última versão enviada. Notas e lembranças em conflito geram uma cópia `.conflict-*` para você juntar à mão.
- Imagens são enviadas uma por commit. Os arquivos de texto vão juntos num commit só.

## Licença

[MIT](LICENSE) © Enzo Dussin
