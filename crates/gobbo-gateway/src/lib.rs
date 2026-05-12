//! Gateway frame protocol and idempotency cache.

use std::collections::HashMap;
use std::time::{Duration, Instant};

const TTL: Duration = Duration::from_secs(300);
const MAX_ENTRIES: usize = 1_024;

/// In-memory idempotency cache keyed by request UUID (represented as String
/// to keep the crate dependency-free in this lightweight stub).
#[derive(Default)]
pub struct IdempotencyCache {
    inner: HashMap<String, Entry>,
}

#[derive(Clone)]
struct Entry {
    result: Vec<u8>,
    inserted: Instant,
}

impl IdempotencyCache {
    pub fn new() -> Self {
        Self {
            inner: HashMap::with_capacity(MAX_ENTRIES),
        }
    }

    pub fn get(&mut self, key: &str) -> Option<Vec<u8>> {
        if let Some(entry) = self.inner.get(key) {
            if entry.inserted.elapsed() <= TTL {
                return Some(entry.result.clone());
            }
        }
        self.inner.remove(key);
        None
    }

    pub fn record(&mut self, key: String, result: Vec<u8>) {
        if self.inner.len() >= MAX_ENTRIES {
            self.evict_oldest();
        }
        self.inner.insert(
            key,
            Entry {
                result,
                inserted: Instant::now(),
            },
        );
    }

    fn evict_oldest(&mut self) {
        if let Some(oldest_key) = self
            .inner
            .iter()
            .min_by_key(|(_, e)| e.inserted)
            .map(|(k, _)| k.clone())
        {
            self.inner.remove(&oldest_key);
        }
    }

    pub fn len(&self) -> usize {
        self.inner.len()
    }

    pub fn is_empty(&self) -> bool {
        self.inner.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn record_and_get_returns_stored_value() {
        let mut cache = IdempotencyCache::new();
        cache.record("abc".to_string(), b"hello".to_vec());
        assert_eq!(cache.get("abc"), Some(b"hello".to_vec()));
    }

    #[test]
    fn unknown_key_returns_none() {
        let mut cache = IdempotencyCache::new();
        assert!(cache.get("missing").is_none());
    }
}
