# Financias - Sistema de Controle Financeiro

O Financias é uma aplicação completa de gestão financeira pessoal e familiar. O sistema permite não apenas o controle de fluxo de caixa (entradas e saídas), mas também a gestão de orçamentos (metas), acompanhamento detalhado de investimentos (dividendos e patrimônio) e geração de relatórios exportáveis.

---

## Funcionalidades Principais

### Dashboards Analíticos
- Visualização de Saldo, Receitas, Despesas e Patrimônio Total.
- Gráficos de distribuição por categoria e fluxo de caixa mensal/anual.
- Listagem rápida de lançamentos recentes.

### Gestão de Transações
- Cadastro detalhado de receitas e despesas.
- Compras Parceladas: Suporte a transações em cartão de crédito com gerenciamento de parcelas.
- Filtros avançados por data, usuário, categoria e tipo.

### Investimentos e Patrimônio
- Acompanhamento de aportes, resgates e dividendos.
- Suporte a ativos específicos (Tickers) como Ações, FIIs e Criptoativos.
- Gráficos de evolução patrimonial e histórico de proventos recebidos.

### Metas e Orçamentos 
- Definição de limites de gastos por categoria.
- Acompanhamento visual de progresso (mensal e anual).
- Alertas visuais para categorias próximas ao limite ou estouradas.

### Relatórios e Exportação
- Geração de relatórios formatados para impressão.
- Exportação de dados consolidados em formato CSV.
- Visão detalhada de maiores movimentações e resumo por categoria.

---

## Tecnologias Utilizadas

### Frontend
- **React.js** + **TypeScript**
- **Material UI (MUI):** Biblioteca de componentes para interface moderna e responsiva.
- **Recharts:** Gráficos interativos e dinâmicos.
- **React Router Dom:** Gerenciamento de navegação SPA.
**Axios:** Cliente HTTP para comunicação com a API.

### Backend
- **Node.js** + **TypeScript**
- **Express:** Framework para rotas e middleware.
- **PostgreSQL:** Banco de dados relacional.
- **node-postgres (pg):** Driver de conexão com o banco.

---

## Como Rodar o Projeto 

Clone o repositório:
```bash
git clone https://github.com/seu-usuario/controle-financeiro.git
cd controle-financeiro
```

### Iniciando o Backend:
### 1. Pré-requisitos
Certifique-se de ter instalado em sua máquina:
- [Node.js](https://nodejs.org/) (Versão 18 ou superior)
- [PostgreSQL](https://www.postgresql.org/) (Com um banco de dados criado com o nome `controle-financeiro`)

### 2. Instalação
Instale as dependências:
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
Para apagar os registros de exemplos, rode:
```bash
npm run clear
```

### 5. Executando o Servidor
```Bash
npm run dev
```
**O servidor estará disponível em: http://localhost:3000**

### Iniciando o Frontend:

### 1. Instale as dependências:
```bash
# Entre na pasta do backend
cd backend

# Instale as dependências
npm install
```

### 2. Inicie a aplicação:
```bash
npm run dev
```

**A aplicação estará disponível em: http://localhost:5173**