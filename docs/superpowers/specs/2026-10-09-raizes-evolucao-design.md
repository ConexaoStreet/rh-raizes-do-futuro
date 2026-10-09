# Raízes do Futuro - evolução da experiência

## Objetivo e autorização
Atualizar o site existente por inteiro dentro da arquitetura React/Vite/Supabase/Vercel. O usuário autorizou execução e publicação com as conexões disponíveis. O resultado deve parecer um produto próprio, funcionar em celular e desktop e preservar dados, módulos, logo oficial, controle de acesso e separação entre RH e T.I.

## Direção visual
Verde floresta #153e31, verde-lima #d3ec97, superfície clara #f6f8f5 e grafite esverdeado. DM Sans para leitura e Manrope para títulos. Login com composição editorial, frase “Seu futuro começa com raízes.”, logo oficial, formulário acessível e mascote interativo existente. Painel com saudação pelo primeiro nome, data, ações permitidas, métricas, presença, pendências e calendário. Navegação agrupada, contexto da página e atalhos de teclado. Temas claro, escuro e automático permanecem.

## Fluxos
O boletim terá seletor de período e cartões de competências no mobile, com nota, peso e contribuição explícitos; tabela comparativa permanece no desktop. Média ponderada e contratos de notas não mudam. Notificações do RH serão filtradas por proprietário e escopo, atualizarão via Realtime e ao retornar à janela, e terão filtros de todas/não lidas e recuperação de erro. Contador não pode incluir eventos técnicos. Não enviar e-mails de teste ou retransmitir mensagens antigas.

## Backend e desempenho
Adicionar publicação de notifications ao Realtime quando existir a publicação Supabase; manter RLS e políticas existentes. Adicionar índice parcial para notificações RH não lidas. Versionar a migration. Corrigir configuração de chunking do Vite 7 e isolar bibliotecas grandes do login. Confirmar banco e delivery tracking sem alterar serviços internos ou ativar pagamentos. Os avisos operacionais já solicitados pelo usuário permanecem.

## Verificação
Lint, privacidade, unitários, banco, build e orçamento do bundle. Exercitar login, primeiro acesso, menus, busca, notificações e boletim usando contratos locais de teste (sem fixtures na produção). Revisão visual em 320/390/430/560 e desktop, ambos os temas, teclado e movimento reduzido. Publicar commit revisado e verificar o SHA servido na Vercel. Não declarar publicação concluída se a plataforma impedir o deploy.

## Materiais de design
Figma: https://www.figma.com/design/NdxfxEM6xcjzg6veJ8MzuX
Canva de referência: design DAHWXmjkMfQ, identidade existente do Raízes.
