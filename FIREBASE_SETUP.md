# Firebase setup do MyDaily

Este projeto já está configurado para usar o Firebase abaixo no front-end web:

- Projeto: `mydaily-dcccb`
- Collection principal no Firestore: `MyDaily`
- E-mail sugerido para cadastro inicial: `Gui.lima3009@gmail.com`

## O que precisa estar habilitado no Firebase Console

1. **Authentication > Sign-in method**
   - Habilite o provedor **Email/Password**.
2. **Firestore Database**
   - Crie o banco em modo nativo.
   - A aplicação salva um documento por usuário em `MyDaily/{uid}`.
3. **Authorized domains**
   - Adicione o domínio onde o site será publicado, se necessário.

## Estrutura salva na nuvem

Cada usuário autenticado salva:

- `reports`: tarefas e comentários por data.
- `queue`: anotações gerais.
- `notebook`: caderno livre.
- `email`: e-mail da conta autenticada.
- `updatedAt`: data da última sincronização.

## Exemplo inicial de regra do Firestore

> Ajuste conforme seu ambiente. Exemplo mínimo para cada usuário acessar apenas o próprio documento.

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /MyDaily/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
