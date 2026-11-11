import { supabase } from '../config/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

// Minimal shape the sync needs. (It used to have `[key: string]: unknown`, which
// TypeScript won't match against the app's `Medicine` interface.)
interface MedicineRecord {
  id: string;
  createdAt?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Save (upsert) a single medicine to the cloud for the given user.
 */
export async function saveMedicineToCloud(
  uid: string,
  medicine: MedicineRecord
): Promise<void> {
  const { error } = await supabase.from('medicines').upsert(
    { ...medicine, user_id: uid },
    { onConflict: 'id' }
  );
  if (error) console.warn('saveMedicineToCloud error:', error.message);
}

/**
 * Replace all cloud medicines for a user with the given list (used on first sync).
 */
export async function saveAllMedicinesToCloud(
  uid: string,
  medicines: MedicineRecord[]
): Promise<void> {
  // Delete existing rows for this user first
  const { error: deleteError } = await supabase
    .from('medicines')
    .delete()
    .eq('user_id', uid);

  if (deleteError) {
    console.warn('saveAllMedicinesToCloud delete error:', deleteError.message);
    return;
  }

  if (medicines.length === 0) return;

  const rows = medicines.map((m) => ({ ...m, user_id: uid }));
  const { error: insertError } = await supabase.from('medicines').insert(rows);
  if (insertError) {
    console.warn('saveAllMedicinesToCloud insert error:', insertError.message);
  }
}

/**
 * Delete a single medicine from the cloud.
 */
export async function deleteMedicineFromCloud(
  uid: string,
  medicineId: string
): Promise<void> {
  const { error } = await supabase
    .from('medicines')
    .delete()
    .eq('id', medicineId)
    .eq('user_id', uid);
  if (error) console.warn('deleteMedicineFromCloud error:', error.message);
}

/**
 * Subscribe to realtime changes on the user's medicines.
 * Returns an unsubscribe function.
 */
export function subscribeMedicines(
  uid: string,
  onData: (medicines: MedicineRecord[]) => void,
  onError?: (error: Error) => void
): () => void {
  // Initial fetch
  supabase
    .from('medicines')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .then(({ data, error }) => {
      if (error) {
        onError?.(new Error(error.message));
      } else {
        onData((data ?? []) as MedicineRecord[]);
      }
    });

  // Realtime subscription
  const channel = supabase
    .channel(`medicines:${uid}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'medicines',
        filter: `user_id=eq.${uid}`,
      },
      async () => {
        // Re-fetch on any change
        const { data, error } = await supabase
          .from('medicines')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: false });

        if (error) {
          onError?.(new Error(error.message));
        } else {
          onData((data ?? []) as MedicineRecord[]);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
