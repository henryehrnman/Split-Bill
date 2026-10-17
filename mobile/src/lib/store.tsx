import React, {createContext, useCallback, useContext, useEffect, useState} from 'react';
import {Text, View} from 'react-native';
import {api, now} from './api';
import {ApiError, groupsFor} from './domain';
import type {Db, Group, User} from './domain';
import type {UserId} from './split';

export type Notice = {kind: 'error' | 'success'; text: string};
type Ctx = {
  db: Db;
  now: number;
  viewer: User;
  setViewerId: (id: UserId) => void;
  group: Group | null;
  setGroupId: (id: string) => void;
  busy: boolean;
  notice: Notice | null;
  clearNotice: () => void;
  run: (call: (actor: UserId) => Promise<Db>, success?: string) => Promise<Db | null>;
};

const Context = createContext<Ctx | null>(null);

// Client session state. The viewer switcher stands in for signing in as different people.
export function StoreProvider({children}: {children: React.ReactNode}) {
  const [db, setDb] = useState<Db | null>(null);
  const [viewerId, setViewerId] = useState<UserId>('u_henry');
  const [groupId, setGroupId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    api.fetch().then(setDb, () => setLoadError('Could not start the demo backend.'));
  }, []);

  const run = useCallback(async (call: (actor: UserId) => Promise<Db>, success?: string) => {
    setBusy(true);
    try {
      const next = await call(viewerId);
      setDb(next);
      setNotice(success ? {kind: 'success', text: success} : null);
      return next;
    } catch (e) {
      setNotice({kind: 'error', text: e instanceof ApiError ? e.message : 'Something went wrong. Try again.'});
      return null;
    } finally {
      setBusy(false);
    }
  }, [viewerId]);

  if (!db) {
    return (
      <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'white'}}>
        <Text>{loadError || 'Loading Split Bill…'}</Text>
      </View>
    );
  }

  const viewer = db.users.find(u => u.id === viewerId) ?? db.users[0];
  const groups = groupsFor(db, viewer.id);
  const group = groups.find(g => g.id === groupId) ?? groups[0] ?? null;

  return (
    <Context.Provider
      value={{
        db,
        now: now(db),
        viewer,
        setViewerId: id => {
          setViewerId(id);
          setNotice(null);
        },
        group,
        setGroupId,
        busy,
        notice,
        clearNotice: () => setNotice(null),
        run,
      }}>
      {children}
    </Context.Provider>
  );
}

export function useStore() {
  const x = useContext(Context);
  if (!x) throw Error('Missing StoreProvider');
  return x;
}
