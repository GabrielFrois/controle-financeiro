import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const categories = [
  // ENTRADAS
  { name: "Salário", type: "INCOME" },
  { name: "Freelance/Projetos", type: "INCOME" },
  { name: "Investimentos - Dividendos", type: "INCOME" },
  { name: "Investimentos - Resgate", type: "INCOME" },
  { name: "Presentes", type: "INCOME" },
  { name: "Vendas", type: "INCOME" },
  { name: "Reembolsos", type: "INCOME" },
  { name: "Bônus/PLR", type: "INCOME" },
  { name: "Restituição de Imposto", type: "INCOME" },
  { name: "Outros", type: "INCOME" },
  // DESPESAS
  { name: "Aluguel", type: "EXPENSE" },
  { name: "Condomínio", type: "EXPENSE" },
  { name: "Energia Elétrica", type: "EXPENSE" },
  { name: "Água/Saneamento", type: "EXPENSE" },
  { name: "Internet/Celular", type: "EXPENSE" },
  { name: "Gás", type: "EXPENSE" },
  { name: "Manutenção/Reparos Casa", type: "EXPENSE" },
  { name: "Limpeza/Produtos de Casa", type: "EXPENSE" },
  { name: "Supermercado", type: "EXPENSE" },
  { name: "Restaurante", type: "EXPENSE" },
  { name: "Lanches/Cafés", type: "EXPENSE" },
  { name: "Delivery", type: "EXPENSE" },
  { name: "Padaria", type: "EXPENSE" },
  { name: "Combustível", type: "EXPENSE" },
  { name: "Transporte Público/App", type: "EXPENSE" },
  { name: "Estacionamento", type: "EXPENSE" },
  { name: "Pedágio", type: "EXPENSE" },
  { name: "Mecânico", type: "EXPENSE" },
  { name: "Seguro Veicular", type: "EXPENSE" },
  { name: "IPVA/Licenciamento", type: "EXPENSE" },
  { name: "Farmácia", type: "EXPENSE" },
  { name: "Médico/Exames", type: "EXPENSE" },
  { name: "Plano de Saúde", type: "EXPENSE" },
  { name: "Dentista", type: "EXPENSE" },
  { name: "Terapia", type: "EXPENSE" },
  { name: "Academia/Esportes", type: "EXPENSE" },
  { name: "Barbearia/Salão", type: "EXPENSE" },
  { name: "Cosméticos/Higiene", type: "EXPENSE" },
  { name: "Roupas/Acessórios", type: "EXPENSE" },
  { name: "Presentes para Outros", type: "EXPENSE" },
  { name: "Lavanderia", type: "EXPENSE" },
  { name: "Cursos/Treinamentos", type: "EXPENSE" },
  { name: "Livros", type: "EXPENSE" },
  { name: "Papelaria", type: "EXPENSE" },
  { name: "Faculdade/Escola", type: "EXPENSE" },
  { name: "Cinema/Shows/Teatro", type: "EXPENSE" },
  { name: "Viagens/Hospedagem", type: "EXPENSE" },
  { name: "Hobby", type: "EXPENSE" },
  { name: "Assinaturas", type: "EXPENSE" },
  { name: "Pet: Ração", type: "EXPENSE" },
  { name: "Pet: Acessórios", type: "EXPENSE" },
  { name: "Pet: Veterinário/Vacinas", type: "EXPENSE" },
  { name: "Investimentos - Aporte", type: "EXPENSE" },
  { name: "Tarifas Bancárias", type: "EXPENSE" },
  { name: "Juros/Empréstimos", type: "EXPENSE" },
  { name: "Seguro de Vida", type: "EXPENSE" },
  { name: "Impostos (IPTU/IR)", type: "EXPENSE" },
  { name: "Doações", type: "EXPENSE" },
  { name: "Outras Despesas", type: "EXPENSE" }
];

const paymentMethods = ["Dinheiro", "Pix", "Crédito", "Débito", "Transferência", "Saldo Corretora", "Outros"];

async function init() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log(">>> Criando tabelas...");
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    const sqlCommands = schema.split(';').filter(cmd => cmd.trim() !== '');
    for (const command of sqlCommands) {
      await client.query(command);
    }

    console.log(">>> Inserindo categorias base...");
    for (const cat of categories) {
      await client.query(
        'INSERT INTO categories (name, type) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
        [cat.name, cat.type]
      );
    }

    console.log(">>> Inserindo métodos de pagamento base...");
    for (const method of paymentMethods) {
      await client.query(
        'INSERT INTO payment_methods (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
        [method]
      );
    }

    await client.query('COMMIT');
    console.log(">>> Banco inicializado com sucesso!");
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(">>> Erro ao inicializar banco:", e);
  } finally {
    client.release();
    process.exit();
  }
}

init();