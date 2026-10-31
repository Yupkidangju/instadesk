// src/types/vault.ts

/**
 * 암호화된 단일 프로필 레코드
 * localStorage에 저장되는 데이터 형식
 */
export interface EncryptedProfileRecord {
  id: string;             // UUID
  label: string;          // 예: "01 // PERSONAL_WORKSPACE", "02 // AGENT_PROD"
  encryptedData: string;  // Base64(iv):Base64(ciphertext + auth tag); salt is in LocalVaultStorage
  keyHint?: string;       // 마스터 비밀번호 힌트 (선택)
  createdAt: string;
  lastUsedAt: string | null;
}

/**
 * localStorage에 저장되는 전체 볼트 메타데이터
 */
export interface LocalVaultStorage {
  version: 1;
  salt: string;           // 마스터 키 파생용 고유 솔트 (Base64)
  verifierCiphertext: string; // 마스터 비밀번호 일치 검증용 암호화된 토큰
  verifierIv: string;     // 검증용 IV (Base64)
  profiles: EncryptedProfileRecord[];
  autoLockMinutes: number; // 기본값: 15
}

/**
 * 런타임 메모리 볼트 상태
 */
export interface VaultSessionState {
  isInitialized: boolean;   // 볼트가 생성되었는지 여부
  isUnlocked: boolean;      // 현재 마스터 키로 잠금 해제되어 있는지 여부
  lastActivityAt: number;   // 마지막 활동 타임스탬프 (자동 잠금 계산용)
  unlockedProfilesCount: number;
}
