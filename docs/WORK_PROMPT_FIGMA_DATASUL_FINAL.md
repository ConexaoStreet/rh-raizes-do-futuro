# WORK PROMPT - FINALIZACAO VISUAL DATASUL / RAIZES DO FUTURO

## Contexto obrigatório
Projeto existente: `ConexaoStreet/rh-raizes-do-futuro`.
Não recriar projeto, banco, Auth, Supabase, Vercel ou aplicação.
Não substituir funções reais por mocks.
Não apagar módulos.
Não expor secrets.
Não alterar RLS sem necessidade comprovada.

PR do redesign em andamento: #21
Branch: `redesign/datasul-cinematic-20260924`
Figma já criado: `Raízes do Futuro - Datasul Redesign`
File key: `Whjiq4HgO0pbtVC1rQdIKR`

## Objetivo
Executar somente o trabalho que ficou impedido pela limitação de chamadas do conector Figma Starter: capturar e documentar no Figma o redesign real já implementado no frontend e fazer uma auditoria visual completa com navegador.

A implementação real no GitHub é a fonte de verdade. O Figma deve refletir o produto, não substituir o produto.

## Direção visual inegociável
A interface não pode ter aparência de IA, template de dashboard, kit genérico, glassmorphism excessivo ou composição artificialmente simétrica.

Deve parecer um produto interno feito por uma equipe profissional de produto, engenharia e design:
- editorial;
- técnico;
- corporativo;
- sofisticado;
- humano;
- alta densidade informacional;
- verde floresta, preto esverdeado, grafite, branco quente;
- verde claro/lima apenas como acento;
- âmbar apenas para alerta/operação;
- animações curtas e intencionais.

## 1. Captura visual
Abra o preview mais recente do PR #21 ou a produção se o PR já estiver mergeado.
Capture no Figma, em frames separados:
1. abertura cinematográfica Raízes do Futuro;
2. login desktop;
3. login com foco no e-mail;
4. login com foco na senha oculta;
5. login com senha revelada;
6. login por código semanal;
7. Datasul desktop;
8. Datasul com manutenção global ativa;
9. Datasul responsivo/mobile.

Não use imagens genéricas nem gere uma nova marca.

## 2. Mascote
O mascote existente é vetorial/CSS e faz parte da interface real.
No Figma, documente os estados:
- idle;
- email;
- password;
- peek;
- code;
- error;
- success.

Preserve o conceito: criatura vegetal discreta que fica “bisbilhotando” os campos, mas sem estética infantil ou caricatura de app educacional.

## 3. Auditoria visual
Faça cinco passagens completas.

### Passagem 1 - composição
Revise hierarquia, assimetria, grid, alinhamento, espaçamento, densidade e leitura.

### Passagem 2 - produto
Verifique se cada elemento visual tem função real e se nenhum bloco parece decorativo ou “dashboard de Dribbble”.

### Passagem 3 - estados
Valide loading, erro, manutenção, conexão necessária, resultado da API, tabela vazia e resposta do Datasul.

### Passagem 4 - responsividade e acessibilidade
Valide desktop, tablet e mobile, contraste, foco visível, reduced motion, navegação por teclado e áreas de toque.

### Passagem 5 - anti-IA
Rejeite e corrija qualquer trecho que pareça:
- template;
- UI gerada automaticamente;
- cards repetidos sem hierarquia;
- texto institucional genérico;
- brilho/gradiente gratuito;
- componente visual sem função.

## 4. Browser QA
Use navegador real.
Verifique console JS e network.
Não use credenciais inventadas.
Não tente obter senha ou secret.
Para login, teste apenas estados públicos/interações de campos sem autenticar, salvo se uma sessão já estiver autorizada no ambiente.

## 5. Alterações de código
Se encontrar defeito visual real, abra uma branch a partir da main mais recente e faça correção mínima.
Nunca faça redesign paralelo ao que já está implementado.
Não remova funcionalidades.
Rode:
- npm audit;
- lint;
- check:privacy;
- testes;
- test:database;
- build;
- bundle;
- Playwright/E2E.

Só merge se tudo passar e os deploys Vercel RH e T.I. estiverem verdes.

## Critério final
Entregar o Figma como documentação fiel da interface real e um relatório curto de QA com:
- telas verificadas;
- problemas encontrados;
- correções aplicadas;
- checks executados;
- commit final;
- deploy validado.

Não declarar algo como validado visualmente sem realmente abrir a página em navegador.
