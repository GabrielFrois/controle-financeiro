# Financias - Sistema de Controle Financeiro

O **Financias** é uma aplicação Full-Stack completa para gestão financeira pessoal e familiar. O sistema centraliza o controle de fluxo de caixa, gestão de orçamentos, acompanhamento de investimentos e relatórios detalhados.

![Dashboard Preview](./.github/assets/dashboard-preview.png)

---

## Funcionalidades Principais

### Dashboards Analíticos
- **KPIs em Tempo Real:** Saldo, Receitas, Despesas e Patrimônio Líquido.
- **Gráficos Dinâmicos:** Distribuição por categorias (Pizza), fluxo de caixa (Barras) e evolução patrimonial (Área).
- **Filtros Temporais:** Visualização por Mês, Ano ou Histórico Completo.

### Gestão de Transações
- **Entradas e Saídas:** Cadastro completo com categorização e vínculo a usuários.
- **Compras Parceladas:** Lógica inteligente para parcelamento no cartão de crédito.
- **Edição em Lote:** Capacidade de editar parcelas futuras de uma compra recorrente.

### Investimentos e Patrimônio
- **Cotação Automática:** Integração com APIs externas para atualizar preços de Ações, FIIs e Criptos.
- **Cálculo de Preço Médio:** O sistema calcula automaticamente o preço médio com base nos aportes.
- **Rentabilidade de Renda Fixa:** Cálculo **estimativo** de rentabilidade diária baseada no CDI.
- **Dividendos:** Histórico visual de proventos recebidos.

### Metas e Orçamentos
- Definição de tetos de gastos (Mensal ou Anual) por categoria.
- Barras de progresso visual para acompanhar o consumo do orçamento.
- Alertas de categorias que excederam o limite.

### Relatórios
- **Modo Impressão:** Layout otimizado para gerar PDFs limpos (CSS `@media print`).
- **Exportação CSV:** Download dos dados filtrados para uso em planilhas externas.

---

## Tecnologias Utilizadas

### Frontend
- **React.js** + **TypeScript** + **Vite**
- **Material UI (MUI):** Design System e Componentes.
- **Recharts:** Biblioteca de gráficos.
- **Axios:** Consumo de APIs.

### Backend
- **Node.js** + **TypeScript**
- **Express:** API REST.
- **PostgreSQL:** Banco de dados relacional.
- **APIs Externas:** Brapi, AwesomeAPI e CoinMarketCap.

---

## Cobertura de Ativos e APIs

O sistema utiliza APIs públicas para buscar cotações. Para garantir estabilidade, alguns ativos possuem **tratamento manual** no código. Abaixo está a lista do que é suportado automaticamente:

### 1. Moedas (Câmbio)
As seguintes moedas são convertidas automaticamente para BRL via *AwesomeAPI*:
* **Dólar:** `USDBRL`
* **Euro:** `EURBRL`
* **Libra:** `GBPBRL`

### 2. Ações Internacionais (Mapeamento Manual)
Como a API principal (Brapi) foca no mercado brasileiro, ativos internacionais inseridos com tickers estrangeiros são convertidos internamente para seus respectivos **BDRs** para fins de cotação em Reais:

| Ticker Inserido | Mapeado Para (API) | Descrição |
| :--- | :--- | :--- |
| `TSMC` ou `TMC` | `TSMC34` | Taiwan Semiconductor (BDR) |
| `APPLE` | `AAPL34` | Apple Inc. (BDR) |
| `IVVB11` | `IVVB11` | ETF S&P 500 |

> **Nota:** Se você inserir um ticker internacional que não esteja nesta lista (ex: `MSFT`), o sistema tentará buscar diretamente. Se falhar, recomenda-se usar o ticker do BDR (ex: `MSFT34`) ou editar o valor manualmente na interface.

### 3. Renda Fixa
Ativos como **Tesouro Direto** ou **CDBs** não possuem cotação em tempo real via API pública gratuita.
* **Lógica:** O sistema projeta o valor atual baseando-se na taxa contratada (% do CDI) e na data do aporte.
* **Ajuste Manual:** É possível clicar no ícone de lápis na tabela de investimentos para corrigir o saldo atual manualmente.

---

## Como Rodar o Projeto

### Pré-requisitos
* Node.js (v18+)
* PostgreSQL (Banco de dados criado com nome `controle-financeiro`)

### 1. Configuração do Backend

Entre na pasta do servidor:
```bash
cd backend
npm install
```

Crie um arquivo `.env` na raiz da pasta backend com as seguintes variáveis:
```bash
PORT=3000
DATABASE_URL=postgres://seu_usuario:sua_senha@localhost:5432/controle-financeiro

# Tokens de API (Gratuitos)
BRAPI_TOKEN=seu_token_brapi_aqui
ALPHA_VANTAGE_KEY=sua_chave_aqui (Opcional - Fallback)
CMC_PRO_API_KEY=sua_chave_aqui (Opcional - Fallback Cripto)
```

Inicialize o banco de dados e popule com dados de teste:
```Bash
# Cria as tabelas
npm run init

# Popula com dados fictícios (Opcional)
npm run seed
```

Inicie o servidor:
```Bash
npm run dev
```
**O backend rodará em: http://localhost:3000**

Para apagar os registros:
```Bash
npm run clear
```

2. Configuração do Frontend
Abra um novo terminal e entre na pasta do frontend:
```Bash
cd frontend
npm install
```

Inicie a aplicação web:
```Bash
npm run dev
```
**Acesse a aplicação em: http://localhost:5173**

## Screenshots

### Tela de Transações
![Transactions Preview](./.github/assets/transactions-preview.png)

### Investimentos
![Investments Preview](./.github/assets/investments-preview.png)

### Gestão de Metas
![Budgets Preview](./.github/assets/budgets-preview.png)

### Relatórios
![Reports Preview](./.github/assets/reports-preview.png)