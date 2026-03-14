import { supabase } from '@/integrations/supabase/client';

export type MacroGroup = 'Rendimentos' | 'Investimentos' | 'Despesas';

export interface CategorySeed {
  name: string;
  group_type: MacroGroup;
  subcategories: string[];
}

export const SEED_CATEGORIES: CategorySeed[] = [
  // Despesas
  { name: 'Casa', group_type: 'Despesas', subcategories: ['Crédito', 'Água', 'Luz', 'Internet', 'Limpeza', 'Gás', 'IMI', 'Manutenção', 'Mesada'] },
  { name: 'Compras', group_type: 'Despesas', subcategories: ['Supermercado', 'Roupa', 'Outros'] },
  { name: 'Transportes', group_type: 'Despesas', subcategories: ['Combustível', 'Portagens', 'Ubers', 'Passe', 'Rep. Auto', 'IUC'] },
  { name: 'Seguros', group_type: 'Despesas', subcategories: ['Casa', 'Carro', 'Acidentes Pessoais', 'Vida'] },
  { name: 'Saúde', group_type: 'Despesas', subcategories: ['Consulta', 'Próteses', 'Medicamentos', 'Animais'] },
  { name: 'Subscrições', group_type: 'Despesas', subcategories: ['Netflix', 'Spotify', 'Piratas', 'Conta Bancária', 'Guarda de Títulos', 'Outras Sub.'] },
  { name: 'Comunicações', group_type: 'Despesas', subcategories: ['Com Pedro', 'Com Henrique', 'Com Sofia'] },
  { name: 'Impostos', group_type: 'Despesas', subcategories: ['IMI', 'IUC'] },
  { name: 'Educação', group_type: 'Despesas', subcategories: ['Edu Henrique', 'Edu Sofia', 'Edu Pedro'] },
  { name: 'Restaurantes', group_type: 'Despesas', subcategories: ['Cantina', 'Rest. Pedro', 'Rest. Sofia', 'Todos'] },
  { name: 'Cuidado Pessoal', group_type: 'Despesas', subcategories: ['Depilação', 'Cabeleireiro', 'Ginásio', 'Manicure', 'Futebol Henrique'] },
  { name: 'Férias', group_type: 'Despesas', subcategories: ['Viagens', 'Alojamento', 'Transportes', 'Bilhetes', 'Refeições', 'Extras', 'Lembranças'] },
  { name: 'Fun', group_type: 'Despesas', subcategories: ['Jornais e Revistas', 'Jogos de Computador', 'Euromilhões', 'Prendas', 'Cinema', 'Eventos'] },
  // Rendimentos
  { name: 'Rendimentos', group_type: 'Rendimentos', subcategories: ['Salário Pedro', 'Salário Sofia', 'Combustível Sofia', 'S. Almoço Pedro', 'S. Almoço Sofia', 'Renda ANO', 'Investimentos', 'R. Extra', 'Combustível Pedro', 'Reembolsos SSaúde', 'Reembolsos SCasa'] },
  // Investimentos
  { name: 'Investimentos', group_type: 'Investimentos', subcategories: ['Fundos', 'Ações', 'Crypto', 'PPR', 'Certificados de A', 'Outros Inv', 'Empresas'] },
];

export async function seedCategoriesForUser(userId: string): Promise<void> {
  // Check if user already has categories
  const { count } = await supabase
    .from('categories')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (count && count > 0) return;

  for (const cat of SEED_CATEGORIES) {
    const { data: category, error: catError } = await supabase
      .from('categories')
      .insert({ user_id: userId, name: cat.name, group_type: cat.group_type })
      .select()
      .single();

    if (catError || !category) continue;

    const subcats = cat.subcategories.map((name, idx) => ({
      category_id: category.id,
      user_id: userId,
      name,
      sort_order: idx,
    }));

    await supabase.from('subcategories').insert(subcats);
  }
}
