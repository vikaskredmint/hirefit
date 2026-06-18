import { createClient } from "@supabase/supabase-js";
import { config } from "../config.js";

export const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export const fromSingle = async (query, message) => {
  const { data, error } = await query;
  if (error) throw new Error(`${message}: ${error.message}`);
  return data;
};
