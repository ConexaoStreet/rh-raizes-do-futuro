# Revisão completa do pacote 04

O Datasul é o próprio sistema Raízes do Futuro. A Central de TI passou a mostrar pessoas por setor, turmas e chamadas dos cadastros internos, com filtro por área, recuperação de falhas e permissões separadas para consultar e editar pessoas. A falta de permissão para consultar é explicada, sem apresentar uma lista vazia como um carregamento bem-sucedido. As áreas de setor, gestores e instrutor permanecem organizadas nas telas do RH.

## Correções conferidas

- A troca entre Turma e Equipe de RH reinicia a paginação.
- Calendário, documentos e feedbacks distinguem falha de carregamento de uma lista vazia e oferecem nova tentativa.
- A importação do calendário limpa a prévia anterior e recusa datas impossíveis, motivos ausentes e motivos em branco.
- O PowerPoint gerado usa o MIME de apresentação também no Blob enviado ao armazenamento.
- Cancelar manutenção, revogação ou exclusão na TI não anuncia sucesso.
- O cabeçalho da TI se adapta a 320 px; chamados resolvidos são descritos como “Resolvido” no histórico.
- Configurações da TI são gravadas por RPC com permissão administrativa e verificação recente, sem conceder UPDATE direto na tabela. O aviso de manutenção usa um único destino e rejeita valores inválidos.
- A TI renova a verificação recente na própria tela. Erro de envio, código inválido, resposta sem confirmação e cancelamento mantêm o rascunho sem gravar. A confirmação válida retoma o payload original uma única vez; a edição de pessoas captura os campos antes de encerrar o evento do formulário.
- Chamados e arquivos de suporte exigem conta ativa e sessão válida. Contas pendentes, suspensas ou revogadas não usam uma sessão antiga para continuar acessando-os.
- A limpeza após falha de registro só remove anexos do remetente ainda sem registro. Anexos do RH registrados ou arquivados e evidências já vinculadas a chamados são preservados.

## Evidências

| Verificação | Resultado |
| --- | --- |
| Vitest | 94 testes aprovados em 26 arquivos |
| Banco, setores, suporte e versões | 111 verificações aprovadas: 46 negócio, 25 TI/suporte, 6 manutenção pública, 17 setores/chat, 7 manifesto e 10 monitor |
| Playwright/Chromium | 100 testes aprovados com 2 workers e sem retries |
| Pessoas e suporte RH | 11 cenários com payload, persistência, falha e retry |
| Presença, calendário e relatórios | 25 cenários; downloads reais PDF/XLSX/PPTX, estrutura, conteúdo, bytes enviados e apresentação com 15 slides |
| Painéis TI | 27 cenários; 12 painéis em 320, 390, 768 e 1440 px; renovação em 320 px |
| Lint, privacidade e configuração Auth/observabilidade | Aprovados |
| Auditoria de dependências npm | Nenhuma vulnerabilidade encontrada |
| RH, JavaScript/CSS iniciais gzip | 163,42 / 14,80 KiB; limites 200 / 16 KiB |
| TI, JavaScript/CSS gzip | 137,88 / 11,98 KiB; limites 150 / 12 KiB |

Os 37 cenários anteriores permanecem no conjunto de 100. Incluem boletim, notas zero, notificações, busca, navegação, temas, setores, tarefas, instrutor, chat com planilha, moderação e preservação de rascunhos. Os novos testes dos módulos RH e TI usam respostas isoladas e mutáveis com rejeição de chamadas inesperadas. PostgreSQL/PGlite executa as migrations e políticas reais; Auth, transporte de Storage, webhooks e serviços externos têm fixtures específicas. A política real foi conferida com um cargo de consulta: sem employee.view apenas o cadastro próprio fica legível, e a permissão de consultar não concede edição. Também foi conferida uma sessão com MFA ainda válido e verificação recente expirada aos 16 minutos.

A revisão independente confirmou a correção dos dois pontos de permissão e renovação, a preservação do formulário e as proteções contra retomada após cancelamento ou verificação recusada. Não restaram bloqueadores críticos ou importantes nessa revisão.

## Banco aplicado

As migrations `reconcile_existing_ti_schema` e `complete_ti_access_and_attachment_cleanup` foram aplicadas no Supabase. A primeira registra no repositório funções, colunas e permissões já existentes em produção, para que instalações e testes reproduzam o site. A segunda acrescenta as proteções e a RPC descritas acima.

A leitura remota confirmou as cinco políticas novas, a RPC acessível a authenticated e negada a anon, ausência de UPDATE direto em settings e nenhuma tabela pública ou privada sem RLS. A manutenção geral permanece desativada. Nenhum cadastro, chamado, mensagem ou arquivo fictício foi criado em produção para os testes.

## Limites e pendência real

A conexão Resend retornou “No domains found.” Os projetos RH e TI têm somente seus endereços vercel.app. Os e-mails de progresso foram enviados pelo Gmail em HTML no corpo, sem anexo; essa entrega não configura o remetente do backend. Na auditoria real iniciada após este pacote, o envio e a confirmação de cadastro foram comprovados com uma caixa privada temporária e requisições reais ao serviço de autenticação. Portanto, a ausência de domínios nessa conexão não deve ser usada sozinha para afirmar que todos os e-mails do sistema estão indisponíveis. Códigos para cargos ativados e notificações de negócio ainda precisam ser conferidos no fluxo real; ver `2026-10-11-real-rh-audit.md`.

Os testes locais não comprovam login real com código, entrega push a um dispositivo, binários do Storage em produção ou operação de APIs externas com credenciais. GitHub e Vercel são conferidos pelas conexões e pelos deploys; os diagnósticos opcionais dentro da TI podem solicitar credenciais próprias. Não foram removidas proteções de autenticação para contornar essas dependências. O aviso preexistente de proteção contra senhas vazadas desativada continua documentado.

O Deno local foi limitado pela resolução de dependências no ambiente; a checagem de todas as funções Edge fica a cargo do CI com o runtime configurado no repositório. A publicação só segue após aprovação desse CI e conferência dos dois deploys.

O histórico público registra o pacote automaticamente a partir do manifesto de versão. O acompanhamento foi atualizado durante a revisão, sem provocar novos builds a cada mensagem.
