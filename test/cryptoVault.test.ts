// test/cryptoVault.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cryptoVault, VaultLockedError, VaultInvalidPasswordError } from '../src/services/cryptoVault';

describe('CryptoVault E2EE & On-Demand Decryption', () => {
  beforeEach(() => {
    cryptoVault.resetVault();
  });
  afterEach(() => vi.useRealTimers());

  it('should initialize vault and lock/unlock with master password', async () => {
    expect(cryptoVault.isInitialized()).toBe(false);
    expect(cryptoVault.isUnlocked()).toBe(false);

    // 1. 초기화
    await cryptoVault.initializeVault('MasterSecret123!');
    expect(cryptoVault.isInitialized()).toBe(true);
    expect(cryptoVault.isUnlocked()).toBe(true);

    // 2. 잠금
    cryptoVault.lock();
    expect(cryptoVault.isUnlocked()).toBe(false);

    // 3. 잘못된 비밀번호로 언락 시도 시 예외 발생
    await expect(cryptoVault.unlock('WrongPassword')).rejects.toThrow(VaultInvalidPasswordError);
    expect(cryptoVault.isUnlocked()).toBe(false);

    // 4. 올바른 비밀번호로 언락
    const success = await cryptoVault.unlock('MasterSecret123!');
    expect(success).toBe(true);
    expect(cryptoVault.isUnlocked()).toBe(true);
  });

  it('should encrypt API keys into localStorage and decrypt strictly on-demand', async () => {
    await cryptoVault.initializeVault('SafePassword2026');

    const testKey = 'ibk_52characterstestkeyforinstaboxmicrovmcloudplatform012';
    const profileId = await cryptoVault.addProfile('01 // PROD_WORKSPACE', testKey);

    expect(profileId).toBeDefined();

    // 1. localStorage 확인: 평문 키가 절대 존재하지 않아야 함
    const rawStorage = localStorage.getItem('instabox_deck_vault_v1');
    expect(rawStorage).not.toBeNull();
    expect(rawStorage).not.toContain(testKey); // 평문 노출 없음!

    // 2. on-demand 소비 테스트: withDecryptedKey로 소비 중에만 키가 주어짐
    let consumedKey = '';
    const result = await cryptoVault.withDecryptedKey(profileId, async (key) => {
      consumedKey = key;
      return { success: true, keyLength: key.length };
    });

    expect(result.success).toBe(true);
    expect(result.keyLength).toBe(testKey.length);
    expect(consumedKey).toBe(testKey);

    // 3. 볼트가 잠긴 경우 소비 시도 시 VaultLockedError 발생
    cryptoVault.lock();
    await expect(
      cryptoVault.withDecryptedKey(profileId, async () => 'test')
    ).rejects.toThrow(VaultLockedError);
  });

  it('should support demo profile without master password', async () => {
    cryptoVault.lock();
    const result = await cryptoVault.withDecryptedKey('demo-default', async (key) => {
      return key.startsWith('ibk_demo_');
    });
    expect(result).toBe(true);
  });

  it('does not treat background key consumption as activity', async () => {
    vi.useFakeTimers();
    await cryptoVault.initializeVault('long-test-passphrase-2026');
    const id = await cryptoVault.addProfile('test', 'ibk_test');
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    await cryptoVault.withDecryptedKey(id, async () => undefined);
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(cryptoVault.isUnlocked()).toBe(false);
  });

  it('extends the timer only when explicit user activity is recorded', async () => {
    vi.useFakeTimers();
    await cryptoVault.initializeVault('long-test-passphrase-2026');
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    cryptoVault.touch();
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(cryptoVault.isUnlocked()).toBe(true);
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(cryptoVault.isUnlocked()).toBe(false);
  });

  it('does not revive an overdue vault when timers were paused', async () => {
    vi.useFakeTimers();
    await cryptoVault.initializeVault('long-test-passphrase-2026');
    const id = await cryptoVault.addProfile('test', 'ibk_test');
    vi.setSystemTime(Date.now() + 16 * 60_000);
    cryptoVault.touch();
    expect(cryptoVault.isUnlocked()).toBe(false);
    await expect(cryptoVault.withDecryptedKey(id, async () => undefined)).rejects.toThrow(VaultLockedError);
  });

  it('writes v2 records with the stronger work factor and enforces long new passphrases', async () => {
    await expect(cryptoVault.initializeVault('short')).rejects.toThrow();
    await cryptoVault.initializeVault('long-test-passphrase-2026');
    const data = JSON.parse(localStorage.getItem('instabox_deck_vault_v1')!);
    expect(data.version).toBe(2);
  });

  it('migrates a legacy v1 profile without losing its key, then changes the passphrase', async () => {
    const password = 'legacy7';
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
      material, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
    const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
    const encrypt = async (text: string) => {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text)));
      return { iv: b64(iv), ciphertext: b64(ciphertext) };
    };
    const verifier = await encrypt('INSTABOX_DECK_E2EE_VERIFIER_TOKEN_OK');
    const legacyProfiles = [];
    for (let index = 0; index < 5; index++) {
      const profile = await encrypt(`ibk_legacy_${index}`);
      legacyProfiles.push({ id: index === 0 ? 'legacy-id' : `legacy-${index}`, label: `Legacy ${index}`,
        encryptedData: `${profile.iv}:${profile.ciphertext}`,
        createdAt: '2026-11-01T00:00:00Z', lastUsedAt: null });
    }
    localStorage.setItem('instabox_deck_vault_v1', JSON.stringify({ version: 1, salt: b64(salt),
      verifierIv: verifier.iv, verifierCiphertext: verifier.ciphertext, autoLockMinutes: 15,
      profiles: legacyProfiles }));
    const original = localStorage.getItem('instabox_deck_vault_v1');
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage full'); });
    await expect(cryptoVault.unlock(password)).rejects.toThrow('storage full');
    expect(localStorage.getItem('instabox_deck_vault_v1')).toBe(original);
    expect(cryptoVault.isUnlocked()).toBe(false);
    write.mockRestore();
    await cryptoVault.unlock(password);
    expect(JSON.parse(localStorage.getItem('instabox_deck_vault_v1')!).version).toBe(2);
    expect(cryptoVault.listProfiles()).toHaveLength(5);
    for (let index = 0; index < 5; index++) {
      expect(await cryptoVault.withDecryptedKey(index === 0 ? 'legacy-id' : `legacy-${index}`, async value => value))
        .toBe(`ibk_legacy_${index}`);
    }
    await cryptoVault.changeMasterPassword(password, 'new-long-passphrase-2026');
    cryptoVault.lock();
    await expect(cryptoVault.unlock(password)).rejects.toThrow(VaultInvalidPasswordError);
    await cryptoVault.unlock('new-long-passphrase-2026');
    expect(cryptoVault.listProfiles()).toHaveLength(5);
    expect(await cryptoVault.withDecryptedKey('legacy-id', async value => value)).toBe('ibk_legacy_0');
  });

  it('preserves a newly added profile when a polling decrypt finishes later', async () => {
    await cryptoVault.initializeVault('long-test-passphrase-2026');
    const first = await cryptoVault.addProfile('First', 'ibk_first');
    const decrypt = crypto.subtle.decrypt.bind(crypto.subtle);
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const spy = vi.spyOn(crypto.subtle, 'decrypt').mockImplementation(async (...args) => {
      await gate;
      return decrypt(...args);
    });
    const polling = cryptoVault.withDecryptedKey(first, async () => undefined);
    await cryptoVault.addProfile('Second', 'ibk_second');
    release();
    await polling;
    expect(cryptoVault.listProfiles().map(profile => profile.label)).toEqual(['First', 'Second']);
    spy.mockRestore();
  });

  it('keeps five encrypted profiles after lock and unlock without storing plaintext', async () => {
    await cryptoVault.initializeVault('long-test-passphrase-2026');
    const ids: string[] = [];
    for (let index = 0; index < 5; index++) {
      ids.push(await cryptoVault.addProfile(`VM ${index + 1}`, `ibk_fixture_${index + 1}`));
    }
    cryptoVault.lock();
    expect(cryptoVault.listProfiles()).toHaveLength(5);
    await cryptoVault.unlock('long-test-passphrase-2026');
    expect(cryptoVault.listProfiles()).toHaveLength(5);
    for (let index = 0; index < 5; index++) {
      expect(await cryptoVault.withDecryptedKey(ids[index], async key => key)).toBe(`ibk_fixture_${index + 1}`);
    }
    const raw = localStorage.getItem('instabox_deck_vault_v1')!;
    expect(raw).not.toContain('ibk_fixture_');
  });
});
