// src/services/cryptoVault.ts
import { LocalVaultStorage, EncryptedProfileRecord } from '../types/vault';

const STORAGE_KEY = 'instabox_deck_vault_v1';
const VERIFIER_PLAINTEXT = 'INSTABOX_DECK_E2EE_VERIFIER_TOKEN_OK';
const PBKDF2_ITERATIONS = 100_000;

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
    return this.masterKey !== null;
  }

  public getAutoLockMinutes(): number {
    return this.autoLockMinutes;
  }

  /**
   * 볼트 강제 잠금 (메모리에서 마스터 키 즉시 소멸)
   */
  public lock(): void {
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
    if (!password || password.length < 6) {
      throw new Error('Master password must be at least 6 characters.');
    }

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const derivedKey = await this.deriveKey(password, salt);

    // 비밀번호 검증용 토큰 암호화
    const verifierIv = crypto.getRandomValues(new Uint8Array(12));
    const verifierBytes = new TextEncoder().encode(VERIFIER_PLAINTEXT);
    const verifierEncrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: verifierIv },
      derivedKey,
      verifierBytes
    );

    const vaultData: LocalVaultStorage = {
      version: 1,
      salt: this.bytesToBase64(salt),
      verifierCiphertext: this.bytesToBase64(new Uint8Array(verifierEncrypted)),
      verifierIv: this.bytesToBase64(verifierIv),
      profiles: [],
      autoLockMinutes,
    };

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
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      throw new Error('Vault is not initialized.');
    }

    const vaultData: LocalVaultStorage = JSON.parse(raw);
    const salt = this.base64ToBytes(vaultData.salt);
    const candidateKey = await this.deriveKey(password, salt);

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

      this.masterKey = candidateKey;
      this.autoLockMinutes = vaultData.autoLockMinutes || 15;
      this.resetActivityTimer();
      this.notify();
      return true;
    } catch {
      throw new VaultInvalidPasswordError();
    }
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
    if (!this.masterKey) {
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

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.masterKey,
      plaintextBytes
    );

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
    this.touch();
    this.notify();
    return id;
  }

  /**
   * 프로필 삭제
   */
  public removeProfile(id: string): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const vaultData: LocalVaultStorage = JSON.parse(raw);
    vaultData.profiles = vaultData.profiles.filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(vaultData));
    this.touch();
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
    this.touch();

    // 1. 데모 프로필인 경우 즉시 데모 키로 실행
    if (profileId.startsWith('demo-')) {
      return await consumer('ibk_demo_swiss_dev_0123456789abcdef');
    }

    // 2. 잠금 상태 확인
    if (!this.masterKey) {
      throw new VaultLockedError();
    }

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
        this.masterKey,
        ciphertext as BufferSource
      );
      decryptedKey = new TextDecoder().decode(decryptedBuffer);
    } catch {
      throw new Error('Decryption failed. Vault record may be corrupted.');
    }

    // 4. 마지막 사용 일시 갱신
    record.lastUsedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(vaultData));

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
    localStorage.removeItem(STORAGE_KEY);
    this.masterKey = null;
    if (this.autoLockTimer) {
      clearTimeout(this.autoLockTimer);
      this.autoLockTimer = null;
    }
    this.notify();
  }

  // --- 내부 헬퍼 함수 ---
  private async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
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
        iterations: PBKDF2_ITERATIONS,
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
