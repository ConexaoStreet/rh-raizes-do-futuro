# Verificação do pacote 2

Implementados espaços de setor, visão geral de gestores e instrutor, tarefas versionadas, chat geral e por setor, anexos privados de até 10 MiB e três por mensagem, filtro no servidor, denúncias e moderação. Novas publicações geram um manifesto de versão por commit e podem ser registradas automaticamente pelo monitor privado.

Verificação local completa: 84 testes unitários; 46 testes do banco de negócio; 6 de manutenção pública; 17 de setores e chat; 7 do manifesto; 10 do monitor; 32 testes de navegador. Lint, TypeScript, privacidade, build e orçamento aprovados. JavaScript inicial gzip 163,36 KiB, CSS 15,92 KiB. Auditoria npm de produção sem vulnerabilidades.

Testados acessos negativos, conta pendente e suspensa, tarefas, edição concorrente, censura, flood, retry idempotente, salas, anexos, denúncias, notas publicadas, feedback, justificativas, importações, relatórios e avaliação anônima da gestão. Navegador verificou larguras de 320 a 1440 px, envio de planilha, moderação e preservação do rascunho quando surge uma versão nova.

Revisão independente encontrou e confirmou correções para limpeza de arquivos vencidos, locks de upload e descarte, e reabertura de denúncia. Concorrência foi revisada pela semântica dos locks; os testes PGlite são sequenciais.

## Publicação pendente

O pacote 1 está publicado com manutenção e acompanhamento. A aplicação do banco do pacote 2 retornou `Invalid or expired requestState` em duas tentativas pela conexão Supabase. As tabelas novas não existem em produção. Não se deve publicar o frontend nem desligar manutenção até aplicar as duas migrations, conferir o CI e confirmar o deployment.

As funções Edge existentes não foram executadas com credenciais reais. Deno check está no CI. Não foram criados usuários, mensagens ou arquivos fictícios em produção. Os espaços por setor são internos ao RH; integração real com TOTVS Datasul depende da configuração do serviço externo. O visual reutiliza a identidade aprovada no Figma existente.
