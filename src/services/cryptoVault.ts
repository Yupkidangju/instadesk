// src/services/cryptoVault.ts
import { LocalVaultStorage, EncryptedProfileRecord } from '../types/vault';

const STORAGE_KEY = 'instabox_deck_vault_v1';
const VERIFIER_PLAINTEXT = 'INSTABOX_DECK_E2EE_VERIFIER_TOKEN_OK';
const LEGACY_ITERATIONS = 100_000;
const CURRENT_ITERATIONS = 600_000;
const MIN_PASSPHRASE_LENGTH = 15;

export class VaultLockedError extends Error {
  constructor(message = 'Vault is locked. Master password required.') {
    super(message);
    this.name = 'VaultLockedError';
  }
}

export class VaultInvalidPasswordError extends Error {
  constructor(message = 'Invalid master password.') {
    super(message);
    this.name = 'VaultInvalidPasswordError';
  }
}

// 런타임 메모리 상태 (세션 동안만 보관되며, 페이지 새로고침 시 초기화)
class CryptoVaultManager {
  private masterKey: CryptoKey | null = null;
  private operationEpoch = 0;
  private lastActivityAt: number = Date.now();
  private autoLockMinutes: number = 15;
  private autoLockTimer: NodeJS.Timeout | null = null;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.resetActivityTimer();
  }

  public getLastActivityAt(): number {
    return this.lastActivityAt;
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  private resetActivityTimer() {
    this.lastActivityAt = Date.now();
    if (this.autoLockTimer) {
      clearTimeout(this.autoLockTimer);
    }
    if (this.masterKey && this.autoLockMinutes > 0) {
      this.autoLockTimer = setTimeout(() => {
        this.lock();
      }, this.autoLockMinutes * 60 * 1000);
    }
  }

  public touch() {
    if (this.masterKey && this.autoLockMinutes > 0 &&
        Date.now() - this.lastActivityAt >= this.autoLockMinutes * 60 * 1000) {
      this.lock();
      return;
    }
    this.resetActivityTimer();
  }

  /**
   * 볼트가 로컬스토리지에 초기화되어 있는지 확인
   */
  public isInitialized(): boolean {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw !== null;
  }

  /**
   * 현재 마스터 키가 메모리에 잠금 해제되어 있는지 확인
   */
  public isUnlocked(): boolean {
    if (this.masterKey && this.autoLockMinutes > 0 &&
        Date.now() - this.lastActivityAt >= this.autoLockMinutes * 60 * 1000) this.lock();
    return this.masterKey !== null;
  }

  public getAutoLockMinutes(): number {
    return this.autoLockMinutes;
  }

  /**
   * 볼트 강제 잠금 (메모리에서 마스터 키 즉시 소멸)
   */
  public lock(): void {
    this.operationEpoch += 1;
    this.masterKey = null;
    if (this.autoLockTimer) {
      clearTimeout(this.autoLockTimer);
      this.autoLockTimer = null;
    }
    this.notify();
  }

  /**
   * 신규 볼트 생성 및 마스터 패스워드 설정
   */
  public async initializeVault(password: string, autoLockMinutes = 15): Promise<void> {
    if (this.isInitialized()) throw new Error('Vault already initialized.');
    const epoch = this.operationEpoch;
    if (!password || password.length < MIN_PASSPHRASE_LENGTH) {
      throw new Error('Master passphrase must be at least 15 characters.');
    }

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const derivedKey = await this.deriveKey(password, salt, CURRENT_ITERATIONS);

    // 비밀번호 검증용 토큰 암호화
    const verifierIv = crypto.getRandomValues(new Uint8Array(12));
    const verifierBytes = new TextEncoder().encode(VERIFIER_PLAINTEXT);
    const verifierEncrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: verifierIv },
      derivedKey,
      verifierBytes
    );

    const vaultData: LocalVaultStorage = {
      version: 2,
      salt: this.bytesToBase64(salt),
      verifierCiphertext: this.bytesToBase64(new Uint8Array(verifierEncrypted)),
      verifierIv: this.bytesToBase64(verifierIv),
      profiles: [],
      autoLockMinutes,
    };

    if (epoch !== this.operationEpoch || this.isInitialized()) throw new Error('Vault changed during initialization.');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(vaultData));
    this.masterKey = derivedKey;
    this.autoLockMinutes = autoLockMinutes;
    this.resetActivityTimer();
    this.notify();
  }

  /**
   * 마스터 비밀번호로 볼트 잠금 해제
   */
  public async unlock(password: string): Promise<boolean> {
    const epoch = this.operationEpoch;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      throw new Error('Vault is not initialized.');
    }

    const vaultData: LocalVaultStorage = JSON.parse(raw);
    if (vaultData.version !== 1 && vaultData.version !== 2) throw new Error('Unsupported vault version');
    const salt = this.base64ToBytes(vaultData.salt);
    const candidateKey = await this.deriveKey(password, salt, vaultData.version === 1 ? LEGACY_ITERATIONS : CURRENT_ITERATIONS);

    // 검증 토큰 복호화 테스트
    try {
      const verifierIv = this.base64ToBytes(vaultData.verifierIv);
      const ciphertext = this.base64ToBytes(vaultData.verifierCiphertext);

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: verifierIv as BufferSource },
        candidateKey,
        ciphertext as BufferSource
      );
      const decryptedText = new TextDecoder().decode(decrypted);

      if (decryptedText !== VERIFIER_PLAINTEXT) {
        throw new VaultInvalidPasswordError();
      }

    } catch {
      throw new VaultInvalidPasswordError();
    }
    // v1 원본을 유지한 채 전 프로필의 재암호화가 끝난 경우에만 한 번 저장한다.
    const activeKey = vaultData.version === 1
      ? await this.reencryptVault(vaultData, candidateKey, password, raw, epoch)
      : candidateKey;
    if (epoch !== this.operationEpoch) throw new VaultLockedError();
    this.masterKey = activeKey;
    this.autoLockMinutes = vaultData.autoLockMinutes || 15;
    this.resetActivityTimer();
    this.notify();
    return true;
  }

  public async changeMasterPassword(currentPassword: string, newPassword: string): Promise<void> {
    if (!this.isUnlocked()) throw new VaultLockedError();
    const epoch = this.operationEpoch;
    if (newPassword.length < MIN_PASSPHRASE_LENGTH) throw new Error('Master passphrase must be at least 15 characters.');
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error('Vault not found.');
    const data: LocalVaultStorage = JSON.parse(raw);
    const oldKey = await this.deriveKey(currentPassword, this.base64ToBytes(data.salt), data.version === 1 ? LEGACY_ITERATIONS : CURRENT_ITERATIONS);
    try {
      const verifier = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: this.base64ToBytes(data.verifierIv) as BufferSource }, oldKey,
        this.base64ToBytes(data.verifierCiphertext) as BufferSource);
      if (new TextDecoder().decode(verifier) !== VERIFIER_PLAINTEXT) throw new VaultInvalidPasswordError();
    } catch { throw new VaultInvalidPasswordError(); }
    const nextKey = await this.reencryptVault(data, oldKey, newPassword, raw, epoch);
    if (epoch !== this.operationEpoch) throw new VaultLockedError();
    this.masterKey = nextKey;
    this.resetActivityTimer();
    this.notify();
  }

  private async reencryptVault(data: LocalVaultStorage, oldKey: CryptoKey, newPassword: string, original: string, epoch: number): Promise<CryptoKey> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const newKey = await this.deriveKey(newPassword, salt, CURRENT_ITERATIONS);
    const verifierIv = crypto.getRandomValues(new Uint8Array(12));
    const verifierCiphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: verifierIv }, newKey,
      new TextEncoder().encode(VERIFIER_PLAINTEXT));
    const profiles = [] as EncryptedProfileRecord[];
    for (const record of data.profiles) {
      const parts = record.encryptedData.split(':');
      if (parts.length !== 2) throw new Error('Corrupt vault profile');
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: this.base64ToBytes(parts[0]) as BufferSource },
        oldKey, this.base64ToBytes(parts[1]) as BufferSource);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, newKey, plain);
      profiles.push({ ...record, encryptedData: `${this.bytesToBase64(iv)}:${this.bytesToBase64(new Uint8Array(encrypted))}` });
    }
    const next: LocalVaultStorage = { ...data, version: 2, salt: this.bytesToBase64(salt),
      verifierIv: this.bytesToBase64(verifierIv), verifierCiphertext: this.bytesToBase64(new Uint8Array(verifierCiphertext)), profiles };
    if (epoch !== this.operationEpoch || localStorage.getItem(STORAGE_KEY) !== original) {
      throw new Error('Vault changed during migration. Retry after reopening.');
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return newKey;
  }

  /**
   * 암호화된 프로필 목록 조회 (메타데이터만 반환)
   */
  public listProfiles(): Array<{ id: string; label: string; createdAt: string; lastUsedAt: string | null }> {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const vaultData: LocalVaultStorage = JSON.parse(raw);
      return vaultData.profiles.map((p) => ({
        id: p.id,
        label: p.label,
        createdAt: p.createdAt,
        lastUsedAt: p.lastUsedAt,
      }));
    } catch {
      return [];
    }
  }

  /**
   * 새로운 API 키를 암호화하여 로컬스토리지에 추가
   */
  public async addProfile(label: string, apiKey: string, keyHint?: string): Promise<string> {
    if (!this.isUnlocked()) {
      throw new VaultLockedError();
    }
    const cleanKey = apiKey.trim();
    if (!cleanKey) {
      throw new Error('API Key cannot be empty.');
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error('Vault not initialized');
    const vaultData: LocalVaultStorage = JSON.parse(raw);

    const id = crypto.randomUUID();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintextBytes = new TextEncoder().encode(cleanKey);

    const sessionKey = this.masterKey;
    if (!sessionKey) throw new VaultLockedError();
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      sessionKey,
      plaintextBytes
    );
    if (this.masterKey !== sessionKey || localStorage.getItem(STORAGE_KEY) !== raw) throw new VaultLockedError();

    // iv:ciphertext 결합 포맷
    const payload = `${this.bytesToBase64(iv)}:${this.bytesToBase64(new Uint8Array(encrypted))}`;

    const newRecord: EncryptedProfileRecord = {
      id,
      label,
      encryptedData: payload,
      keyHint,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
    };

    vaultData.profiles.push(newRecord);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(vaultData));
    this.notify();
    return id;
  }

  /**
   * 프로필 삭제
   */
  public removeProfile(id: string): void {
    if (!this.isUnlocked()) throw new VaultLockedError();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const vaultData: LocalVaultStorage = JSON.parse(raw);
    vaultData.profiles = vaultData.profiles.filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(vaultData));
    this.notify();
  }

  /**
   * [소비 시점 복호화(On-Demand Decryption)] 핵심 함수
   * 평문 키를 어디에도 영구 반환하지 않고, 콜백 함수 실행 중에만 전달한 후 즉시 소멸
   */
  public async withDecryptedKey<T>(
    profileId: string,
    consumer: (apiKey: string) => Promise<T>
  ): Promise<T> {
    // 1. 데모 프로필인 경우 즉시 데모 키로 실행
    if (profileId.startsWith('demo-')) {
      return await consumer('ibk_demo_swiss_dev_0123456789abcdef');
    }

    // 2. 잠금 상태 확인
    if (!this.isUnlocked()) {
      throw new VaultLockedError();
    }

    const sessionKey = this.masterKey;
    if (!sessionKey) throw new VaultLockedError();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error('Vault not found.');
    const vaultData: LocalVaultStorage = JSON.parse(raw);
    const record = vaultData.profiles.find((p) => p.id === profileId);

    if (!record) {
      throw new Error(`Profile ${profileId} not found in encrypted vault.`);
    }

    // 3. 일회성 복호화
    const [ivB64, cipherB64] = record.encryptedData.split(':');
    const iv = this.base64ToBytes(ivB64);
    const ciphertext = this.base64ToBytes(cipherB64);

    let decryptedKey = '';
    try {
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as BufferSource },
        sessionKey,
        ciphertext as BufferSource
      );
      decryptedKey = new TextDecoder().decode(decryptedBuffer);
    } catch {
      throw new Error('Decryption failed. Vault record may be corrupted.');
    }

    if (this.masterKey !== sessionKey) throw new VaultLockedError();

    // 자동 조회가 늦게 끝나도 새로 추가된 프로필을 과거 스냅샷으로 덮지 않는다.
    const latestRaw = localStorage.getItem(STORAGE_KEY);
    if (!latestRaw) throw new VaultLockedError();
    const latest: LocalVaultStorage = JSON.parse(latestRaw);
    const latestRecord = latest.profiles.find((profile) => profile.id === profileId);
    if (!latestRecord || latestRecord.encryptedData !== record.encryptedData) throw new VaultLockedError();
    latestRecord.lastUsedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(latest));

    // 5. 소비 콜백 실행 후 메모리 소멸
    try {
      const result = await consumer(decryptedKey);
      return result;
    } finally {
      // 덮어쓰기 가비지 컬렉션 유도
      decryptedKey = '';
    }
  }

  /**
   * 전체 볼트 리셋 (모든 데이터 삭제)
   */
  public resetVault(): void {
    this.operationEpoch += 1;
    localStorage.removeItem(STORAGE_KEY);
    this.masterKey = null;
    if (this.autoLockTimer) {
      clearTimeout(this.autoLockTimer);
      this.autoLockTimer = null;
    }
    this.notify();
  }

  // --- 내부 헬퍼 함수 ---
  private async deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}

export const cryptoVault = new CryptoVaultManager();
