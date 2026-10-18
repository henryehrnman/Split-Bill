/// <reference types="expo/types" />
import React, {useEffect, useMemo, useRef} from 'react';
import {router, useLocalSearchParams} from 'expo-router';
import {api} from '../lib/api';
import type {Db} from '../lib/domain';
import {useSession} from '../lib/session';
import {useStore} from '../lib/store';
import {projectPhoneSnapshot} from './phoneModel';
import {createPhoneBridge} from './phoneBridge';
import {mountPhone} from './phoneRuntime';

type PhoneRoute = {type: string; id?: string; tab?: string};

export default function PhoneApp() {
  const store = useStore();
  const session = useSession();
  const params = useLocalSearchParams<{view?: string; entity?: string; tab?: string}>();
  const host = useRef<HTMLElement>(null);
  const runtime = useRef<ReturnType<typeof mountPhone> | null>(null);
  const current = useRef({store, session, params});

  const snapshot = useMemo(() => ({
    ...projectPhoneSnapshot(store.db, store.viewer.id, store.now),
    busy: store.busy,
    demoMode: store.demoMode,
    live: store.live,
    route: {type: params.view || params.tab || 'home', id: params.entity, tab: params.tab},
  }), [store.db, store.viewer.id, store.now, store.busy, store.demoMode, store.live, params.view, params.entity, params.tab]);
  const latestSnapshot = useRef(snapshot);

  useEffect(() => {
    current.current = {store, session, params};
    latestSnapshot.current = snapshot;
  }, [store, session, params, snapshot]);

  useEffect(() => {
    if (!host.current) return;
    const backend = createPhoneBridge({
      api,
      run: (call, success) => current.current.store.run(call, success),
      getViewerId: () => current.current.store.viewer.id,
    });
    const bridge = {
      ...backend,
      initialSnapshot: latestSnapshot.current,
      snapshot: (db?: Db) => ({
        ...projectPhoneSnapshot(db ?? current.current.store.db, current.current.store.viewer.id, current.current.store.now),
        busy: current.current.store.busy,
        demoMode: current.current.store.demoMode,
        live: current.current.store.live,
      }),
      get route(): PhoneRoute {
        const route = current.current.params;
        return {type: route.view || route.tab || 'home', id: route.entity, tab: route.tab};
      },
      navigate: (route: PhoneRoute) => router.setParams({view: route.type, entity: route.id, tab: route.tab}),
      refresh: () => current.current.store.refresh(),
      selectGroup: (id: string) => current.current.store.setGroupId(id),
      session: {
        get demoMode() { return current.current.store.demoMode; },
        signOut: () => current.current.session.signOut(),
        enterDemo: () => current.current.session.enterDemo(),
        exitDemo: () => current.current.session.exitDemo(),
        setViewerId: (id: string) => current.current.store.setViewerId(id),
      },
    };
    const mounted = mountPhone(host.current, bridge);
    runtime.current = mounted;
    mounted.update(latestSnapshot.current);
    return () => {
      mounted.destroy();
      runtime.current = null;
    };
  }, []);

  useEffect(() => { runtime.current?.update(snapshot); }, [snapshot]);

  return <div className="phone-host">
    <main ref={host} className="phone" aria-label="chipin application" aria-busy={store.busy}>
      <div id="app" className="app" />
      <div id="toast" className="toast" role="status" aria-live="polite" />
      <div id="modal-root" />
      {store.notice && <div className="phone-notice" role={store.notice.kind === 'error' ? 'alert' : 'status'}>
        <span>{store.notice.text}</span>
        <button type="button" onClick={store.clearNotice} aria-label="Dismiss message">×</button>
      </div>}
    </main>
  </div>;
}
