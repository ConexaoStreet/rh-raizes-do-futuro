# Raízes: manutenção ao vivo, setores e conversas

## Objetivo

Revisar o RH inteiro e entregar espaços úteis para cada setor, uma visão geral para gestores e instrutor e conversas com anexos privados. O usuário autorizou implementar e publicar em pacotes e escolheu chat por setor e uma sala geral. A manutenção deve aparecer primeiro e ser acompanhada publicamente com texto claro e humano.

## Pacote 1: acompanhamento

O controle de manutenção existente bloqueia usuários comuns durante o trabalho e mantém o acesso técnico autorizado. Uma projeção pública contém apenas título, mensagem, horários e estado da manutenção. Um histórico separado contém textos curados de andamento e publicações, com numeração automática. Não inclui cadastros, logs técnicos, nomes de pessoas ou segredos.

O aviso grande aparece no login e no sistema, com Acompanhar ao vivo. A rota pública /ao-vivo mostra pacotes, estados reais, horário da última conferência, falhas de conexão e histórico. Realtime e uma consulta periódica quando a página está visível atualizam o andamento sem rebuilds. Mudanças do controle existente sincronizam a projeção pública no banco.

## Pacote 2: espaços e chat

Os setores atuais são Ecológico, Educação, Eventos, Marketing e Recursos Humanos. Cada espaço tem identidade, atalhos adequados, visão do trabalho e tarefas do setor. A associação vem de employees.department_id vinculado a auth.uid(), nunca de metadados editáveis pelo usuário. Quem não tem setor vê orientação para solicitar vínculo, sem cair em uma sala alheia.

Gestores, diretor e administrador veem todos os espaços do RH. Instrutor tem uma aba própria com resumo, turma, setores e acompanhamento, organizada com uma seção aberta por vez. A visão geral do RH não concede permissões de T.I., alteração de cargos ou acesso a segredos. As permissões de negócio do instrutor serão complementadas apenas onde o pedido exige visão geral.

O chat tem uma sala geral e uma por setor. Usuários comuns acessam sua sala e a geral; gestores e instrutor acessam todas. A autorização vale no banco e no Storage, inclusive ao tentar URLs de outra sala. Mensagens em texto simples, sem HTML, têm até 2000 caracteres, limitação de envio e filtro no servidor de palavrões e abuso explícito. Conteúdo filtrado aparece censurado; a versão original não fica disponível aos participantes. Há denúncia e ocultação por moderação autorizada. O filtro é uma proteção prática, sem promessa de detectar todo abuso ou malware.

Anexos ficam em bucket privado, com caminho vinculado à sala e ao autor, até 10 MiB por arquivo e até 3 arquivos por mensagem. São aceitos PDF, imagens JPEG/PNG/WebP, planilhas XLSX/CSV, DOCX e TXT. Executáveis, HTML, SVG, scripts, macros e arquivos compactados ficam bloqueados. Nome e tipo são validados no cliente e no servidor. Download usa link curto assinado após autorização. Upload incompleto pode ser removido pelo próprio autor; não há sobrescrita.

## Versões e publicação

O histórico separa andamento de versão publicada. Cada pacote só recebe estado publicado depois de deploy READY e conferência pública. O build gera um manifesto determinístico com versão identificada pelo commit e resumo humano dos commits, sem dados pessoais. A interface identifica uma versão diferente e apresenta o resumo; o acompanhamento curado permanece no banco, sem build por mensagem. Não se criam tokens nem se usam endpoints públicos de escrita para registrar versões.

## Revisão

Preservar Auth, RLS, dados, módulos, logo e separação de T.I. Não criar usuários nem dados falsos em produção. Testar permissões reais em PostgreSQL/PGlite, navegação e layout em Playwright, casos de troca de conta/sala, erros e retomada de conexão. Conferir chamadas, presença, faltas, atrasos, notas e pesos, feedback, justificativas, gestores, calendário, relatórios/exportações, configurações, cadastro e suporte. Testes mutáveis usam ambiente local isolado. Em produção, fazer consultas e verificações de estrutura e disponibilidade sem alterar registros dos participantes.

Não ativar serviços pagos. Resend não tem domínio validado, portanto e-mails externos permanecem dependentes dessa configuração. Não prometer perfeição absoluta: relatar o que foi comprovado e qualquer limitação material. Desativar a manutenção somente depois da validação final e registrar a conclusão ao vivo.
