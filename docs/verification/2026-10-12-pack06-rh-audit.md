# Pacote 06: continuação da auditoria do RH

## Escopo e critério de aprovação

Site: https://rh-raizes-do-futuro.vercel.app/

O usuário autorizou contas próprias de auditoria, testes completos, correções e publicação em pacotes. Depois solicitou a revisão da T.I. imediatamente após esta rodada. Não existe Datasul externo: o sistema publicado é o Datasul.

Esta rodada não declara o site 100% aprovado. Os testes abaixo separam o serviço publicado, a interface local com respostas preparadas e os fluxos ainda bloqueados. Nenhum usuário, aluno, presença, nota, documento ou mensagem normal foi usado como registro de teste.

## Testes dos serviços publicados

Três contas próprias concluíram confirmação real de endereço, entrada normal por senha e ativação pelo pré-cadastro: Colaborador A, Colaborador B e Gestor. As caixas privadas usam o provedor temporário disponibilizado na auditoria anterior. Senhas, tokens e links de confirmação ficam fora do repositório e dos relatórios.

O Colaborador B recebeu a mensagem real de confirmação, consumiu o link do projeto, entrou por senha e recebeu somente COLLABORATOR, com a turma e área B autorizadas. As contas A e Gestor foram reativadas pelo fluxo normal com novas sessões.

O runner de uso concluiu 31 verificações reais de API:

- Senha incorreta recusada.
- Áreas A e B isoladas para colaboradores; consulta direta da outra área recusada.
- Gestor acompanhou ambas as áreas.
- Tarefa criada, editada, relida e concluída; edição com versão antiga, outro setor e responsável de setor diferente foram recusados.
- Salas do chat isoladas; mensagem recebida pelo gestor; repetição com o mesmo identificador não duplicou o envio.
- Arquivo executável recusado; linguagem inadequada substituída pelo filtro.
- Planilha XLSX verdadeira enviada no chat, baixada pelo gestor, conferida byte a byte e aberta com ExcelJS. Outro setor não obteve endereço de download nem enviou à sala alheia.
- Denúncia registrada e mensagem de auditoria moderada. O primeiro runner interpretou a fila como lista direta; foi corrigido para `reports[].message.id` e o mesmo fluxo foi repetido com sucesso. Não foi uma falha do site.
- Feedback privado não apareceu para o titular. Depois de liberado, somente o destinatário leu, marcou como lido e respondeu. Outro aluno não viu nem respondeu.
- Notificação interna recebida e marcada como lida.
- PDF verdadeiro enviado, registrado e baixado pelo gestor com o mesmo conteúdo. Outra conta não obteve download.
- Período de notas criado somente para auditoria; nota zero preservada e boletim liberado para o titular. Outra conta não viu a avaliação; edição antiga foi recusada.
- Evento exclusivo da turma de auditoria criado, lido e cancelado.
- Relatório filtrado pela turma de auditoria incluiu feedback e notas; exportação XLSX armazenada, registrada e baixada com o mesmo conteúdo.
- Sessões próprias consultadas; sessões alheias e endpoints administrativos recusados ao colaborador.

Também foi criado um chamado de suporte próprio, com PDF: criação e releitura, download idêntico e isolamento de outra conta passaram. O link do WhatsApp não foi aberto nem enviado. A consulta pela conta de auditoria com papel TI_ADMIN encontrou o chamado e baixou o mesmo arquivo.

O calendário da turma de auditoria foi conferido no horário real do servidor, antes das 08h em São Paulo. Sem curso, abrir chamada foi recusado com INVALID_COURSE_DAY. Uma data excepcional foi criada somente para a turma de auditoria; o curso passou a ser reconhecido, mas abrir chamada continuou recusado com OUTSIDE_WINDOW. A data voltou a ficar sem curso. Registro e finalização de chamada em produção não foram aprovados fora da janela. O relógio e as regras globais não foram alterados.

## Cargos e limite da comprovação

O SMTP de autenticação recusou a conclusão dos quatro cadastros seguintes com `over_email_send_rate_limit`. Não foram criadas confirmações artificiais.

Para continuar verificando permissões sem depender desses envios, somente a conta confirmada Colaborador B recebeu temporariamente, um de cada vez, os papéis INSTRUCTOR, DIRECTOR, TI_ADMIN e SUPER_ADMIN por ação administrativa autorizada. Cada verificação entrou com a senha real da conta e chamou os serviços publicados. Isso não comprova cadastros separados nem uso completo desses cargos no navegador.

| Papel aplicado à conta própria | Resultado real |
| --- | --- |
| INSTRUCTOR | Visão dos setores, permissão da área do instrutor e lançamento de nota zero na turma própria; sem gestão de usuários, segurança administrativa ou T.I. |
| DIRECTOR | Visão das duas áreas e relatório da turma de auditoria; sem gestão de T.I. |
| TI_ADMIN | Chamado de auditoria e seu PDF acessíveis; permissões de T.I. e visão dos setores presentes |
| SUPER_ADMIN | Diagnóstico do sistema acessível, zero tabelas sem RLS; alteração sensível recusada por exigir verificação recente real |

O cargo original COLLABORATOR foi restaurado na conta B. Não foram alterados cargos de pessoas existentes. As contas e sessões próprias serão encerradas ao final das conferências publicadas.

## Diagnóstico de e-mail comprovado

O registro da chamada real do projeto ao Resend retornou HTTP 403 e informou a restrição do remetente de testes a destinatários da própria conta. Não existe domínio de envio verificado nessa conexão, e a conexão Vercel não apresentou domínio próprio. A chave alcançou o provedor: não se trata de simples ausência de chave.

Uma solicitação normal de acesso por e-mail no Supabase retornou 200 e sua mensagem chegou à caixa privada. O modelo hospedado atual contém link de acesso, não o token numérico necessário para substituir o código da segunda etapa. A primeira extração do runner confundiu uma cor do HTML com seis dígitos; o valor foi recusado, a extração foi descartada e nenhuma validação de MFA foi declarada. O recebimento de um link não comprova entrega de MFA.

A configuração `registration_access_window` já estava habilitada. Em produção, ela dispensa MFA inicial e faz bootstrap apresentar `mfa_verified=true` sem verificação física da sessão. A janela não foi ligada nem desligada nesta rodada. Alterações sensíveis continuam exigindo `verified_at` real; o teste SUPER_ADMIN confirmou a recusa sem essa verificação.

O workflow de modelos continua sem SUPABASE_ACCESS_TOKEN. A tentativa autorizada de abrir a configuração hospedada encontrou uma tela de login. Nenhuma credencial foi solicitada novamente ao usuário, inserida por automação ou extraída das conexões. A alteração do modelo hospedado e um remetente transacional apto a todos os destinatários continuam pendentes.

## Correções do pacote

1. A tela de verificação exige `ok === true`. Recusa dentro de HTTP 200 e resposta de envio sem endereço mascarado válido não anunciam envio nem concluem a conferência.
2. Falha de configuração de envio, limite temporário e falha de entrega têm códigos separados no servidor e explicações simples no RH.
3. Erros normais de cadastro reconhecem o código de limite de e-mail. RATE_LIMITED deixa de usar a explicação destinada ao limite das conversas.
4. Os registros do serviço de envio guardam resultado, status e tempo; não registram endereço, código, token, remetente, corpo nem mensagem privada devolvida pelo provedor.

JWT da função, confirmação do endereço, entrada por senha, HMAC, sessão correspondente, autorização por cargo, expiração, uso único e limites do banco foram preservados. A função remota anterior, versão 7, foi lida antes da publicação e também contém as proteções de senha, identidade e HMAC.

## Testes locais e revisão

- RED: três testes de mensagens reproduziram limite genérico, configuração sem explicação e confusão entre os limites do código e do chat.
- RED: três testes de interface reproduziram resposta recusada aceita como sucesso e mensagem genérica de configuração.
- RED: quatro testes do classificador falharam antes de ele existir.
- GREEN: todos esses casos passaram depois das correções.
- `npm run verify`: lint, privacidade, 116 testes em 29 arquivos, 121 verificações de banco, compilação e orçamento passaram. Depois da revisão, a suíte completa foi repetida com 118 testes, incluindo dois casos de configuração apontados pelo revisor.
- `npx playwright test --workers=4`: 107 testes passaram. São testes locais com respostas preparadas, incluindo fluxos de ambos os sites, arquivos PDF/XLSX/PPTX e tamanhos de tela. Não substituem o uso autenticado da interface publicada.
- Deno check da função email-2fa passou com as dependências instaladas e sem alterar as versões do projeto.
- RH: JS inicial 163,71 KiB gzip, limite 200; CSS 14,80 KiB, limite 16.

A revisão independente apontou que a descrição de domínio não verificado e a chave inativa também precisavam ser classificadas como configuração. Os dois novos testes falharam antes do ajuste; a regex e o tratamento de restricted_api_key foram corrigidos. Referência primária: https://resend.com/docs/api-reference/errors

## Avisos da revisão do banco

A tabela privada de monitoramento de publicações tem RLS e nenhum acesso direto autorizado, por desenho. O aviso é informativo; não foi aberta uma política permissiva para eliminá-lo. Os índices ainda sem uso não foram removidos sem evidência de impacto.

A proteção contra senhas já vazadas está desabilitada na configuração hospedada; sua alteração depende do acesso de configuração disponível e das condições do plano. Referência: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

O consultor também apontou duas políticas permissivas sobrepostas, sem falha de isolamento reproduzida nesta rodada. Referência: https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies

## Próxima etapa autorizada

Publicar e repetir o diagnóstico no RH, conferir a atualização automática e enviar o resultado por Gmail HTML. Em seguida, continuar diretamente a revisão completa da T.I. A entrega real de códigos, os quatro cadastros separados, a recuperação de senha e o uso autenticado de toda a interface publicada permanecem sem aprovação completa.
