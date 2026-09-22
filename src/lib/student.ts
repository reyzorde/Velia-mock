import { supabase } from './supabase';

export type StudentLink = {
  id: string;
  full_name: string;
  center_id: string;
};

export async function resolveStudent(email: string | undefined): Promise<StudentLink | null> {
  if (!email) return null;
  const { data } = await supabase
    .from('students')
    .select('id, full_name, center_id, status')
    .ilike('email', email)
    .eq('status', 'active')
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, full_name: data.full_name, center_id: data.center_id };
}
