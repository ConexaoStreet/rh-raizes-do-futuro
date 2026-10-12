# Evolução do Raízes do Futuro - 9 de outubro de 2026

A atualização mantém a arquitetura React/Vite/Supabase, os módulos existentes, o logo oficial e a separação entre RH e T.I.

## Experiência

Login editorial, paleta floresta/lima, saudação pelo nome e data do servidor, contexto da página e busca por Ctrl+K. Menu mobile informa seu estado e restaura a rolagem ao fechar ou navegar. A busca diferencia erro de conexão de resultado vazio e oferece nova tentativa.

Boletim mobile com seletor de período, cartões de competências, nota zero distinta de ausência, pesos registrados na avaliação e contribuição na média. A tabela comparativa permanece no desktop. O histórico se adapta ao celular. A troca de aluno não apresenta as notas anteriores durante carregamento.

Notificações filtradas por usuário, escopo RH e estado de leitura, com Realtime, atualização ao retornar à janela e fallback periódico. O centro e o contador verificam a identidade do resultado antes de exibi-lo, inclusive na troca direta de sessão.

## Banco

Migration `20261009165950_notification_realtime` aplicada no projeto `fiuealmgufpmtgmxxpna`. Adiciona índice parcial de notificações RH não lidas e a tabela à publicação Realtime existente. Verificação remota: índice válido, uma entrada na publicação, RLS habilitado e política de leitura preservada. Não altera cadastros, notas, autenticação ou permissões.

O advisor de segurança mantém o aviso preexistente sobre proteção contra senhas vazadas desabilitada. O histórico de delivery contém falhas antigas de e-mail; a conexão Resend não tem domínio verificado. Nenhum e-mail antigo foi reenviado.

## Verificação

| Checagem | Resultado |
| --- | --- |
| Lint e verificação de privacidade | Aprovados |
| Vitest | 73 testes em 22 arquivos |
| PostgreSQL 17/PGlite | 40 verificações, incluindo RLS de notificações e migration idempotente |
| Playwright/Chromium | 24 testes, incluindo troca de usuário/aluno, menu e tablets |
| Build | TypeScript e Vite aprovados, sem sourcemaps |
| JavaScript inicial gzip | 162,38 KiB incluindo modulepreloads, limite 200 KiB |
| CSS inicial gzip | 15,92 KiB, limite 16 KiB |
| npm audit | Zero vulnerabilidades |

Revisão independente identificou conflitos de áreas da grade do login em tablets e contador anterior durante troca de usuário. Ambos foram corrigidos com testes de regressão. CSS de boletim, suporte e notificações é carregado junto dos módulos correspondentes; bibliotecas de gráficos e exportação continuam sob demanda. O orçamento inclui os módulos carregados antecipadamente.

## Referências

- Figma editável: https://www.figma.com/design/NdxfxEM6xcjzg6veJ8MzuX
- Pull request: https://github.com/ConexaoStreet/rh-raizes-do-futuro/pull/90
- Release: `raizes-evolution-2026-10-09`
- Publicação: aguardando a conferência final de CI e deploy.
