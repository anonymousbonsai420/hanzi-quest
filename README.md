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
sw.js                 Service worker (offline)
METODOLOGIA.md        Métodos e processos de aprendizado sugeridos
```

## Requisitos e limitações

- **Voz em mandarim:** usa as vozes do sistema/navegador. No Edge as vozes "Online (Natural)" funcionam muito bem. No Windows, se faltar voz: *Configurações → Hora e idioma → Fala → Adicionar vozes → Chinês (Simplificado)*.
- **Reconhecimento de fala:** Chrome/Edge (online). Em outros navegadores o app usa o modo "grave e compare", com autoavaliação.
- **Escrita:** os dados de traços vêm do CDN jsDelivr na primeira vez e depois ficam em cache para uso offline.
- **Espelho de tons:** a classificação é heurística. Funciona melhor com sílabas isoladas, faladas devagar e sem ruído.
- O progresso fica no navegador (localStorage). Use *Exportar progresso* para fazer backup.

## Próximos passos sugeridos

1. **Mais conteúdo:** HSK 2–3, unidades de radicais (部首) e pares de tons.
2. **Conta e sincronização** (backend) para usar em vários dispositivos, com ligas semanais reais.
3. **Parceiro de conversa com IA:** diálogos guiados por cenário (restaurante, táxi) com correção de gramática e tons.
4. **Avaliação de pronúncia mais precisa** com um serviço de *pronunciation assessment* que pontua tom por sílaba.
5. **Leituras graduadas** curtas com toque-para-traduzir.
6. **Notificações** de lembrete da ofensiva (PWA push).
