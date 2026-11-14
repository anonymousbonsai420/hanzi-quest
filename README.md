# Hanzi Quest · 汉字之旅

App gamificado para aprender **mandarim** em português. Tem lições curtas, repetição espaçada, reconhecimento de fala, escrita de caracteres traço a traço e treino de tons.

## Como rodar

Precisa só do Node.js (sem `npm install`):

```bash
node server.js
```

Abra **http://localhost:5173** no **Chrome ou Edge**. O reconhecimento de fala usa a Web Speech API, que existe nesses navegadores e precisa de internet.

> O microfone só funciona em `localhost` ou `https`. Para usar no celular, publique a pasta num host estático com HTTPS (GitHub Pages, Netlify, Vercel...). Como é um PWA, dá para "instalar" na tela inicial.

## Funcionalidades

### Aprendizado
| Exercício | O que treina |
|---|---|
| ✨ Palavra nova | Hanzi + pinyin colorido por tom + áudio + animação da ordem dos traços |
| 🔤 Significado / Hanzi | Reconhecimento (múltipla escolha) |
| 🎧 Escuta | Áudio → caractere (sem pinyin) |
| ⌨️ Pinyin | Digitar com tons (`ni3 hao3` ou `nǐ hǎo`); aceita sandhi de 不, 一 e 3º+3º |
| 🎤 Fala | Reconhecimento de voz zh-CN com nota por caractere e tolerância a homófonos |
| 🖌️ Escrita | Desenhar no quadriculado 田字格 com validação de cada traço (Hanzi Writer) |
| 🧩 Montar frase | Peças com tradução ou ditado por áudio |
| 🔗 Pares | Ligar hanzi ↔ significado |
| 🎵 Tons | Ouvir e identificar o tom, com contorno visual |
| 📈 Espelho de tons | Detecta a altura da voz (autocorrelação) e desenha sua curva sobre o contorno ideal |

### Gamificação
- **XP e níveis** com títulos (初学者 Iniciante → 龙 Dragão)
- **Ofensiva** 🔥 diária com **congelamento** 🧊
- **Meta diária** configurável (10/20/30/50 XP)
- **Vidas** ❤️ nas lições (recarregam 1 a cada 20 min; revisões devolvem vida)
- **Moedas** 💰 e **loja**
- **3 missões diárias** + baú bônus
- **20 conquistas**
- **Combos**, confete, efeitos sonoros, mapa de atividade (12 semanas)
- **Desafio relâmpago** de 60 s com recorde

### Modo Amigos 👥 (opcional, só por convite)
- **Placar com amigos**: XP da semana (zera toda segunda), XP total, ofensiva e recorde do Desafio relâmpago
- **Você × amigo**: estatísticas lado a lado e os dois mapas de atividade
- **Pódio semanal** ganha 50 / 25 / 10 💰; avisos quando alguém passa você; conquistas de turma
- **Acesso controlado**: cadastro só com convite de uso único, limite de membros (padrão 5) e painel do administrador para criar convites e revogar acessos
- O progresso continua no aparelho; a conta só compartilha as estatísticas com os amigos aceitos

### Memória
- **Repetição espaçada SM-2**: uma nota por palavra por sessão, com previsão de revisões e níveis de domínio
- **Coleção de Hanzi** com domínio, próxima revisão, exemplos e animação de traços

### Conteúdo
8 unidades / 93 palavras / 34 frases (base HSK 1), com dicas de gramática por unidade:
Saudações · Pessoas · Números · Família · Comida · Tempo · Lugares · Conversa.

## Estrutura

```
index.html            Shell + carregamento do Hanzi Writer (CDN)
css/styles.css        Tema claro/escuro, layout mobile e desktop
js/app.js             Navegação, barra superior, eventos globais
js/screens.js         Telas: Trilha, Revisar, Praticar, Hanzi, Perfil, onboarding
js/session.js         Executor de sessões, resultados, Desafio relâmpago, Espelho de tons
js/exercises.js       Os tipos de exercício
js/builder.js         Monta lições, revisões e treinos
js/data.js            Conteúdo do curso (para adicionar unidades, edite aqui)
js/pinyin.js          Pinyin numérico ↔ acentuado, verificação, contornos de tom
js/speech.js          Reconhecimento de fala + pontuação por alinhamento
js/pitch.js           Detecção de altura da voz
js/audio.js           Voz (TTS zh-CN) e efeitos sonoros
js/srs.js             Repetição espaçada
js/game.js            XP, níveis, ofensiva, vidas, loja, missões, conquistas
js/state.js           Persistência em localStorage (exportar/importar no Perfil)
js/guide.js           Guia de estudo dentro do app
js/social.js          Tela Amigos: placar, pedidos de amizade, comparação, painel do administrador
js/cloud.js           Conta, sincronização do progresso e chamadas ao Supabase
js/cloud-mock.js      Servidor simulado para testar o modo Amigos em localhost (?mock)
js/config.js          URL e chave pública do Supabase (vazio = modo Amigos desligado)
supabase/schema.sql   Banco do modo Amigos: tabelas, regras de acesso e funções
supabase/test/        Testes do banco (Postgres embutido)
sw.js                 Service worker (offline)
METODOLOGIA.md        Métodos e processos de aprendizado sugeridos
```

## Requisitos e limitações

- **Voz em mandarim:** usa as vozes do sistema/navegador. No Edge as vozes "Online (Natural)" funcionam muito bem. No Windows, se faltar voz: *Configurações → Hora e idioma → Fala → Adicionar vozes → Chinês (Simplificado)*.
- **Reconhecimento de fala:** Chrome/Edge (online). Em outros navegadores o app usa o modo "grave e compare", com autoavaliação.
- **Escrita:** os dados de traços vêm do CDN jsDelivr na primeira vez e depois ficam em cache para uso offline.
- **Espelho de tons:** a classificação é heurística. Funciona melhor com sílabas isoladas, faladas devagar e sem ruído.
- O progresso fica no navegador (localStorage). Use *Exportar progresso* para fazer backup.

## Modo Amigos: configuração (administrador)

O modo Amigos usa um projeto **gratuito** do [Supabase](https://supabase.com) (banco Postgres + login). Sem configurar, o app funciona normalmente e a aba Amigos só explica o recurso.

1. Crie uma conta e um projeto no Supabase (plano Free).
2. **SQL Editor** → cole todo o arquivo [`supabase/schema.sql`](supabase/schema.sql) → **Run**. O resultado mostra o seu **convite de administrador** (válido por 7 dias). Se ele expirar, rode o arquivo de novo e outro é gerado.
3. **Authentication → Sign In / Providers**:
   - **Email**: deixe ligado e **desative "Confirm email"**. O login é por nome de usuário; o app cria um e-mail interno `usuario@hanzi-quest.invalid`, e nenhum e-mail é enviado.
   - **Allow new users to sign up**: deixe ligado. Quem barra cadastros sem convite é o banco.
   - **Anonymous sign-ins**: deixe desligado (é o padrão).
4. **Project Settings → API Keys**: copie a **Project URL** e a chave pública (**publishable** / **anon**) para [`js/config.js`](js/config.js). Nunca use a chave `service_role` / `secret`.
5. Publique, abra o app → **Amigos** → **Tenho um convite** → use o convite de administrador e crie sua conta.
6. No painel 🛡️ da aba Amigos: gere um convite por amigo e envie o link (`…/hanzi-quest/?invite=HQ-XXXX-XXXX`). Quem entra pelo seu convite já vira seu amigo.

**Regras de acesso:** todo o banco fica fechado para a chave pública; o app só chama as funções de `schema.sql`, e elas exigem um membro **ativo**. O limite conta todos os membros ativos, incluindo o administrador (mude no painel). Revogar alguém bloqueia o acesso na hora e libera a vaga.

**Tarefas que ficam no painel do Supabase:**
- *Apagar uma conta*: Authentication → Users → Delete user (os dados dela somem junto).
- *Redefinir uma senha* (não há recuperação por e-mail): SQL Editor →
  `update auth.users set encrypted_password = extensions.crypt('NOVA-SENHA', extensions.gen_salt('bf')) where email = 'usuario@hanzi-quest.invalid';`
- O plano Free **pausa o projeto após 7 dias sem uso**. Se isso acontecer, reative em Project → Restore.

**Testar sem Supabase:** `node server.js` e abra **http://localhost:5173/?mock** (servidor simulado no navegador; convite de admin `HQ-TEST-ADMN`, membros fictícios Ana e Bruno). Testes do banco: `cd supabase/test && npm i --no-save @electric-sql/pglite@0.2.17 && node schema.test.mjs`.

## Contribuindo (fluxo de branches)

O projeto usa gitflow, e as regras valem para pessoas e para agentes de IA ([.claude/CLAUDE.md](.claude/CLAUDE.md)):

| Branch | Sai de | Entra em |
|---|---|---|
| `feature/<nome>`, `fix/<nome>` | `develop` | `develop` (PR) |
| `develop` | `main` | `main` (PR de release, merge commit) |
| `hotfix/<nome>` | `main` | `main` (PR) |

- `main` e `develop` são protegidas: não aceitam push direto, force-push nem exclusão. Tudo entra por PR, que precisa passar na checagem `branch-rules`.
- **Backport automático:** depois de cada release ou hotfix na `main`, o workflow `backport.yml` mescla a `main` de volta na `develop`. Assim o próximo release não sobrescreve código que já está em produção.
- No Claude Code, o hook `.claude/hooks/git-guard.js` barra comandos git/gh fora dessas regras antes de rodarem.

## Próximos passos sugeridos

1. **Mais conteúdo:** HSK 2–3, unidades de radicais (部首) e pares de tons.
2. **Backup na nuvem** do progresso completo, para continuar em outro aparelho (próximo PR do modo Amigos).
3. **Parceiro de conversa com IA:** diálogos guiados por cenário (restaurante, táxi) com correção de gramática e tons.
4. **Avaliação de pronúncia mais precisa** com um serviço de *pronunciation assessment* que pontua tom por sílaba.
5. **Leituras graduadas** curtas com toque-para-traduzir.
6. **Notificações** de lembrete da ofensiva (PWA push).
