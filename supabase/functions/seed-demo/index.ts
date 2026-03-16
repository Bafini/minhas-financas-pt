import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEMO_EMAIL = "demo@demo.com";
const DEMO_PASSWORD = "demo";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    // Try to get existing demo user
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    let demoUser = existingUsers?.users?.find((u) => u.email === DEMO_EMAIL);

    if (!demoUser) {
      // Create demo user
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { display_name: "Utilizador Demo" },
      });
      if (error) throw error;
      demoUser = data.user;
    }

    const userId = demoUser.id;

    // Check if data already seeded
    const { count } = await supabaseAdmin
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (count && count > 0) {
      return new Response(JSON.stringify({ message: "already_seeded", userId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Seed categories
    const CATEGORIES = [
      { name: "Casa", group_type: "Despesas", subs: ["Crédito", "Água", "Luz", "Internet", "Gás", "Manutenção"] },
      { name: "Compras", group_type: "Despesas", subs: ["Supermercado", "Roupa", "Outros"] },
      { name: "Transportes", group_type: "Despesas", subs: ["Combustível", "Portagens", "Passe"] },
      { name: "Seguros", group_type: "Despesas", subs: ["Casa", "Carro", "Vida"] },
      { name: "Saúde", group_type: "Despesas", subs: ["Consulta", "Medicamentos"] },
      { name: "Subscrições", group_type: "Despesas", subs: ["Netflix", "Spotify", "Conta Bancária"] },
      { name: "Restaurantes", group_type: "Despesas", subs: ["Cantina", "Restaurantes"] },
      { name: "Educação", group_type: "Despesas", subs: ["Cursos", "Livros"] },
      { name: "Fun", group_type: "Despesas", subs: ["Cinema", "Prendas", "Eventos"] },
      { name: "Rendimentos", group_type: "Rendimentos", subs: ["Salário", "Subsídio Almoço", "Renda", "Extras"] },
      { name: "Investimentos", group_type: "Investimentos", subs: ["Fundos", "Ações", "PPR", "Crypto"] },
    ];

    const catMap: Record<string, { id: string; subs: Record<string, string> }> = {};

    for (const cat of CATEGORIES) {
      const { data: catRow } = await supabaseAdmin
        .from("categories")
        .insert({ user_id: userId, name: cat.name, group_type: cat.group_type })
        .select()
        .single();
      if (!catRow) continue;

      const subsInsert = cat.subs.map((name, idx) => ({
        category_id: catRow.id,
        user_id: userId,
        name,
        sort_order: idx,
      }));
      const { data: subsRows } = await supabaseAdmin.from("subcategories").insert(subsInsert).select();

      const subsMap: Record<string, string> = {};
      (subsRows || []).forEach((s: any) => { subsMap[s.name] = s.id; });
      catMap[cat.name] = { id: catRow.id, subs: subsMap };
    }

    // Generate transactions for 2025 and 2026 (up to March)
    const transactions: any[] = [];
    const years = [2025, 2026];

    for (const year of years) {
      const maxMonth = year === 2026 ? 3 : 12;
      for (let month = 1; month <= maxMonth; month++) {
        const d = (day: number) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

        // Salary - 1st of month
        transactions.push({
          user_id: userId, date: d(1), amount: 2200 + Math.round(Math.random() * 100),
          macro_group: "Rendimentos", category_id: catMap["Rendimentos"].id,
          subcategory_id: catMap["Rendimentos"].subs["Salário"], notes: "Salário mensal",
        });

        // Subsídio Almoço - 1st
        transactions.push({
          user_id: userId, date: d(1), amount: 120 + Math.round(Math.random() * 20),
          macro_group: "Rendimentos", category_id: catMap["Rendimentos"].id,
          subcategory_id: catMap["Rendimentos"].subs["Subsídio Almoço"], notes: "Subsídio de almoço",
        });

        // Renda - quarterly
        if (month % 3 === 1) {
          transactions.push({
            user_id: userId, date: d(5), amount: 450,
            macro_group: "Rendimentos", category_id: catMap["Rendimentos"].id,
            subcategory_id: catMap["Rendimentos"].subs["Renda"], notes: "Renda trimestral",
          });
        }

        // Crédito Habitação - 5th
        transactions.push({
          user_id: userId, date: d(5), amount: 580 + Math.round(Math.random() * 30),
          macro_group: "Despesas", category_id: catMap["Casa"].id,
          subcategory_id: catMap["Casa"].subs["Crédito"], notes: "Prestação do crédito",
        });

        // Utilities
        transactions.push({
          user_id: userId, date: d(8), amount: 25 + Math.round(Math.random() * 15),
          macro_group: "Despesas", category_id: catMap["Casa"].id,
          subcategory_id: catMap["Casa"].subs["Água"],
        });
        transactions.push({
          user_id: userId, date: d(10), amount: 45 + Math.round(Math.random() * 25),
          macro_group: "Despesas", category_id: catMap["Casa"].id,
          subcategory_id: catMap["Casa"].subs["Luz"],
        });
        transactions.push({
          user_id: userId, date: d(10), amount: 35,
          macro_group: "Despesas", category_id: catMap["Casa"].id,
          subcategory_id: catMap["Casa"].subs["Internet"],
        });

        // Supermercado - multiple per month
        for (let i = 0; i < 4; i++) {
          const day = Math.min(28, 3 + i * 7 + Math.round(Math.random() * 2));
          transactions.push({
            user_id: userId, date: d(day), amount: 60 + Math.round(Math.random() * 80),
            macro_group: "Despesas", category_id: catMap["Compras"].id,
            subcategory_id: catMap["Compras"].subs["Supermercado"],
          });
        }

        // Combustível
        transactions.push({
          user_id: userId, date: d(12), amount: 55 + Math.round(Math.random() * 20),
          macro_group: "Despesas", category_id: catMap["Transportes"].id,
          subcategory_id: catMap["Transportes"].subs["Combustível"],
        });

        // Subscriptions
        transactions.push({
          user_id: userId, date: d(15), amount: 15.99,
          macro_group: "Despesas", category_id: catMap["Subscrições"].id,
          subcategory_id: catMap["Subscrições"].subs["Netflix"],
        });
        transactions.push({
          user_id: userId, date: d(15), amount: 9.99,
          macro_group: "Despesas", category_id: catMap["Subscrições"].id,
          subcategory_id: catMap["Subscrições"].subs["Spotify"],
        });

        // Restaurantes
        for (let i = 0; i < 3; i++) {
          const day = Math.min(28, 6 + i * 8);
          transactions.push({
            user_id: userId, date: d(day), amount: 15 + Math.round(Math.random() * 25),
            macro_group: "Despesas", category_id: catMap["Restaurantes"].id,
            subcategory_id: catMap["Restaurantes"].subs["Restaurantes"],
          });
        }

        // Saúde - some months
        if (month % 2 === 0) {
          transactions.push({
            user_id: userId, date: d(18), amount: 30 + Math.round(Math.random() * 40),
            macro_group: "Despesas", category_id: catMap["Saúde"].id,
            subcategory_id: catMap["Saúde"].subs["Consulta"],
          });
        }

        // Investimentos - monthly
        transactions.push({
          user_id: userId, date: d(2), amount: 200 + Math.round(Math.random() * 100),
          macro_group: "Investimentos", category_id: catMap["Investimentos"].id,
          subcategory_id: catMap["Investimentos"].subs["Fundos"], notes: "DCA mensal",
        });
        transactions.push({
          user_id: userId, date: d(2), amount: 50 + Math.round(Math.random() * 50),
          macro_group: "Investimentos", category_id: catMap["Investimentos"].id,
          subcategory_id: catMap["Investimentos"].subs["PPR"],
        });

        // Fun - occasional
        if (month % 3 === 0) {
          transactions.push({
            user_id: userId, date: d(20), amount: 25 + Math.round(Math.random() * 30),
            macro_group: "Despesas", category_id: catMap["Fun"].id,
            subcategory_id: catMap["Fun"].subs["Cinema"],
          });
        }

        // Seguros - quarterly
        if (month % 3 === 0) {
          transactions.push({
            user_id: userId, date: d(1), amount: 85,
            macro_group: "Despesas", category_id: catMap["Seguros"].id,
            subcategory_id: catMap["Seguros"].subs["Carro"],
          });
        }
      }
    }

    // Insert in batches of 50
    for (let i = 0; i < transactions.length; i += 50) {
      const batch = transactions.slice(i, i + 50);
      const { error } = await supabaseAdmin.from("transactions").insert(batch);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ message: "seeded", userId, txCount: transactions.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
