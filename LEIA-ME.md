# MYDAILY — versão com usuário + Firebase

```
Nova pasta/
├── public/index.html   <- o app (é aqui que vai o firebaseConfig)
├── firestore.rules     <- regras de segurança (cada usuário só vê os próprios dados)
├── firebase.json       <- configuração de deploy (Hosting + regras)
├── .firebaserc         <- id do projeto Firebase
└── mydaily.html        <- versão antiga (intocada)
```

## 1. Criar o projeto no Firebase (uma vez só)

1. Acesse https://console.firebase.google.com → **Adicionar projeto** (o Analytics pode ficar desligado).
2. **Authentication → Começar → Sign-in method** e habilite:
   - **E-mail/senha**
   - **Google** (opcional; só funciona pelo site publicado ou por `http://localhost`)
3. **Firestore Database → Criar banco de dados** → modo **produção** → região `southamerica-east1` (São Paulo).
4. **Configurações do projeto (engrenagem) → Seus apps → `</>` (Web)** → registre o app (sem Hosting nessa tela) e copie o objeto `firebaseConfig`.
5. Abra `public/index.html`, procure `FIREBASE_CONFIG` (logo no início do `<script type="module">`) e cole os valores.
   > A `apiKey` do Firebase Web não é secreta: quem protege os dados são as regras do Firestore.
6. Troque `SEU-PROJETO` em `.firebaserc` pelo **ID do projeto** (aparece nas configurações).

## 2. Publicar as regras e o site

Precisa do Node instalado:

```bash
npm install -g firebase-tools
```

```bash
firebase login
```

Dentro desta pasta:

```bash
firebase deploy
```

Isso publica as regras do Firestore e o site em `https://SEU-PROJETO.web.app`.
Se preferir não usar o CLI para as regras, copie o conteúdo de `firestore.rules` em **Firestore → Regras → Publicar**.

## 3. Testar localmente (opcional)

```bash
npx serve public
```

Abra o endereço que aparecer (`http://localhost:3000`). O `localhost` já vem autorizado no Firebase.
Abrindo o `index.html` direto (duplo clique / `file://`) o login por e-mail funciona, mas o do Google não.

## 4. Trazer os dados antigos

- **Pelo arquivo:** menu do usuário → **Importar backup** → escolha o `BKP.txt` (ou o `.json` que era o ARQUIVO BASE).
- **Automático:** se o app novo for aberto no mesmo navegador em que a versão antiga rodava (também como arquivo local), aparece uma faixa amarela oferecendo a importação.

Na importação, os dias do arquivo substituem os mesmos dias da nuvem; as anotações e o caderno do arquivo são adicionados ao final dos atuais.

## O que mudou em relação à versão antiga

- Login com e-mail/senha (criar conta e recuperar senha) e Google.
- Dados no Firestore por usuário, com cache offline: dá para editar sem internet e o app sincroniza quando a conexão volta.
- Salvamento automático 1,5 s depois de cada alteração (no lugar do timer de 5 min), com status no rodapé, `Ctrl+S` e aviso ao fechar a aba com algo pendente.
- Corrigido: datas em UTC (depois das 21h caía no dia seguinte), gráfico de 7 dias deslocado um dia, aspas e HTML quebrando campos, auto-save apagando anotações antes de abrir, erros de gravação ignorados.
- Horas aceitam `1,5`, `1.5`, `1:30`, `1h30`, `2h` e `45m`; valor inválido fica em vermelho.
- Navegação com ◀ ▶, botão **Hoje** e `Alt+←/→`. Pode pular fim de semana (Configurações).
- Relatório editável, com opção de incluir o dia anterior e as anotações globais.
- Estatísticas: horas dos últimos 7 dias com linha da meta, % da meta, média e distribuição do dia.
- Exportar backup em JSON a qualquer momento.
