import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const categories = [
  // ENTRADAS (Tons de Verde e Azul)
  { name: "Salário", type: "INCOME", color: "#2E7D32" },
  { name: "Freelance/Projetos", type: "INCOME", color: "#4CAF50" },
  { name: "Investimentos - Dividendos", type: "INCOME", color: "#0088FE" },
  { name: "Investimentos - Resgate", type: "INCOME", color: "#00C49F" },
  { name: "Presentes", type: "INCOME", color: "#82CA9D" },
  { name: "Vendas", type: "INCOME", color: "#1976D2" },
  { name: "Reembolsos", type: "INCOME", color: "#2196F3" },
  { name: "Bônus/PLR", type: "INCOME", color: "#0288D1" },
  { name: "Restituição de Imposto", type: "INCOME", color: "#0097A7" },
  { name: "Outros", type: "INCOME", color: "#9E9E9E" },

  // DESPESAS - HABITAÇÃO (Tons de Vermelho e Laranja)
  { name: "Aluguel", type: "EXPENSE", color: "#D32F2F" },
  { name: "Condomínio", type: "EXPENSE", color: "#E53935" },
  { name: "Energia Elétrica", type: "EXPENSE", color: "#F44336" },
  { name: "Água/Saneamento", type: "EXPENSE", color: "#FF5722" },
  { name: "Internet/Celular", type: "EXPENSE", color: "#FF9800" },
  { name: "Gás", type: "EXPENSE", color: "#FB8C00" },
  { name: "Manutenção/Reparos Casa", type: "EXPENSE", color: "#F57C00" },
  { name: "Limpeza/Produtos de Casa", type: "EXPENSE", color: "#EF6C00" },

  // DESPESAS - ALIMENTAÇÃO (Tons de Amarelo e Âmbar)
  { name: "Supermercado", type: "EXPENSE", color: "#FFBB28" },
  { name: "Restaurante", type: "EXPENSE", color: "#FFC107" },
  { name: "Lanches/Cafés", type: "EXPENSE", color: "#FFD54F" },
  { name: "Delivery", type: "EXPENSE", color: "#FFCA28" },
  { name: "Padaria", type: "EXPENSE", color: "#FF8042" },

  // DESPESAS - TRANSPORTE (Tons de Marrom)
  { name: "Combustível", type: "EXPENSE", color: "#795548" },
  { name: "Transporte Público/App", type: "EXPENSE", color: "#8D6E63" },
  { name: "Estacionamento", type: "EXPENSE", color: "#A1887F" },
  { name: "Pedágio", type: "EXPENSE", color: "#6D4C41" },
  { name: "Mecânico", type: "EXPENSE", color: "#5D4037" },
  { name: "Seguro Veicular", type: "EXPENSE", color: "#4E342E" },
  { name: "IPVA/Licenciamento", type: "EXPENSE", color: "#3E2723" },

  // DESPESAS - SAÚDE (Tons de Ciano)
  { name: "Farmácia", type: "EXPENSE", color: "#00ACC1" },
  { name: "Médico/Exames", type: "EXPENSE", color: "#26C6DA" },
  { name: "Plano de Saúde", type: "EXPENSE", color: "#4DD0E1" },
  { name: "Dentista", type: "EXPENSE", color: "#80DEEA" },
  { name: "Terapia", type: "EXPENSE", color: "#B2EBF2" },

  // DESPESAS - PESSOAL E LAZER (Tons de Roxo e Rosa)
  { name: "Academia/Esportes", type: "EXPENSE", color: "#9C27B0" },
  { name: "Barbearia/Salão", type: "EXPENSE", color: "#BA68C8" },
  { name: "Cosméticos/Higiene", type: "EXPENSE", color: "#E91E63" },
  { name: "Roupas/Acessórios", type: "EXPENSE", color: "#F06292" },
  { name: "Presentes para Outros", type: "EXPENSE", color: "#F48FB1" },
  { name: "Lavanderia", type: "EXPENSE", color: "#CE93D8" },

  // DESPESAS - EDUCAÇÃO (Tons de Azul Escuro)
  { name: "Cursos/Treinamentos", type: "EXPENSE", color: "#3F51B5" },
  { name: "Livros", type: "EXPENSE", color: "#5C6BC0" },
  { name: "Papelaria", type: "EXPENSE", color: "#7986CB" },
  { name: "Faculdade/Escola", type: "EXPENSE", color: "#1A237E" },

  // DESPESAS - ENTRETENIMENTO (Tons de Violeta)
  { name: "Cinema/Shows/Teatro", type: "EXPENSE", color: "#673AB7" },
  { name: "Viagens/Hospedagem", type: "EXPENSE", color: "#7E57C2" },
  { name: "Hobby", type: "EXPENSE", color: "#9575CD" },
  { name: "Assinaturas", type: "EXPENSE", color: "#8884D8" },

  // DESPESAS - PETS (Tons de Verde Água)
  { name: "Pet: Ração", type: "EXPENSE", color: "#009688" },
  { name: "Pet: Acessórios", type: "EXPENSE", color: "#4DB6AC" },
  { name: "Pet: Veterinário/Vacinas", type: "EXPENSE", color: "#80CBC4" },

  // DESPESAS - FINANCEIRO (Tons de Cinza Azulado e Roxo Escuro)
  { name: "Investimentos - Aporte", type: "EXPENSE", color: "#6A1B9A" },
  { name: "Tarifas Bancárias", type: "EXPENSE", color: "#455A64" },
  { name: "Juros/Empréstimos", type: "EXPENSE", color: "#607D8B" },
  { name: "Seguro de Vida", type: "EXPENSE", color: "#78909C" },
  { name: "Impostos (IPTU/IR)", type: "EXPENSE", color: "#90A4AE" },
  { name: "Doações", type: "EXPENSE", color: "#37474F" },
  { name: "Outras Despesas", type: "EXPENSE", color: "#263238" }
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
    for (const command of sqlCommands) { await client.query(command); }

    console.log(">>> Inserindo categorias base...");
    for (const cat of categories) {
      await client.query(
        'INSERT INTO categories (name, type, color) VALUES ($1, $2, $3) ON CONFLICT (name) DO UPDATE SET color = EXCLUDED.color',
        [cat.name, cat.type, cat.color]
      );
    }

    console.log(">>> Inserindo métodos de pagamento base...");
    for (const method of paymentMethods) {
      await client.query('INSERT INTO payment_methods (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [method]);
    }

    await client.query('COMMIT');
    console.log(">>> Banco inicializado com sucesso!");
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(">>> Erro ao inicializar o banco:", e);
  } finally {
    client.release();
    process.exit();
  }
}
init();