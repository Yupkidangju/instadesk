// test/cryptoVault.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { cryptoVault, VaultLockedError, VaultInvalidPasswordError } from '../src/services/cryptoVault';

describe('CryptoVault E2EE & On-Demand Decryption', () => {
  beforeEach(() => {
    cryptoVault.resetVault();
  });

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
});
