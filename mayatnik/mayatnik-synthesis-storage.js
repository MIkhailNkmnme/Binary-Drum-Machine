/* СИН-001 · v0.001. Page-local storage boundary, installed before application scripts. */
(() => {
  'use strict';
  const PREFIX = 'zerk-mayatnik-synthesis:';
  const SHARED_DB = 'zerkalius-bitoteka';

  function stopBoot(error) {
    // A failed boundary must never continue with the ordinary Maятник stores.
    window.stop();
    document.open();
    document.write('<!doctype html><html lang="ru"><meta charset="utf-8"><title>Синтез · ошибка памяти</title><body style="background:#0e1116;color:#eee;font:16px sans-serif;padding:24px"><h1>Маятник · Синтез не запущен</h1><p>Браузер не разрешил отдельную память Синтеза. Обычная страница Маятника не затронута. Откройте Синтез в браузере с поддержкой изоляции памяти.</p></body></html>');
    document.close();
    throw new Error('Synthesis storage isolation is unavailable; application stopped.', { cause: error });
  }

  function storageAdapter(native) {
    // Bind before replacing window properties: Storage methods require the native receiver.
    const get = native.getItem.bind(native), set = native.setItem.bind(native);
    const remove = native.removeItem.bind(native), key = native.key.bind(native);
    function keys() {
      const result = [];
      for (let i = 0; i < native.length; i++) {
        const name = key(i);
        if (name !== null && name.startsWith(PREFIX)) result.push(name.slice(PREFIX.length));
      }
      return result;
    }
    const methods = {
      getItem(name) { return get(PREFIX + String(name)); },
      setItem(name, value) { set(PREFIX + String(name), String(value)); },
      removeItem(name) { remove(PREFIX + String(name)); },
      clear() { keys().forEach(name => remove(PREFIX + name)); },
      key(index) { return keys()[Number(index) >>> 0] ?? null; }
    };
    // Also support Storage's named properties and Object.keys/entries used by backups.
    return new Proxy(Object.create(null), {
      get(_, name) {
        if (name === 'length') return keys().length;
        if (typeof name === 'symbol') return name === Symbol.toStringTag ? 'Storage' : undefined;
        if (Object.prototype.hasOwnProperty.call(methods, name)) return methods[name];
        return get(PREFIX + name) ?? undefined;
      },
      set(_, name, value) {
        if (typeof name !== 'string' || name === 'length' || Object.prototype.hasOwnProperty.call(methods, name)) return false;
        set(PREFIX + name, String(value)); return true;
      },
      deleteProperty(_, name) { if (typeof name === 'string') remove(PREFIX + name); return true; },
      ownKeys() { return keys(); },
      has(_, name) { return name === 'length' || Object.prototype.hasOwnProperty.call(methods, name) || typeof name === 'string' && get(PREFIX + name) !== null; },
      getOwnPropertyDescriptor(_, name) {
        if (typeof name !== 'string') return undefined;
        const value = get(PREFIX + name);
        return value === null ? undefined : { value, writable: true, enumerable: true, configurable: true };
      },
      defineProperty(_, name, descriptor) {
        if (typeof name !== 'string' || !('value' in descriptor) || descriptor.configurable === false) return false;
        set(PREFIX + name, String(descriptor.value)); return true;
      },
      preventExtensions() { return false; }
    });
  }

  try {
    const local = storageAdapter(window.localStorage);
    const session = storageAdapter(window.sessionStorage);
    const factory = window.indexedDB;
    if (!factory) throw new Error('IndexedDB is unavailable');
    const nativeOpen = factory.open.bind(factory), nativeDelete = factory.deleteDatabase.bind(factory);
    const databaseName = value => String(value) === SHARED_DB ? SHARED_DB : PREFIX + String(value);
    const databaseMethods = {
      open(name, ...args) { return nativeOpen(databaseName(name), ...args); },
      deleteDatabase(name, ...args) { return nativeDelete(databaseName(name), ...args); }
    };
    if (typeof factory.databases === 'function') {
      const databases = factory.databases.bind(factory);
      databaseMethods.databases = async () => (await databases())
        .filter(db => db.name === SHARED_DB || db.name?.startsWith(PREFIX))
        .map(db => ({ ...db, name: db.name === SHARED_DB ? db.name : db.name.slice(PREFIX.length) }));
    }
    const indexed = new Proxy(Object.create(null), {
      get(_, name) {
        if (Object.prototype.hasOwnProperty.call(databaseMethods, name)) return databaseMethods[name];
        const value = Reflect.get(factory, name, factory);
        return typeof value === 'function' ? value.bind(factory) : value;
      }
    });
    // Only this window changes. Other tabs and Storage/IDBFactory prototypes stay native.
    Object.defineProperties(window, {
      localStorage: { value: local, configurable: false, writable: false },
      sessionStorage: { value: session, configurable: false, writable: false },
      indexedDB: { value: indexed, configurable: false, writable: false }
    });
    window.MayatnikSynthesisStorage = Object.freeze({ prefix: PREFIX, sharedDatabase: SHARED_DB });
  } catch (error) { stopBoot(error); }
})();
