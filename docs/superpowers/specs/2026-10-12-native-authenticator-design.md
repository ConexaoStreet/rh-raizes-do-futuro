# Confirmação por aplicativo no RH e na T.I.

## Objetivo autorizado

O usuário pediu testes completos, correções e publicação dos dois sites, com permissão total e continuidade sem depender dele. A T.I. deve ser revisada imediatamente após o pacote 06 do RH. O bloqueio comprovado do remetente de e-mail impede confirmar ações protegidas para contas de teste fora do destinatário do remetente de testes.

A mudança acrescenta uma alternativa por aplicativo de códigos usando Supabase Auth, já disponível no projeto. O usuário continua entrando por senha e precisa ter endereço confirmado e perfil aprovado. As permissões dos cargos e os limites dos recursos permanecem controlados no servidor. Nenhum registro de MFA será marcado manualmente para viabilizar testes.

## Evidência e escolha

Um teste real na conta própria Colaborador B concluiu enroll e challengeAndVerify com TOTP. O serviço retornou aal2, métodos password e totp, o mesmo usuário e a mesma sessão de senha. Uma segunda verificação atualizou o timestamp assinado e auth.mfa_amr_claims.updated_at. O fator é verified e está ligado a auth.sessions.factor_id. Segredos e códigos foram gerados, consumidos e guardados somente no diretório privado da auditoria, sem aparecer no modelo ou repositório.

Usar o método nativo resolve a confirmação de ações sem um novo serviço pago. Configurar um remetente transacional continua necessário para e-mails de negócio e para maior capacidade de cadastro. Implementar TOTP por conta própria adicionaria armazenamento de segredos e validação redundante; o Supabase já executa essa parte.

## Confirmação no servidor

Uma nova RPC pública, confirm_authenticator_session(), aceita apenas a sessão autenticada atual, sem parâmetros de usuário ou sessão. A API valida a assinatura do JWT antes do SQL. A função exige: perfil active com onboarding e termos, endereço confirmado, sessão real válida e não revogada, JWT aal2 com password e totp, fator TOTP verified do mesmo usuário ligado à mesma sessão aal2 e prova de TOTP recente em auth.mfa_amr_claims.

O timestamp inteiro do método totp no JWT deve ser igual ao segundo de updated_at da prova nativa. A prova deve ter no máximo 15 minutos e não pode estar mais de 30 segundos à frente do relógio do banco. verified_at recebe o instante da prova do serviço, não o horário de uma repetição da RPC; verified_until é esse instante mais 8 horas. Repetir a mesma prova não renova o prazo nem rejuvenesce a confirmação.

O vínculo do fator será registrado em private.session_security. A confirmação nativa só continua válida enquanto o fator ainda existir, estiver verified e ligado àquela sessão aal2. Remover o fator faz a leitura da conta e a confirmação recente recusarem essa prova. Uma confirmação real por e-mail limpa o vínculo nativo e continua usando suas próprias regras existentes.

Contas ativas podem confirmar a própria identidade sem ganhar permissões novas. Um colaborador confirmado por aplicativo continua sem acesso administrativo. Perfil pendente, inativo, e-mail sem confirmação, sessão revogada, aal1, método sem senha, fator alheio, timestamp antigo e prova de outra sessão são recusados.

Os consumidores de MFA serão reconciliados com a definição remota atual: account_ready, bootstrap e recently_verified. A janela temporária registration_access_window e as exceções de manutenção serão preservadas durante a implantação. A janela só será encerrada depois que ambos os frontends estiverem publicados e a alternativa inicial de configuração e uso tiver passado pelos testes locais e por prova real nos serviços.

## Interface

As telas de verificação oferecem Enviar código e Usar aplicativo de códigos. A alternativa nova só consulta fatores quando escolhida. Sem fator verificado, a pessoa escolhe Configurar aplicativo, lê o QR e confirma o código de seis dígitos. Um fator já verificado apresenta diretamente a entrada do código. A chave pode ser mostrada por escolha explícita da pessoa; não será registrada em telemetria nem enviada ao histórico ou ao Gmail.

O QR é uma imagem SVG gerada pelo serviço, em data URL, codificada para uso em img; não será inserido como HTML. A interface não renderiza links externos devolvidos como QR. Mensagens de erro usam português simples e nunca reproduzem corpos privados do provedor.

Verificação, cancelamento e retorno para e-mail preservam o rascunho da ação na T.I. O usuário não consegue cancelar pelo diálogo enquanto uma confirmação está em andamento. Somente fatores recém-criados e ainda unverified podem ser descartados no cancelamento. Fatores já verificados nunca são removidos automaticamente. Uma operação concluída depois de desmontar a tela não retoma a ação anterior.

O evento MFA_CHALLENGE_VERIFIED não deve disparar um bootstrap intermediário antes da confirmação no banco. Após a RPC, o callback existente atualiza a conta e retoma a ação somente quando ready e recently_verified forem verdadeiros.

## Validação e implantação

TDD cobre a prova no banco, idempotência, expiração, revogação, remoção do fator, método de senha e ausência de aumento de permissões. Testes locais de interface cobrem configuração, fator existente, falha, cancelamento, resposta recusada e celular. Testes reais usam só as contas e registros de auditoria, com OTP do fator próprio validado pelo serviço nativo.

Aplicar a migration pelo conector Supabase depois dos testes e da revisão. Publicar as telas em um pacote com GitHub e Vercel. Conferir o commit exato nos dois aliases, a atualização automática, o comportamento com a janela encerrada e os registros humanos. Enviar os avanços em HTML no corpo do Gmail. Não declarar fluxo completo aprovado na interface publicada quando o navegador não conseguiu autenticar; API real e interface local ficam identificadas separadamente.

Fontes primárias: https://supabase.com/docs/guides/auth/auth-mfa/totp e código instalado de @supabase/auth-js 2.116.0. As colunas e os timestamps foram conferidos na instância real do projeto antes da definição do protocolo.
