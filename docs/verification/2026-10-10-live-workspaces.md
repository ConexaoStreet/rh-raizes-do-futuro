# Verificação do pacote 2

Implementados espaços de setor, visão geral de gestores e instrutor, tarefas versionadas, chat geral e por setor, anexos privados de até 10 MiB e três por mensagem, filtro no servidor, denúncias e moderação. Novas publicações geram um manifesto de versão por commit e podem ser registradas automaticamente pelo monitor privado.

Verificação local completa: 84 testes unitários; 46 testes do banco de negócio; 6 de manutenção pública; 17 de setores e chat; 7 do manifesto; 10 do monitor; 32 testes de navegador. Lint, TypeScript, privacidade, build e orçamento aprovados. JavaScript inicial gzip 163,36 KiB, CSS 15,92 KiB. Auditoria npm de produção sem vulnerabilidades.

Testados acessos negativos, conta pendente e suspensa, tarefas, edição concorrente, censura, flood, retry idempotente, salas, anexos, denúncias, notas publicadas, feedback, justificativas, importações, relatórios e avaliação anônima da gestão. Navegador verificou larguras de 320 a 1440 px, envio de planilha, moderação e preservação do rascunho quando surge uma versão nova.

Revisão independente encontrou e confirmou correções para limpeza de arquivos vencidos, locks de upload e descarte, e reabertura de denúncia. Concorrência foi revisada pela semântica dos locks; os testes PGlite são sequenciais.

## Banco aplicado e publicação em validação

O pacote 1 está publicado com manutenção e acompanhamento. A nova tentativa resolveu a falha `Invalid or expired requestState` aplicando a estrutura em partes menores. As quatro migrations estão registradas em produção: 20261010054143, 20261010054325, 20261010054339 e 20261010054432. Foram confirmados seis canais, bucket privado, cron ativo, RLS e ausência de privilégios de chat para anon. A manutenção permanece até confirmar a publicação do frontend.

As funções Edge existentes não foram executadas com credenciais reais. Deno check passou no CI do PR 93. Não foram criados usuários, mensagens ou arquivos fictícios em produção. Os espaços por setor são internos ao RH; integração real com TOTVS Datasul depende da configuração do serviço externo. O visual reutiliza a identidade aprovada no Figma existente.

O monitor privado usa RLS sem policy e não permite clientes, por intenção. Índices novos ainda sem uso não foram removidos antes de receber tráfego. O advisor mantém o aviso existente de [proteção contra senhas vazadas desativada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), dependente da configuração do plano; nenhum serviço pago foi habilitado.
