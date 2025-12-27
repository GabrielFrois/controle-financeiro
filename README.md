# Sistema de Controle Financeiro

Este projeto é um sistema de controle financeiro pessoal desenvolvido com **Node.js (Express)**, **TypeScript** e **PostgreSQL**. O projeto irá permitir o gerenciamento de múltiplos usuários, categorias personalizadas e o registro detalhado de receitas e despesas.

> ⚠️ **Status do Projeto:** Em construção. Atualmente focado na implementação das regras de negócio e integração total entre o banco de dados e a interface.

---

## Tecnologias Utilizadas

### Backend
- **Node.js** + **TypeScript**
- **Express**: Framework para rotas e middleware.
- **pg (node-postgres)**: Driver para conexão direta com o PostgreSQL.


---

## Como Rodar o Backend

### 1. Pré-requisitos
Certifique-se de ter instalado em sua máquina:
- [Node.js](https://nodejs.org/) (Versão 18 ou superior)
- [PostgreSQL](https://www.postgresql.org/) (Com um banco de dados criado com o nome `controle-financeiro`)

### 2. Instalação
Clone o repositório e instale as dependências:
```bash
# Entre na pasta do backend
cd backend

# Instale as dependências
npm install
```

### 3. Configuração do Banco de Dados
Crie um arquivo .env na raiz da pasta backend e adicione sua URL de conexão com o banco:
```bash
DATABASE_URL=postgres://seu_usuario:sua_senha@localhost:5432/controle-financeiro
PORT=3000
```

### 4. Inicializando o Banco (Seed)
Para criar as tabelas, rode:
```Bash
npm run init
```
Para adicionar usuários e registros de exemplos, rode:
```bash
npm run seed
```

### 5. Executando o Servidor
```Bash
npm run dev
```
**O servidor estará disponível em: http://localhost:3000**