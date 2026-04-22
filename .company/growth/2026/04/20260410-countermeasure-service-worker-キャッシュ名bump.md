# Service Worker キャッシュ名bump

- **type**: `countermeasure`
- **date**: 2026-04-10
- **category**: devops / **severity**: low
- **status**: active
- **source**: daily-digest
- **tags**: pwa, service-worker, cache, claude-dev
- **commits**: 722ae71

## what_happened
stale bundleが配信される問題に対しSW cache nameをbumpして無効化。PWA更新時のキャッシュ不整合に対処。

## root_cause
Service Workerが古いbundleをキャッシュし続けていた

## countermeasure
sw.jsのcache nameを更新して強制invalidate

## result
新bundleが確実に配信されるように

<!-- id: 94ca6b45-4c03-4b68-ab53-775d317c12e7 -->
