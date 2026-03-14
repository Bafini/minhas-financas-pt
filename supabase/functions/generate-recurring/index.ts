import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const dayOfMonth = today.getDate();
  const dayOfWeek = today.getDay() || 7; // 1=Mon..7=Sun

  // Fetch active recurring rules where day matches
  const { data: rules, error: rulesError } = await supabase
    .from("recurring_rules")
    .select("*")
    .eq("is_active", true)
    .or(`end_date.is.null,end_date.gte.${todayStr}`);

  if (rulesError) {
    return new Response(JSON.stringify({ error: rulesError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let created = 0;

  for (const rule of rules || []) {
    const day = rule.day_of_period || 1;

    // Check if today matches the rule's frequency + day
    let shouldGenerate = false;

    if (rule.frequency === "daily") {
      shouldGenerate = true;
    } else if (rule.frequency === "weekly") {
      shouldGenerate = dayOfWeek === day;
    } else if (rule.frequency === "monthly") {
      shouldGenerate = dayOfMonth === day;
    } else if (rule.frequency === "quarterly") {
      const quarterMonths = [1, 4, 7, 10];
      shouldGenerate = quarterMonths.includes(today.getMonth() + 1) && dayOfMonth === day;
    } else if (rule.frequency === "yearly") {
      const startDate = new Date(rule.start_date);
      shouldGenerate = today.getMonth() === startDate.getMonth() && dayOfMonth === day;
    }

    if (!shouldGenerate) continue;

    // Check if already generated for today
    const { data: existing } = await supabase
      .from("transactions")
      .select("id")
      .eq("recurring_rule_id", rule.id)
      .eq("date", todayStr)
      .limit(1);

    if (existing && existing.length > 0) continue;

    // Create transaction
    const { error } = await supabase.from("transactions").insert({
      user_id: rule.user_id,
      date: todayStr,
      amount: rule.amount,
      notes: rule.name,
      category_id: rule.category_id,
      subcategory_id: rule.subcategory_id,
      macro_group: rule.macro_group,
      is_recurring: true,
      recurring_rule_id: rule.id,
    });

    if (!error) created++;
  }

  return new Response(JSON.stringify({ created, date: todayStr }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
