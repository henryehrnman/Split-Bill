import {AppState} from 'react-native';
import {supabase} from './auth';

// The server publishes only a version ping. Financial data always comes from RPC.
export function subscribeToChanges(userId: string, groupId: string | null, refresh: () => void, status: (live: boolean) => void) {
  if (!supabase) return () => {};
  let active = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    if (!active || timer) return;
    timer = setTimeout(() => { timer = undefined; if (active) refresh(); }, 250);
  };
  const channel = supabase.channel(`state:${userId}:${groupId ?? 'invites'}`)
    .on('postgres_changes', {event: 'UPDATE', schema: 'public', table: 'app_state_ping', filter: 'id=eq.1'}, schedule)
    .subscribe(state => {
      if (!active) return;
      status(state === 'SUBSCRIBED');
      if (state === 'SUBSCRIBED') schedule();
    });
  const foreground = AppState.addEventListener('change', state => { if (state === 'active') schedule(); });
  // Also refresh clock-driven rules and recover if Realtime is temporarily unavailable.
  const poll = setInterval(() => { if (AppState.currentState === 'active') schedule(); }, 15000);
  return () => {
    active = false;
    clearTimeout(timer);
    clearInterval(poll);
    foreground.remove();
    void supabase?.removeChannel(channel);
  };
}
