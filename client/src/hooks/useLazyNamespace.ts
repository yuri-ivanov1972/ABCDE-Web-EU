import { useState, useEffect } from 'react';
import i18n from 'i18next';
import { lazyLoadNamespace } from '@/i18n';

/**
 * Lazily loads one or more page-specific i18n namespaces that are NOT in the
 * initial bundle. Returns true once all requested namespaces are available.
 * On subsequent renders (namespace already cached) it returns true immediately.
 */
export function useLazyNamespace(namespace: string | string[]): boolean {
  const namespaces = Array.isArray(namespace) ? namespace : [namespace];

  const allLoaded = () =>
    namespaces.every((ns) => i18n.hasResourceBundle('lv', ns));

  const [ready, setReady] = useState(allLoaded);

  useEffect(() => {
    if (ready) return;
    Promise.all(namespaces.map(lazyLoadNamespace)).then(() => setReady(true));
  }, []);

  return ready;
}
